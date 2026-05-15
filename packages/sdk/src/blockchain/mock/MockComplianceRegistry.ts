import type { Address } from 'viem';
import type {
  ComplianceCheckResult,
  ComplianceRegistryAdapter,
} from '../interfaces/ComplianceRegistryAdapter';
import { MockChainState, getMockChainState } from './state';

export class MockComplianceRegistry implements ComplianceRegistryAdapter {
  constructor(private readonly state: MockChainState = getMockChainState()) {}

  async canTransfer(input: {
    token: Address;
    from: Address;
    to: Address;
    amount: bigint;
  }): Promise<ComplianceCheckResult> {
    const reasons: string[] = [];
    const token = this.state.tokens.get(input.token.toLowerCase() as Address);
    if (!token) {
      return { allowed: false, reasons: ['Token no desplegado'] };
    }
    if (token.paused) reasons.push('Token pausado');

    const fromIdentity = this.state.identities.get(input.from.toLowerCase() as Address);
    const toIdentity = this.state.identities.get(input.to.toLowerCase() as Address);

    if (!toIdentity) reasons.push('Destinatario sin identidad verificada');
    if (toIdentity?.frozen) reasons.push('Wallet del destinatario está congelada');
    if (fromIdentity?.frozen) reasons.push('Wallet del emisor está congelada');

    const nowSec = Math.floor(Date.now() / 1000);
    if (token.lockupUntil > nowSec) reasons.push('Periodo de lockup vigente');

    if (toIdentity && !token.allowedJurisdictions.includes(toIdentity.jurisdiction)) {
      reasons.push('Jurisdicción del destinatario no permitida');
    }

    const fromBalance = token.balances.get(input.from.toLowerCase() as Address) ?? 0n;
    if (fromBalance < input.amount) reasons.push('Balance insuficiente');

    const toBalance = token.balances.get(input.to.toLowerCase() as Address) ?? 0n;
    const isNewHolder = toBalance === 0n;
    if (isNewHolder) {
      const currentHolders = Array.from(token.balances.values()).filter((b) => b > 0n).length;
      if (currentHolders >= token.maxHolders) reasons.push('Límite de holders alcanzado');
    }

    return { allowed: reasons.length === 0, reasons };
  }

  async addModule(token: Address, module: string): Promise<void> {
    const t = token.toLowerCase() as Address;
    let set = this.state.modulesByToken.get(t);
    if (!set) {
      set = new Set();
      this.state.modulesByToken.set(t, set);
    }
    set.add(module);
  }

  async removeModule(token: Address, module: string): Promise<void> {
    this.state.modulesByToken.get(token.toLowerCase() as Address)?.delete(module);
  }
}
