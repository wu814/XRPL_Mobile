import type { WalletSummary } from "@/src/api/wallets";

export interface ResolvedFeatureWallet {
  address: string | null;
  wallet: WalletSummary | null;
}

/** Admin DEX uses pathfind; regular users use their own wallet. */
export function resolveDexWallet(
  wallets: WalletSummary[] | undefined,
  isAdmin: boolean,
): ResolvedFeatureWallet {
  const list = wallets ?? [];
  const wallet = isAdmin
    ? (list.find((w) => w.wallet_type === "pathfind") ?? null)
    : (list.find((w) => w.wallet_type === "user") ?? list[0] ?? null);
  return { wallet, address: wallet?.classic_address ?? null };
}

/** Admin AMM liquidity uses treasury; regular users use their own wallet. */
export function resolveAmmWallet(
  wallets: WalletSummary[] | undefined,
  isAdmin: boolean,
): ResolvedFeatureWallet {
  const list = wallets ?? [];
  const wallet = isAdmin
    ? (list.find((w) => w.wallet_type === "treasury") ?? null)
    : (list.find((w) => w.wallet_type === "user") ?? list[0] ?? null);
  return { wallet, address: wallet?.classic_address ?? null };
}

export function missingDexWalletMessage(isAdmin: boolean): string {
  return isAdmin
    ? "Create a pathfind wallet (admin Home → Create Wallet) to place and view orders."
    : "Create a wallet on the Home tab to place and view orders.";
}

export function missingAmmWalletMessage(isAdmin: boolean): string {
  return isAdmin
    ? "Create a treasury wallet (admin Home → Create Wallet) to manage pool liquidity."
    : "Create a wallet on the Home tab to manage pool liquidity.";
}

const ADMIN_NFT_WALLET_ORDER: Record<string, number> = {
  issuer: 0,
  treasury: 1,
  pathfind: 2,
  user: 3,
};

/** All admin system wallets for the NFT picker (issuer, treasury, pathfind, user). */
export function nftWalletsForPicker(
  wallets: WalletSummary[] | undefined,
  isAdmin: boolean,
): WalletSummary[] {
  const list = wallets ?? [];
  if (!isAdmin) return list;
  return [...list].sort(
    (a, b) =>
      (ADMIN_NFT_WALLET_ORDER[a.wallet_type] ?? 99) -
      (ADMIN_NFT_WALLET_ORDER[b.wallet_type] ?? 99),
  );
}

/** Default NFT wallet: pathfind for admin when present, else first in picker order. */
export function resolveNftWallet(
  wallets: WalletSummary[] | undefined,
  isAdmin: boolean,
): ResolvedFeatureWallet {
  const list = nftWalletsForPicker(wallets, isAdmin);
  const wallet = isAdmin
    ? (list.find((w) => w.wallet_type === "pathfind") ?? list[0] ?? null)
    : (list.find((w) => w.wallet_type === "user") ?? list[0] ?? null);
  return { wallet, address: wallet?.classic_address ?? null };
}

export function missingNftWalletMessage(isAdmin: boolean): string {
  return isAdmin
    ? "Create wallets on the admin Home tab to mint and buy NFTs."
    : "Create a wallet on the Home tab to mint and buy NFTs.";
}
