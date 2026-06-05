import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { listAmms } from "@/src/api/amm";
import {
  getIssuerWallets,
  getWalletByUsername,
  type WalletSummary,
} from "@/src/api/wallets";
import {
  useAuthorizeDeposit,
  useAuthorizeTrustline,
  useClawback,
  useDeleteOracle,
  useFreezeTrustline,
  useSetOracle,
  useSetTrustline,
} from "@/src/hooks/useWalletActions";
import { AppSheet } from "@/src/components/ui/AppSheet";
import { CurrencySelectorList } from "@/src/features/payments/CurrencySelectorSheet";
import { CurrencyIconImage } from "@/src/features/shared/CurrencyIconImage";
import type { FreezeMode, SetTrustlineResult } from "@/src/api/trustlines";

// Mirrors server default in api/src/services/xrpl/oracle/coinGecko.ts (read-only UI).
const COIN_GECKO_IDS_DISPLAY = "ripple,bitcoin,ethereum,euro-coin,solana";
const VS_CURRENCY_DISPLAY = "usd";

export type WalletActionKey =
  | "set_trustline"
  | "authorize_deposit"
  | "authorize_trustline"
  | "clawback"
  | "deep_freeze"
  | "manage_oracle";

export const WALLET_ACTION_TITLES: Record<WalletActionKey, string> = {
  set_trustline: "Set Trustline",
  authorize_deposit: "Authorize Deposit",
  authorize_trustline: "Authorize Trustline",
  clawback: "Clawback",
  deep_freeze: "Deep Freeze",
  manage_oracle: "Manage Oracle",
};

type RecipientMode = "username" | "address";
type OracleMode = "set" | "delete";

interface WalletActionSheetProps {
  visible: boolean;
  action: WalletActionKey | null;
  wallet: WalletSummary;
  onClose: () => void;
}

