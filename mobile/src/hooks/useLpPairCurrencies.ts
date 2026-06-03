import { useMemo } from "react";
import { decodeCurrency } from "@/src/lib/formatters";
import { useAmm, useAmms } from "./useAmm";

export interface LpPairCurrencies {
  currencyA: string;
  currencyB: string;
}

/** Resolve the two pool currencies for an LP token (issuer = AMM account). */
export function useLpPairCurrencies(ammAccount: string | undefined): LpPairCurrencies | null {
  const amms = useAmms();
  const fromList = useMemo(() => {
    if (!ammAccount) return null;
    const row = amms.data?.find((a) => a.account === ammAccount);
    if (!row) return null;
    return { currencyA: row.currency1, currencyB: row.currency2 };
  }, [amms.data, ammAccount]);

  const ammDetail = useAmm(fromList ? undefined : ammAccount);

  return useMemo(() => {
    if (fromList) return fromList;
    const info = ammDetail.data;
    if (!info) return null;
    return {
      currencyA: decodeCurrency(info.formattedAmount1.currency),
      currencyB: decodeCurrency(info.formattedAmount2.currency),
    };
  }, [fromList, ammDetail.data]);
}
