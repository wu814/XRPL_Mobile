import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { getWalletInfo, getWalletLines } from "@/src/api/wallets";
import { useLivePrices } from "./useLivePrices";
import { walletKeys } from "./useWallets";
import {
  buildWalletAssets,
  maxBalanceByCurrency,
  totalUsdForAssets,
  type TrustlineRow,
  type WalletAsset,
} from "@/src/lib/walletAssets";

export function useAllWalletAssets(addresses: string[]) {
  const livePrices = useLivePrices();
  const infoQueries = useQueries({
    queries: addresses.map((address) => ({
      queryKey: walletKeys.info(address),
      queryFn: () => getWalletInfo(address),
      enabled: !!address,
    })),
  });

  const linesQueries = useQueries({
    queries: addresses.map((address) => ({
      queryKey: walletKeys.lines(address),
      queryFn: () => getWalletLines(address),
      enabled: !!address,
    })),
  });

  const isLoading =
    (livePrices.isLoading && livePrices.prices.length === 0) ||
    infoQueries.some((q) => q.isLoading) ||
    linesQueries.some((q) => q.isLoading);

  const isFetching =
    livePrices.isFetching ||
    infoQueries.some((q) => q.isFetching) ||
    linesQueries.some((q) => q.isFetching);

  const assets = useMemo<WalletAsset[]>(() => {
    const out: WalletAsset[] = [];
    addresses.forEach((address, i) => {
      out.push(
        ...buildWalletAssets({
          address,
          infoData: infoQueries[i]?.data,
          lines: linesQueries[i]?.data as TrustlineRow[] | undefined,
          includeZeroXrp: false,
          prices: livePrices.prices,
        }),
      );
    });
    return out;
  }, [addresses, infoQueries, linesQueries, livePrices.prices]);

  const totalUsd = useMemo(() => totalUsdForAssets(assets), [assets]);
  const balanceByCurrency = useMemo(() => maxBalanceByCurrency(assets), [assets]);

  const refetch = async () => {
    await Promise.all([
      livePrices.refetch(),
      ...infoQueries.map((q) => q.refetch()),
      ...linesQueries.map((q) => q.refetch()),
    ]);
  };

  return { isLoading, isFetching, assets, totalUsd, balanceByCurrency, refetch };
}
