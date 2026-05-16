import type { WalletClient } from 'viem';

/**
 * Asserts that a walletClient is present before any write operation.
 * Throws a user-facing error in Spanish if it is missing.
 */
export function requireWallet(walletClient: WalletClient | null | undefined): WalletClient {
  if (!walletClient) {
    throw new Error(
      'Esta operación requiere una clave de firma (signerPrivateKey). ' +
        'Configura DEPLOYER_PRIVATE_KEY en las variables de entorno del servidor.',
    );
  }
  return walletClient;
}