export function WalletActionSheet({
  visible,
  action,
  wallet,
  onClose,
}: WalletActionSheetProps) {
  const issuerWalletsQuery = useQuery({
    queryKey: ["wallets", "issuers"],
    queryFn: getIssuerWallets,
    enabled: visible,
  });
  const ammListQuery = useQuery({
    queryKey: ["amm", "list"],
    queryFn: listAmms,
    enabled: visible,
  });

  // Shared fields
  const [currency, setCurrency] = useState("USD");
  const [issuer, setIssuer] = useState("");
  const [limit, setLimit] = useState("1000000000");
  const [amount, setAmount] = useState("");
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("username");
  const [counterpartyUsername, setCounterpartyUsername] = useState("");
  const [counterpartyAddress, setCounterpartyAddress] = useState("");
  const [freezeMode, setFreezeMode] = useState<FreezeMode>("freeze");
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  // Oracle fields
  const [oracleMode, setOracleMode] = useState<OracleMode>("set");
  const [oracleDocId, setOracleDocId] = useState("1");

  const setTrustlineMut = useSetTrustline();
  const authorizeDepositMut = useAuthorizeDeposit();
  const authorizeTrustlineMut = useAuthorizeTrustline();
  const clawbackMut = useClawback();
  const freezeMut = useFreezeTrustline();
  const setOracleMut = useSetOracle();
  const deleteOracleMut = useDeleteOracle();

  // A single issuer wallet issues every token, so the issuer for any currency
  // is just the (one) issuer wallet in the database. Fall back to an AMM's
  // recorded issuer if the issuer lookup is unavailable.
  const issuerForCurrency = useMemo(() => {
    return (cur: string): string | null => {
      if (cur === "XRP") return null;
      const issuerWallet = issuerWalletsQuery.data?.[0];
      if (issuerWallet) return issuerWallet.classic_address;
      const fromAmm = ammListQuery.data?.find(
        (a) => a.currency1 === cur || a.currency2 === cur,
      );
      return fromAmm?.issuer_address ?? null;
    };
  }, [issuerWalletsQuery.data, ammListQuery.data]);

  // Prefill issuer for Set Trustline when the currency or pool data changes.
  useEffect(() => {
    if (action !== "set_trustline") return;
    const found = issuerForCurrency(currency);
    if (found) setIssuer(found);
  }, [action, currency, issuerForCurrency]);

  const reset = () => {
    setIssuer("");
    setLimit("1000000000");
    setAmount("");
    setCounterpartyUsername("");
    setCounterpartyAddress("");
    setFreezeMode("freeze");
    setOracleMode("set");
  };

  const close = () => {
    reset();
    setShowCurrencyPicker(false);
    onClose();
  };

  const dismissCurrencyPicker = () => setShowCurrencyPicker(false);

  const resolveCounterparty = async (): Promise<string> => {
    if (recipientMode === "address") {
      const addr = counterpartyAddress.trim();
      if (!addr) throw new Error("Enter an address");
      return addr;
    }
    const name = counterpartyUsername.trim();
    if (!name) throw new Error("Enter a username");
    const found = await getWalletByUsername(name);
    return found.classic_address;
  };

  const isPending =
    setTrustlineMut.isPending ||
    authorizeDepositMut.isPending ||
    authorizeTrustlineMut.isPending ||
    clawbackMut.isPending ||
    freezeMut.isPending ||
    setOracleMut.isPending ||
    deleteOracleMut.isPending;

  const onSubmit = async () => {
    try {
      switch (action) {
        case "set_trustline": {
          if (currency === "XRP") {
            return Alert.alert("Invalid currency", "XRP does not need a trustline.");
          }
          const iss = issuer.trim();
          if (!iss) {
            return Alert.alert("Issuer required", "Enter the issuer address for this token.");
          }
          if (!Number(limit)) {
            return Alert.alert("Invalid limit", "Enter a trustline limit greater than zero.");
          }
          const result = await setTrustlineMut.mutateAsync({
            walletAddress: wallet.classic_address,
            currency,
            issuer: iss,
            limit: limit.trim(),
          });
          Alert.alert("Set Trustline", trustlineSuccessMessage(currency, result));
          break;
        }
        case "authorize_deposit": {
          const authorized = await resolveCounterparty();
          await authorizeDepositMut.mutateAsync({
            walletAddress: wallet.classic_address,
            authorizedAddress: authorized,
          });
          Alert.alert("Deposit authorized");
          break;
        }
        case "authorize_trustline": {
          const holder = await resolveCounterparty();
          await authorizeTrustlineMut.mutateAsync({
            issuerAddress: wallet.classic_address,
            currency,
            holderAddress: holder,
          });
          Alert.alert("Trustline authorized");
          break;
        }
        case "clawback": {
          const holder = await resolveCounterparty();
          const amt = Number(amount);
          if (!Number.isFinite(amt) || amt <= 0) {
            return Alert.alert("Invalid amount", "Enter an amount greater than zero.");
          }
          await clawbackMut.mutateAsync({
            issuerAddress: wallet.classic_address,
            currency,
            holderAddress: holder,
            value: amount.trim(),
          });
          Alert.alert("Clawback complete");
          break;
        }
        case "deep_freeze": {
          const holder = await resolveCounterparty();
          await freezeMut.mutateAsync({
            issuerAddress: wallet.classic_address,
            currency,
            holderAddress: holder,
            mode: freezeMode,
          });
          Alert.alert(
            freezeMode === "unfreeze" ? "Trustline unfrozen" : "Trustline frozen",
          );
          break;
        }
        case "manage_oracle": {
          const docId = Number(oracleDocId);
          if (!Number.isInteger(docId) || docId < 0) {
            return Alert.alert("Invalid document ID", "Enter a non-negative integer.");
          }
          if (oracleMode === "delete") {
            await deleteOracleMut.mutateAsync({
              walletAddress: wallet.classic_address,
              oracleDocumentId: docId,
            });
            Alert.alert("Oracle deleted");
          } else {
            await setOracleMut.mutateAsync({
              walletAddress: wallet.classic_address,
              oracleDocumentId: docId,
            });
            Alert.alert("Oracle set successfully");
          }
          break;
        }
        default:
          break;
      }
      close();
    } catch (err) {
      Alert.alert(action ? WALLET_ACTION_TITLES[action] : "Action failed", (err as Error).message);
    }
  };

  const title = action ? WALLET_ACTION_TITLES[action] : "";
  const needsCounterparty =
    action === "authorize_deposit" ||
    action === "authorize_trustline" ||
    action === "clawback" ||
    action === "deep_freeze";
  const needsCurrency =
    action === "set_trustline" ||
    action === "authorize_trustline" ||
    action === "clawback" ||
    action === "deep_freeze";

  return (
    <AppSheet
      visible={visible}
      onClose={showCurrencyPicker ? dismissCurrencyPicker : close}
      title={showCurrencyPicker ? "Select Currency" : title}
      keyboardAvoiding={!showCurrencyPicker}
    >
      {showCurrencyPicker ? (
        <CurrencySelectorList
          selected={currency}
          disabledIds={["XRP"]}
          onSelect={(c) => {
            setCurrency(c);
            setShowCurrencyPicker(false);
          }}
        />
      ) : (
        <>
            <Text className="mb-4 text-xs text-white/40">{descriptionFor(action)}</Text>

            {action !== "set_trustline" ? (
              <>
                <Text className="mb-1 text-xs uppercase tracking-wider text-white/50">Wallet</Text>
                <Text className="mb-5 font-mono text-xs text-white/70">
                  {wallet.classic_address}
                </Text>
              </>
            ) : null}

            {action === "manage_oracle" ? (
              <SegmentedControl
                value={oracleMode}
                onChange={(v) => setOracleMode(v as OracleMode)}
                options={[
                  { id: "set", label: "Set" },
                  { id: "delete", label: "Delete" },
                ]}
              />
            ) : null}

            {needsCurrency ? (
              <>
                <Label>Currency</Label>
                <TouchableOpacity
                  onPress={() => setShowCurrencyPicker(true)}
                  className="mb-4 flex-row items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <View className="flex-row items-center">
                    <CurrencyIconImage currency={currency} size={28} />
                    <Text className="ml-2 text-base font-semibold text-white">{currency}</Text>
                  </View>
                  <Text className="text-white/40">▾</Text>
                </TouchableOpacity>
              </>
            ) : null}

            {action === "set_trustline" && !issuerWalletsQuery.isLoading && !issuer ? (
              <Text className="mb-4 text-sm text-danger">
                No issuer wallet found. Ask an admin to create one.
              </Text>
            ) : null}

            {needsCounterparty ? (
              <>
                <View className="mb-2 self-end">
                  <SegmentedControl
                    small
                    value={recipientMode}
                    onChange={(v) => setRecipientMode(v as RecipientMode)}
                    options={[
                      { id: "username", label: "Username" },
                      { id: "address", label: "Address" },
                    ]}
                  />
                </View>
                <Label>{counterpartyLabel(action)}</Label>
                <Field
                  value={
                    recipientMode === "address" ? counterpartyAddress : counterpartyUsername
                  }
                  onChangeText={(t) =>
                    recipientMode === "address"
                      ? setCounterpartyAddress(t)
                      : setCounterpartyUsername(t)
                  }
                  placeholder={recipientMode === "address" ? "Address (r...)" : "Username"}
                  autoCapitalize="none"
                />
              </>
            ) : null}

            {action === "authorize_deposit" ? (
              <Text className="mb-4 text-xs text-white/50">
                Enter the username or XRPL address to authorize for deposits.
              </Text>
            ) : null}

            {action === "authorize_trustline" ? (
              <Text className="mb-4 text-xs text-white/50">
                Enter the holder&apos;s username or XRPL address to authorize their trustline.
              </Text>
            ) : null}

            {action === "clawback" ? (
              <Text className="mb-4 text-xs text-white/50">
                Enter the holder&apos;s username or XRPL address to claw back tokens.
              </Text>
            ) : null}

            {action === "deep_freeze" ? (
              <Text className="mb-4 text-xs text-white/50">
                Enter the holder&apos;s username or XRPL address to freeze or unfreeze their trustline.
              </Text>
            ) : null}

            {action === "clawback" ? (
              <>
                <Label>Amount to claw back</Label>
                <Field
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              </>
            ) : null}

            {action === "deep_freeze" ? (
              <>
                <Label>Action</Label>
                <SegmentedControl
                  value={freezeMode}
                  onChange={(v) => setFreezeMode(v as FreezeMode)}
                  options={[
                    { id: "freeze", label: "Freeze" },
                    { id: "deep_freeze", label: "Deep Freeze" },
                    { id: "unfreeze", label: "Unfreeze" },
                  ]}
                />
              </>
            ) : null}

            {action === "manage_oracle" ? (
              <>
                <Label>Oracle Document ID</Label>
                <Field
                  value={oracleDocId}
                  onChangeText={setOracleDocId}
                  placeholder="Enter Oracle Document ID"
                  keyboardType="number-pad"
                />
                {oracleMode === "set" ? (
                  <>
                    <Label>CoinGecko IDs (Read-only)</Label>
                    <ReadOnlyField value={COIN_GECKO_IDS_DISPLAY} />
                    <Label>VS Currency (Read-only)</Label>
                    <ReadOnlyField value={VS_CURRENCY_DISPLAY} />
                  </>
                ) : null}
              </>
            ) : null}

            {action === "manage_oracle" ? (
              <View className="mt-6 flex-row gap-2">
                <TouchableOpacity
                  onPress={close}
                  disabled={isPending}
                  className="flex-1 items-center rounded-2xl border border-white/15 py-4"
                >
                  <Text className="text-base font-semibold text-white">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onSubmit}
                  disabled={isPending || !oracleDocId.trim()}
                  className={`flex-1 items-center rounded-2xl py-4 ${
                    isPending || !oracleDocId.trim() ? "bg-white/15" : "bg-primary"
                  }`}
                >
                  {isPending ? (
                    <ActivityIndicator />
                  ) : (
                    <Text className="text-base font-semibold text-black">
                      {submitLabel(action, oracleMode)}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={onSubmit}
                disabled={isPending}
                className={`mt-6 items-center rounded-2xl py-4 ${isPending ? "bg-white/15" : "bg-primary"}`}
              >
                {isPending ? (
                  <ActivityIndicator />
                ) : (
                  <Text className="text-base font-semibold text-black">
                    {submitLabel(action, oracleMode)}
                  </Text>
                )}
              </TouchableOpacity>
            )}
        </>
      )}
    </AppSheet>
  );
}

function trustlineSuccessMessage(currency: string, result: SetTrustlineResult): string {
  if (result.trustlineAlreadyExisted) {
    return `Trustline for ${currency} already exists. No sign-in bonus issued.`;
  }

  if (result.welcomeBonusPending) {
    return (
      `Trustline for ${currency} set successfully!\n\n` +
      `Your sign-in bonus is being sent and should appear in your balance shortly.`
    );
  }

  const bonus = result.welcomeBonus;
  if (!bonus) {
    return result.message || `Trustline for ${currency} set successfully.`;
  }

  if (bonus.skipped) {
    return (
      `Trustline for ${currency} set successfully.\n\n` +
      `Sign-in bonus could not be issued: ${bonus.skipReason || "unknown reason"}`
    );
  }

  const amount = Number(bonus.amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
  const usd = bonus.usdValue.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const price = bonus.pricePerUnitUSD.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });

  return (
    `Trustline for ${currency} set successfully!\n\n` +
    `Sign-in bonus: you received ${amount} ${bonus.currency} ` +
    `(≈ $${usd} USD) at $${price}/${bonus.currency}.`
  );
}

