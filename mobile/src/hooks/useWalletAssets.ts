import { useMemo } from "react";
import { useLivePrices } from "./useLivePrices";
import { useWalletInfo, useWalletLines } from "./useWallets";
import {
  balanceByCurrencyFromWallet,
  buildWalletAssets,
  summarizeXrpAccount,
  totalUsdForAssets,
  type TrustlineRow,
  type WalletAsset,
  type WalletBalanceSummary,
} from "@/src/lib/walletAssets";

export type { WalletAsset, WalletBalanceSummary } from "@/src/lib/walletAssets";

export function useWalletAssets(address: string | undefined) {
  const livePrices = useLivePrices();
  const info = useWalletInfo(address);
  const lines = useWalletLines(address);

  const summary = useMemo<WalletBalanceSummary>(
    () => summarizeXrpAccount(info.data),
    [info.data],
  );

  const assets = useMemo<WalletAsset[]>(() => {
    if (!address) return [];
    return buildWalletAssets({
      address,
      infoData: info.data,
      lines: lines.data as TrustlineRow[] | undefined,
      includeZeroXrp: true,
      prices: livePrices.prices,
    });
  }, [address, info.data, lines.data, livePrices.prices]);

  const totalUsd = useMemo(() => totalUsdForAssets(assets), [assets]);

  const balanceByCurrency = useMemo(
    () =>
      balanceByCurrencyFromWallet({
        summary,
        lines: lines.data as TrustlineRow[] | undefined,
      }),
    [lines.data, summary],
  );

  return {
    isLoading:
      info.isLoading ||
      lines.isLoading ||
      (livePrices.isLoading && livePrices.prices.length === 0),
    isFetching: info.isFetching || lines.isFetching || livePrices.isFetching,
    error: info.error || lines.error || livePrices.error,
    summary,
    assets,
    totalUsd,
    balanceByCurrency,
    refetch: async () => {
      await Promise.all([info.refetch(), lines.refetch(), livePrices.refetch()]);
    },
  };
}
