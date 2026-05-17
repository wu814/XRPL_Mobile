import type { Client, Wallet } from "xrpl";

export interface CreateWalletResult {
  wallet: Wallet;
  balanceXrp: number;
}

/**
 * Create and fund a new XRPL wallet on Testnet via the faucet.
 * Ported from xrpl_mvp.
 */
export async function createWallet(client: Client): Promise<CreateWalletResult> {
  if (!client.isConnected()) await client.connect();
  const fundResult = await client.fundWallet();
  return {
    wallet: fundResult.wallet,
    balanceXrp: Number(fundResult.balance),
  };
}