function descriptionFor(action: WalletActionKey | null): string {
  switch (action) {
    case "set_trustline":
      return "Add a trustline so this wallet can hold an issued token.";
    case "authorize_deposit":
      return "Pre-authorize an account to deposit into this wallet (DepositPreauth).";
    case "authorize_trustline":
      return "Authorize a holder's trustline so they can receive this issued token.";
    case "clawback":
      return "Revoke previously issued tokens from a holder back to the issuer.";
    case "deep_freeze":
      return "Freeze, deep-freeze, or unfreeze a holder's trustline.";
    case "manage_oracle":
      return "Set live crypto prices on-chain from CoinGecko, or delete an existing oracle.";
    default:
      return "";
  }
}

function counterpartyLabel(action: WalletActionKey | null): string {
  if (action === "authorize_deposit") return "Authorized account";
  return "Holder";
}

function submitLabel(action: WalletActionKey | null, oracleMode: OracleMode): string {
  if (action === "manage_oracle") return oracleMode === "delete" ? "Delete Oracle" : "Set Oracle";
  if (action) return WALLET_ACTION_TITLES[action];
  return "Submit";
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text className="mb-2 text-xs text-white/60">{children}</Text>;
}

function Field(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor="#666"
      autoCorrect={false}
      {...props}
      className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white"
    />
  );
}

function ReadOnlyField({ value }: { value: string }) {
  return (
    <View className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 opacity-60">
      <Text className="text-base text-white">{value}</Text>
    </View>
  );
}

function SegmentedControl({
  value,
  onChange,
  options,
  small,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
  small?: boolean;
}) {
  return (
    <View className={`mb-4 flex-row rounded-full bg-white/10 p-1`}>
      {options.map((o) => {
        const active = value === o.id;
        return (
          <TouchableOpacity
            key={o.id}
            onPress={() => onChange(o.id)}
            className={`${
              small ? "rounded-full px-3 py-1" : "flex-1 items-center rounded-full py-2"
            } ${active ? "bg-primary/20" : ""}`}
          >
            <Text
              className={`${small ? "text-xs" : "text-sm"} ${active ? "font-semibold text-primary" : "text-white/60"}`}
            >
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
