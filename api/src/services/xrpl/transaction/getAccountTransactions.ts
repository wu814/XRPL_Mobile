import {
  type AccountTxRequest,
  type AccountTxResponse,
  type AccountTxTransaction,
  type Client,
  type Amount,
  type IssuedCurrencyAmount,
  type Payment,
  type TrustSet,
  type OfferCreate,
  type OfferCancel,
  type Clawback,
  type NFTokenMint,
  type NFTokenCreateOffer,
  type NFTokenAcceptOffer,
  type Transaction,
  type TransactionMetadata,
  dropsToXrp,
} from "xrpl";

export interface ProcessedTransaction {
  hash: string;
  ledger_index: number | null;
  date: string | null;
  type: string;
  direction: string;
  counterparty: string | null;
  amount: string | number | null;
  currency: string;
  fee: string | null;
  validated: boolean;
  result: string;
}

export interface GetAccountTransactionsResult {
  transactions: ProcessedTransaction[];
  marker: string | null;
  message?: string;
}

function formatAmountAsString(amount: Amount): string | null {
  if (typeof amount === "string") {
    return `${dropsToXrp(amount)} XRP`;
  } else if (amount && typeof amount === "object") {
    const issued = amount as IssuedCurrencyAmount;
    return `${issued.value} ${issued.currency}`;
  }
  return null;
}

function getTypedTransaction(
  txData: AccountTxTransaction,
): { tx: Transaction; meta: TransactionMetadata } | null {
  const rawTx = txData.tx_json ?? (txData as any).tx;
  const rawMeta = txData.meta;
  if (!rawTx || !rawMeta || typeof rawMeta === "string") return null;
  return { tx: rawTx as Transaction, meta: rawMeta as TransactionMetadata };
}

interface AssetAmount {
  currency: string;
  value: string;
}

function processRippleStateNode(
  node: any,
  senderAddress: string,
  added: Set<string>,
  isDeposit: boolean,
): AssetAmount | null {
  const { FinalFields, PreviousFields } = node;
  if (!FinalFields?.Balance || !PreviousFields?.Balance) return null;
  const finalBalance = FinalFields.Balance as IssuedCurrencyAmount;
  const prevBalance = PreviousFields.Balance as IssuedCurrencyAmount;
  if (finalBalance.currency?.length === 40) return null;
  const highAccount = (FinalFields as any).HighLimit?.issuer;
  const lowAccount = (FinalFields as any).LowLimit?.issuer;
  if (highAccount !== senderAddress && lowAccount !== senderAddress) return null;
  const issuer = lowAccount === senderAddress ? highAccount : lowAccount;
  const key = `${finalBalance.currency}:${issuer}`;
  if (added.has(key)) return null;
  const prevVal = parseFloat(prevBalance.value || "0");
  const finalVal = parseFloat(finalBalance.value || "0");
  const fromSender = lowAccount === senderAddress;
  const diff = isDeposit
    ? fromSender
      ? prevVal - finalVal
      : finalVal - prevVal
    : fromSender
      ? finalVal - prevVal
      : prevVal - finalVal;
  if (diff > 0.000001) {
    added.add(key);
    return { currency: finalBalance.currency, value: diff.toFixed(6) };
  }
  return null;
}

function processAccountRootNode(
  node: any,
  senderAddress: string,
  txData: AccountTxTransaction,
  added: Set<string>,
  isDeposit: boolean,
): AssetAmount | null {
  if (node.FinalFields?.Account !== senderAddress) return null;
  const { FinalFields, PreviousFields } = node;
  if (!FinalFields?.Balance || !PreviousFields?.Balance) return null;
  const finalDrops = parseInt(FinalFields.Balance as string);
  const prevDrops = parseInt(PreviousFields.Balance as string);
  const fee = parseInt(((txData as any).tx?.Fee as string) ?? "0");
  const xrpDiff = isDeposit ? prevDrops - finalDrops - fee : finalDrops - prevDrops + fee;
  if (!added.has("XRP") && xrpDiff > 1000) {
    added.add("XRP");
    return { currency: "XRP", value: dropsToXrp(xrpDiff.toString()).toFixed(6) };
  }
  return null;
}

