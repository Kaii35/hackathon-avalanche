import type { Address, Hex } from 'viem';
import type { DeployTokenInput, SecurityTokenAdapter } from '../interfaces/SecurityTokenAdapter';
import { getEventBus, type EventBus } from '../../events/bus';
import { MockChainState, getMockChainState, type TokenState } from './state';
import { MockComplianceRegistry } from './MockComplianceRegistry';

export class MockSecurityToken implements SecurityTokenAdapter {
  constructor(
    private readonly state: MockChainState = getMockChainState(),
    private readonly bus: EventBus = getEventBus(),
    private readonly compliance: MockComplianceRegistry = new MockComplianceRegistry(state),
  ) {}

  async deploy(input: DeployTokenInput): Promise<{ tokenAddress: Address; txHash: Hex }> {
    const tokenAddress = this.state.tokenAddress();
    const initialHolder = input.initialHolder.toLowerCase() as Address;
    const tokenState: TokenState = {
      address: tokenAddress,
      offeringId: input.offeringId,
      name: input.name,
      symbol: input.symbol,
      totalSupply: input.initialSupply,
      lockupUntil: input.lockupUntil,
      maxHolders: input.maxHolders,
      allowedJurisdictions: input.allowedJurisdictions,
      paused: false,
      balances: new Map<Address, bigint>([[initialHolder, input.initialSupply]]),
    };
    this.state.tokens.set(tokenAddress, tokenState);

    const txHash = this.state.txHash();
    const blockNumber = this.state.nextBlock();
    const ts = Date.now();
    await this.bus.emit({
      id: this.state.eventId(),
      type: 'TokenDeployed',
      txHash,
      blockNumber,
      timestamp: ts,
      offeringId: input.offeringId,
      tokenAddress,
      initialSupply: input.initialSupply.toString(),
    });
    if (input.initialSupply > 0n) {
      await this.bus.emit({
        id: this.state.eventId(),
        type: 'Transfer',
        txHash,
        blockNumber,
        timestamp: ts,
        token: tokenAddress,
        from: '0x0000000000000000000000000000000000000000' as Address,
        to: initialHolder,
        value: input.initialSupply.toString(),
      });
    }
    return { tokenAddress, txHash };
  }

  async mint(token: Address, to: Address, amount: bigint): Promise<{ txHash: Hex }> {
    const tokenState = this.requireToken(token);
    const dest = to.toLowerCase() as Address;
    tokenState.balances.set(dest, (tokenState.balances.get(dest) ?? 0n) + amount);
    tokenState.totalSupply += amount;
    const txHash = this.state.txHash();
    const blockNumber = this.state.nextBlock();
    await this.bus.emit({
      id: this.state.eventId(),
      type: 'Transfer',
      txHash,
      blockNumber,
      timestamp: Date.now(),
      token: tokenState.address,
      from: '0x0000000000000000000000000000000000000000' as Address,
      to: dest,
      value: amount.toString(),
    });
    return { txHash };
  }

  async balanceOf(token: Address, holder: Address): Promise<bigint> {
    const tokenState = this.state.tokens.get(token.toLowerCase() as Address);
    if (!tokenState) return 0n;
    return tokenState.balances.get(holder.toLowerCase() as Address) ?? 0n;
  }

  async transfer(input: {
    token: Address;
    from: Address;
    to: Address;
    amount: bigint;
  }): Promise<{ txHash: Hex }> {
    const tokenState = this.requireToken(input.token);
    const check = await this.compliance.canTransfer(input);
    if (!check.allowed) {
      throw new Error(`compliance rejected: ${check.reasons.join(', ')}`);
    }
    const from = input.from.toLowerCase() as Address;
    const to = input.to.toLowerCase() as Address;
    const fromBal = tokenState.balances.get(from) ?? 0n;
    tokenState.balances.set(from, fromBal - input.amount);
    tokenState.balances.set(to, (tokenState.balances.get(to) ?? 0n) + input.amount);
    const txHash = this.state.txHash();
    const blockNumber = this.state.nextBlock();
    await this.bus.emit({
      id: this.state.eventId(),
      type: 'Transfer',
      txHash,
      blockNumber,
      timestamp: Date.now(),
      token: tokenState.address,
      from,
      to,
      value: input.amount.toString(),
    });
    return { txHash };
  }

  async freeze(wallet: Address, reason: string): Promise<{ txHash: Hex }> {
    const w = wallet.toLowerCase() as Address;
    const identity = this.state.identities.get(w);
    if (identity) identity.frozen = true;
    const txHash = this.state.txHash();
    const blockNumber = this.state.nextBlock();
    await this.bus.emit({
      id: this.state.eventId(),
      type: 'WalletFrozen',
      txHash,
      blockNumber,
      timestamp: Date.now(),
      wallet: w,
      reason,
    });
    return { txHash };
  }

  async unfreeze(wallet: Address): Promise<{ txHash: Hex }> {
    const w = wallet.toLowerCase() as Address;
    const identity = this.state.identities.get(w);
    if (identity) identity.frozen = false;
    const txHash = this.state.txHash();
    const blockNumber = this.state.nextBlock();
    await this.bus.emit({
      id: this.state.eventId(),
      type: 'WalletUnfrozen',
      txHash,
      blockNumber,
      timestamp: Date.now(),
      wallet: w,
    });
    return { txHash };
  }

  async forcedTransfer(input: {
    token: Address;
    from: Address;
    to: Address;
    amount: bigint;
    reason: string;
  }): Promise<{ txHash: Hex }> {
    const tokenState = this.requireToken(input.token);
    const from = input.from.toLowerCase() as Address;
    const to = input.to.toLowerCase() as Address;
    const fromBal = tokenState.balances.get(from) ?? 0n;
    if (fromBal < input.amount) throw new Error('balance insuficiente para forced transfer');
    tokenState.balances.set(from, fromBal - input.amount);
    tokenState.balances.set(to, (tokenState.balances.get(to) ?? 0n) + input.amount);
    const txHash = this.state.txHash();
    const blockNumber = this.state.nextBlock();
    const ts = Date.now();
    await this.bus.emit({
      id: this.state.eventId(),
      type: 'ForcedTransfer',
      txHash,
      blockNumber,
      timestamp: ts,
      token: tokenState.address,
      from,
      to,
      value: input.amount.toString(),
      reason: input.reason,
    });
    await this.bus.emit({
      id: this.state.eventId(),
      type: 'Transfer',
      txHash,
      blockNumber,
      timestamp: ts,
      token: tokenState.address,
      from,
      to,
      value: input.amount.toString(),
    });
    return { txHash };
  }

  async pause(token: Address): Promise<{ txHash: Hex }> {
    const tokenState = this.requireToken(token);
    tokenState.paused = true;
    return { txHash: this.state.txHash() };
  }

  private requireToken(addr: Address): TokenState {
    const tokenState = this.state.tokens.get(addr.toLowerCase() as Address);
    if (!tokenState) throw new Error(`token ${addr} no desplegado`);
    return tokenState;
  }
}