function extractAMMAmounts(txData: AccountTxTransaction, senderAddress: string, isDeposit: boolean): string {
  const typed = getTypedTransaction(txData);
  if (!typed) return isDeposit ? "Liquidity deposit" : "Liquidity withdrawal";
  const { meta } = typed;
  const assets: AssetAmount[] = [];
  const added = new Set<string>();
  for (const node of meta.AffectedNodes || []) {
    if ("ModifiedNode" in node && node.ModifiedNode.LedgerEntryType === "RippleState") {
      const a = processRippleStateNode(node.ModifiedNode, senderAddress, added, isDeposit);
      if (a) assets.push(a);
    } else if ("ModifiedNode" in node && node.ModifiedNode.LedgerEntryType === "AccountRoot") {
      const a = processAccountRootNode(node.ModifiedNode, senderAddress, txData, added, isDeposit);
      if (a) assets.push(a);
    }
  }
  if (assets.length === 0) return isDeposit ? "Liquidity deposit" : "Liquidity withdrawal";
  if (assets.length === 1) {
    const a = assets[0]!;
    return `${a.value} ${a.currency}`;
  }
  return assets.map((a) => `${a.value} ${a.currency}`).join(" + ");
}

function processPayment(tx: Payment, meta: TransactionMetadata, target: string) {
  const isSmartTrade = tx.Account === tx.Destination && tx.Account === target;
  if (isSmartTrade) {
    const sentAmount = tx.SendMax || tx.Amount;
    const receivedAmount = (meta as any).DeliveredAmount || (meta as any).delivered_amount;
    const sentStr = formatAmountAsString(sentAmount as Amount);
    const receivedStr = receivedAmount ? formatAmountAsString(receivedAmount as Amount) : null;
    let amount: string;
    if (sentStr && receivedStr) amount = `${sentStr} → ${receivedStr}`;
    else if (sentStr) amount = `${sentStr} → ?`;
    else if (receivedStr) amount = `? → ${receivedStr}`;
    else amount = "Smart trade";
    return { direction: "smart_trade", counterparty: null as string | null, amount, currency: "" };
  } else {
    const direction = tx.Account === target ? "sent" : "received";
    const counterparty = direction === "sent" ? tx.Destination : tx.Account;
    const paymentAmount = (tx.Amount as Amount) || ((tx as any).DeliverMax as Amount) || ((meta as any)?.delivered_amount as Amount);
    let amount: string | number;
    let currency: string;
    if (paymentAmount) {
      if (typeof paymentAmount === "string") {
        amount = dropsToXrp(paymentAmount);
        currency = "XRP";
      } else {
        amount = (paymentAmount as IssuedCurrencyAmount).value;
        currency = (paymentAmount as IssuedCurrencyAmount).currency;
      }
    } else {
      amount = "Unknown amount";
      currency = "Unknown";
    }
    return { direction, counterparty, amount, currency };
  }
}

function processTrustSet(tx: TrustSet) {
  return {
    direction: "trustline_set",
    counterparty: tx.LimitAmount?.issuer || null,
    amount: tx.LimitAmount ? `${tx.LimitAmount.value} ${tx.LimitAmount.currency}` : "Remove trustline",
    currency: tx.LimitAmount?.currency || "",
  };
}

function processOfferCreate(tx: OfferCreate) {
  const gets = formatAmountAsString(tx.TakerGets);
  const pays = formatAmountAsString(tx.TakerPays);
  return {
    direction: "offer_create",
    counterparty: null as string | null,
    amount: `${gets} → ${pays}`,
    currency: "",
  };
}

function processOfferCancel(tx: OfferCancel) {
  return {
    direction: "offer_cancel",
    counterparty: null as string | null,
    amount: `Sequence: ${tx.OfferSequence}`,
    currency: "",
  };
}

function processClawback(tx: Clawback) {
  return {
    direction: "clawback",
    counterparty: (tx.Amount as IssuedCurrencyAmount)?.issuer || null,
    amount: (tx.Amount as IssuedCurrencyAmount)?.value || "Clawback",
    currency: (tx.Amount as IssuedCurrencyAmount)?.currency || "Unknown",
  };
}

function processNFTMint(_tx: NFTokenMint) {
  return { direction: "nft_mint", counterparty: null as string | null, amount: "NFT Minted", currency: "" };
}

function processNFTCreateOffer(tx: NFTokenCreateOffer) {
  return {
    direction: "nft_create_offer",
    counterparty: tx.Owner || tx.Destination || null,
    amount: tx.Amount ? formatAmountAsString(tx.Amount as Amount) || "NFT Offer" : "NFT Offer",
    currency: "",
  };
}

function processNFTAcceptOffer(tx: NFTokenAcceptOffer) {
  return {
    direction: "nft_accept_offer",
    counterparty: tx.Account,
    amount: "NFT Offer Accepted",
    currency: "",
  };
}

export async function getAccountTransactions(
  client: Client,
  targetAddress: string,
  limit: number = 50,
  marker: string | null = null,
): Promise<GetAccountTransactionsResult> {
  if (!targetAddress) throw new Error("Missing address");
  if (!client.isConnected()) await client.connect();

  const requestParams: AccountTxRequest = {
    command: "account_tx",
    account: targetAddress,
    binary: false,
    limit: Math.min(limit, 30),
    forward: false,
    ...(marker && { marker: marker as any }),
  };

  const response: AccountTxResponse = await client.request(requestParams);

  if (!response.result?.transactions) {
    return { transactions: [], marker: null, message: "No transaction data available" };
  }

  const processed = response.result.transactions
    .map((txData: AccountTxTransaction): ProcessedTransaction | null => {
      try {
        const typed = getTypedTransaction(txData);
        if (!typed) return null;
        const { tx, meta } = typed;

        let timestamp: string | null = null;
        const txDate = (tx as any).date as number | undefined;
        if (typeof txDate === "number") {
          timestamp = new Date((txDate + 946684800) * 1000).toISOString();
        }

        const fee = tx.Fee ? dropsToXrp(tx.Fee).toString() : null;
        const transactionType = tx.TransactionType || "Unknown";

        let direction = "unknown";
        let counterparty: string | null = null;
        let amount: string | number | null = "N/A";
        let currency = "XRP";

        switch (transactionType) {
          case "Payment": {
            const r = processPayment(tx as Payment, meta, targetAddress);
            ({ direction, counterparty, amount, currency } = r);
            break;
          }
          case "TrustSet": {
            const r = processTrustSet(tx as TrustSet);
            ({ direction, counterparty, amount, currency } = r);
            break;
          }
          case "OfferCreate": {
            const r = processOfferCreate(tx as OfferCreate);
            ({ direction, counterparty, amount, currency } = r);
            break;
          }
          case "OfferCancel": {
            const r = processOfferCancel(tx as OfferCancel);
            ({ direction, counterparty, amount, currency } = r);
            break;
          }
          case "AMMCreate":
            direction = "amm_create";
            amount = "AMM pool created";
            currency = "";
            break;
          case "AMMDeposit":
            direction = "amm_deposit";
            amount = extractAMMAmounts(txData, targetAddress, true);
            currency = "";
            break;
          case "AMMWithdraw":
            direction = "amm_withdraw";
            amount = extractAMMAmounts(txData, targetAddress, false);
            currency = "";
            break;
          case "Clawback": {
            const r = processClawback(tx as Clawback);
            ({ direction, counterparty, amount, currency } = r);
            break;
          }
          case "NFTokenMint": {
            const r = processNFTMint(tx as NFTokenMint);
            ({ direction, counterparty, amount, currency } = r);
            break;
          }
          case "NFTokenCreateOffer": {
            const r = processNFTCreateOffer(tx as NFTokenCreateOffer);
            ({ direction, counterparty, amount, currency } = r);
            break;
          }
          case "NFTokenAcceptOffer": {
            const r = processNFTAcceptOffer(tx as NFTokenAcceptOffer);
            ({ direction, counterparty, amount, currency } = r);
            break;
          }
          default:
            direction = transactionType.toLowerCase();
            amount = "N/A";
        }

        let finalType: string = transactionType;
        if (direction === "smart_trade") {
          finalType = "Smart Trade";
          currency = "";
        }

        return {
          hash: (tx as any).hash || (txData as any).hash || "unknown",
          ledger_index: (tx as any).ledger_index || ((txData as any).ledger_index as number) || null,
          date: timestamp,
          type: finalType,
          direction,
          counterparty,
          amount,
          currency,
          fee,
          validated: txData.validated !== false,
          result: (meta as any)?.TransactionResult || "unknown",
        };
      } catch {
        return null;
      }
    })
    .filter((t): t is ProcessedTransaction => t !== null);

  return {
    transactions: processed,
    marker: (response.result.marker as string | undefined) || null,
  };
}
