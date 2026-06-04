import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  useSendCrossCurrency,
  useSendIou,
  useSendXrp,
} from "@/src/hooks/useTransactions";
import { useAdminWallets } from "@/src/hooks/useAdminWallets";
import { getAmmInfoByCurrencies, listAmms, type AmmInfo } from "@/src/api/amm";
import { useAuthStore } from "@/src/stores/auth";
import { AppSheet } from "@/src/components/ui/AppSheet";
import { CurrencySelectorList } from "@/src/features/payments/CurrencySelectorSheet";
import { CurrencyIconImage } from "@/src/features/shared/CurrencyIconImage";
import {
  calculateEstimateOutput,
  calculateExactAMMInput,
} from "@/src/lib/ammCalculations";

interface SendSheetProps {
  visible: boolean;
  onClose: () => void;
  walletAddress: string | null;
}

type PaymentMode = "direct" | "convertable";
type RecipientMode = "username" | "address";
type ConvertInputType = "exact_input" | "exact_output";

export function SendSheet({ visible, onClose, walletAddress }: SendSheetProps) {
  const role = useAuthStore((s) => s.profile?.role);
  const isAdmin = role === "ADMIN";

  const [paymentMode, setPaymentMode] = useState<PaymentMode>("direct");
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("username");

  const [recipientUsername, setRecipientUsername] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [destinationTag, setDestinationTag] = useState("");

  // Direct fields
  const [directCurrency, setDirectCurrency] = useState("USD");
  const [directAmount, setDirectAmount] = useState("");

  // Convertable fields
  const [sendCurrency, setSendCurrency] = useState("USD");
  const [receiveCurrency, setReceiveCurrency] = useState("XRP");
  const [sendAmount, setSendAmount] = useState("");
  const [receiveAmount, setReceiveAmount] = useState("");
  const [convertInputType, setConvertInputType] =
    useState<ConvertInputType>("exact_input");
  const [slippage] = useState(1);

  const [pickerFor, setPickerFor] = useState<"direct" | "send" | "receive" | null>(
    null,
  );

  const sendXrpMut = useSendXrp();
  const sendIouMut = useSendIou();
  const sendCrossMut = useSendCrossCurrency();

  const adminWalletsQuery = useAdminWallets(isAdmin && visible);
  const ammListQuery = useQuery({
    queryKey: ["amm", "list"],
    queryFn: listAmms,
    enabled: visible,
  });

  const issuer = adminWalletsQuery.data?.find((w) => w.wallet_type === "issuer");

  // Live AMM lookup for convertable mode.
  const [ammInfo, setAmmInfo] = useState<AmmInfo | null>(null);
  const [loadingAmm, setLoadingAmm] = useState(false);
  const [ammError, setAmmError] = useState<string | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || paymentMode !== "convertable") return;
    if (sendCurrency === receiveCurrency) {
      setAmmInfo(null);
      setAmmError(null);
      return;
    }
    let cancelled = false;
    setLoadingAmm(true);
    setAmmError(null);
    setAmmInfo(null);
    getAmmInfoByCurrencies({ sellCurrency: sendCurrency, buyCurrency: receiveCurrency })
      .then((data) => {
        if (!cancelled) setAmmInfo(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setAmmError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingAmm(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, paymentMode, sendCurrency, receiveCurrency]);

  useEffect(() => {
    if (!visible) setPickerFor(null);
  }, [visible]);

  useEffect(() => {
    if (paymentMode !== "convertable") return;
    if (!ammInfo) {
      if (convertInputType === "exact_input") setReceiveAmount("");
      else setSendAmount("");
      return;
    }
    setCalcError(null);

    const pair = getPoolPair(ammInfo, sendCurrency);
    if (!pair) {
      setCalcError("Currency not in pool");
      return;
    }
    const { poolIn, poolOut } = pair;
    const fee = (ammInfo.tradingFee || 0) / 100000;

    if (convertInputType === "exact_input") {
      const n = Number(sendAmount);
      if (!Number.isFinite(n) || n <= 0) {
        setReceiveAmount("");
        return;
      }
      const r = calculateEstimateOutput(poolIn, poolOut, n, fee);
      if (r.success && r.estimatedOutput !== undefined) {
        setReceiveAmount(r.estimatedOutput.toFixed(6));
      } else {
        setCalcError(r.error || "Calculation failed");
        setReceiveAmount("");
      }
    } else {
      const n = Number(receiveAmount);
      if (!Number.isFinite(n) || n <= 0) {
        setSendAmount("");
        return;
      }
      const r = calculateExactAMMInput(poolIn, poolOut, n, slippage / 100, fee);
      if (r.success && r.inputWithSlippage !== undefined) {
        setSendAmount(r.inputWithSlippage.toFixed(6));
      } else {
        setCalcError(r.error || "Calculation failed");
        setSendAmount("");
      }
    }
  }, [
    paymentMode,
    ammInfo,
    sendAmount,
    receiveAmount,
    convertInputType,
    sendCurrency,
    slippage,
  ]);

  const recipient =
    recipientMode === "username" ? recipientUsername.trim() : recipientAddress.trim();

  const reset = () => {
    setDirectAmount("");
    setSendAmount("");
    setReceiveAmount("");
    setRecipientUsername("");
    setRecipientAddress("");
    setDestinationTag("");
    setAmmInfo(null);
    setAmmError(null);
    setCalcError(null);
  };

  const issuerAddressForCurrency = (currency: string): string | null => {
    if (currency === "XRP") return null;
    if (issuer) return issuer.classic_address;
    const fromAmm = ammListQuery.data?.find(
      (a) => a.currency1 === currency || a.currency2 === currency,
    );
    return fromAmm?.issuer_address ?? null;
  };

  const onSendDirect = async () => {
    if (!walletAddress) return Alert.alert("No wallet", "Create a wallet first.");
    if (!recipient) return Alert.alert("Missing recipient");
    const amt = Number(directAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return Alert.alert("Invalid amount", "Enter an amount greater than zero.");
    }
    const tag = destinationTag.trim() ? Number(destinationTag.trim()) : undefined;

    try {
      // Admin → send the IOU from the selected wallet (mirrors xrpl_mvp: the
      // issuer wallet mints new tokens, the treasury wallet distributes them).
      if (isAdmin && directCurrency !== "XRP") {
        const issuerAddr = issuerAddressForCurrency(directCurrency);
        if (!issuerAddr) {
          return Alert.alert(
            "Issuer unknown",
            `No issuer found for ${directCurrency}. Ask an admin to create an issuer wallet or create an AMM first.`,
          );
        }
        await sendIouMut.mutateAsync({
          walletAddress,
          ...(recipientMode === "username"
            ? { destinationUsername: recipient }
            : { destination: recipient }),
          currency: directCurrency,
          issuer: issuerAddr,
          value: amt.toString(),
        });
      } else if (directCurrency === "XRP") {
        await sendXrpMut.mutateAsync({
          walletAddress,
          ...(recipientMode === "username"
            ? { destinationUsername: recipient }
            : { destination: recipient }),
          xrpAmount: amt,
          destinationTag: tag,
        });
      } else {
        const issuerAddr = issuerAddressForCurrency(directCurrency);
        if (!issuerAddr) {
          return Alert.alert(
            "Issuer unknown",
            `No issuer found for ${directCurrency}. Ask the admin to create an issuer wallet or create an AMM first.`,
          );
        }
        await sendIouMut.mutateAsync({
          walletAddress,
          ...(recipientMode === "username"
            ? { destinationUsername: recipient }
            : { destination: recipient }),
          currency: directCurrency,
          issuer: issuerAddr,
          value: amt.toString(),
        });
      }

      Alert.alert("Payment sent");
      reset();
      onClose();
    } catch (err) {
      Alert.alert("Send failed", (err as Error).message);
    }
  };

  const onSendConvertable = async () => {
    if (!walletAddress) return Alert.alert("No wallet", "Create a wallet first.");
    if (!recipient) return Alert.alert("Missing recipient");
    if (sendCurrency === receiveCurrency) {
      return Alert.alert("Same currency", "Pick different send / receive currencies.");
    }

    const issuerAddr =
      issuerAddressForCurrency(sendCurrency) ??
      issuerAddressForCurrency(receiveCurrency);
    if (!issuerAddr) {
      return Alert.alert(
        "Issuer unknown",
        "No issuer found for these currencies. Ask the admin to create an issuer wallet or create an AMM first.",
      );
    }

    const tag = destinationTag.trim() ? Number(destinationTag.trim()) : undefined;
    const send = Number(sendAmount);
    const recv = Number(receiveAmount);

    if (convertInputType === "exact_input" && (!Number.isFinite(send) || send <= 0)) {
      return Alert.alert("Invalid amount", "Enter a send amount greater than zero.");
    }
    if (convertInputType === "exact_output" && (!Number.isFinite(recv) || recv <= 0)) {
      return Alert.alert("Invalid amount", "Enter a receive amount greater than zero.");
    }

    try {
      await sendCrossMut.mutateAsync({
        walletAddress,
        ...(recipientMode === "username"
          ? { destinationUsername: recipient }
          : { destination: recipient }),
        sendCurrency,
        receiveCurrency,
        issuerAddress: issuerAddr,
        mode: convertInputType,
        sendAmount: convertInputType === "exact_input" ? send : send || undefined,
        exactOutputAmount: convertInputType === "exact_output" ? recv : undefined,
        slippagePercent: slippage,
        destinationTag: tag,
      });

      Alert.alert("Convertable payment sent");
      reset();
      onClose();
    } catch (err) {
      Alert.alert("Send failed", (err as Error).message);
    }
  };

  const isPending =
    sendXrpMut.isPending ||
    sendIouMut.isPending ||
    sendCrossMut.isPending;

  const canSendDirect = !!recipient && !!directAmount;
  const canSendConvertable =
    !!recipient &&
    sendCurrency !== receiveCurrency &&
    (Number(sendAmount) > 0 || Number(receiveAmount) > 0);

  const pickerOpen = pickerFor !== null;
  const dismissPicker = () => setPickerFor(null);
  const pickerExclude =
    pickerFor === "send"
      ? receiveCurrency
      : pickerFor === "receive"
        ? sendCurrency
        : undefined;
  const pickerSelected =
    pickerFor === "direct"
      ? directCurrency
      : pickerFor === "send"
        ? sendCurrency
        : pickerFor === "receive"
          ? receiveCurrency
          : undefined;

  const onPickerSelect = (c: string) => {
    if (pickerFor === "direct") setDirectCurrency(c);
    else if (pickerFor === "send") setSendCurrency(c);
    else if (pickerFor === "receive") setReceiveCurrency(c);
    setPickerFor(null);
  };

  return (
    <AppSheet
      visible={visible}
      onClose={pickerOpen ? dismissPicker : onClose}
      title={pickerOpen ? "Select Currency" : "Send"}
      keyboardAvoiding={!pickerOpen}
      headerExtra={
        pickerOpen ? undefined : (
          <SegmentedControl
            value={paymentMode}
            onChange={(v) => setPaymentMode(v as PaymentMode)}
            options={[
              { id: "direct", label: "Direct" },
              { id: "convertable", label: "Convertable" },
            ]}
          />
        )
      }
    >
      {pickerOpen ? (
        <CurrencySelectorList
          onSelect={onPickerSelect}
          exclude={pickerExclude}
          selected={pickerSelected}
        />
      ) : (
        <>
            <Text className="mb-3 text-xs text-white/40">
              {paymentMode === "direct"
                ? "Trustline-to-trustline payment"
                : "Cross-currency payment via AMM"}
            </Text>

            <View className="mb-4 self-end">
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

            <View className="mb-4">
              <TextInput
                value={
                  recipientMode === "username" ? recipientUsername : recipientAddress
                }
                onChangeText={(t) => {
                  if (recipientMode === "username") setRecipientUsername(t);
                  else setRecipientAddress(t);
                }}
                placeholder={
                  recipientMode === "username"
                    ? "Recipient Username"
                    : "Recipient Address"
                }
                placeholderTextColor="#666"
                autoCapitalize="none"
                autoCorrect={false}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white"
              />
            </View>

            {paymentMode === "direct" ? (
              <DirectForm
                currency={directCurrency}
                amount={directAmount}
                destinationTag={destinationTag}
                onCurrencyPress={() => setPickerFor("direct")}
                onAmountChange={setDirectAmount}
                onTagChange={setDestinationTag}
              />
            ) : (
              <ConvertableForm
                sendCurrency={sendCurrency}
                receiveCurrency={receiveCurrency}
                sendAmount={sendAmount}
                receiveAmount={receiveAmount}
                destinationTag={destinationTag}
                loadingAmm={loadingAmm}
                ammError={ammError}
                ammInfo={ammInfo}
                calcError={calcError}
                onSendCurrencyPress={() => setPickerFor("send")}
                onReceiveCurrencyPress={() => setPickerFor("receive")}
                onSendAmountChange={(t) => {
                  setConvertInputType("exact_input");
                  setSendAmount(t);
                }}
                onReceiveAmountChange={(t) => {
                  setConvertInputType("exact_output");
                  setReceiveAmount(t);
                }}
                onTagChange={setDestinationTag}
                inputType={convertInputType}
              />
            )}

            <TouchableOpacity
              onPress={paymentMode === "direct" ? onSendDirect : onSendConvertable}
              disabled={
                isPending ||
                !(paymentMode === "direct" ? canSendDirect : canSendConvertable)
              }
              className={`mt-6 items-center rounded-2xl py-4 ${
                (paymentMode === "direct" ? canSendDirect : canSendConvertable) &&
                !isPending
                  ? "bg-primary"
                  : "bg-white/15"
              }`}
            >
              {isPending ? (
                <ActivityIndicator />
              ) : (
                <Text
                  className={`text-base font-semibold ${
                    (paymentMode === "direct" ? canSendDirect : canSendConvertable)
                      ? "text-black"
                      : "text-white/40"
                  }`}
                >
                  {paymentMode === "direct" ? "Send" : "Send Convertable"}
                </Text>
              )}
            </TouchableOpacity>
        </>
      )}
    </AppSheet>
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
    <View
      className={`flex-row rounded-full bg-white/10 ${small ? "p-1" : "mt-4 p-1"}`}
    >
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
              className={`${small ? "text-xs" : "text-sm"} ${
                active ? "font-semibold text-primary" : "text-white/60"
              }`}
            >
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function DirectForm({
  currency,
  amount,
  destinationTag,
  onCurrencyPress,
  onAmountChange,
  onTagChange,
}: {
  currency: string;
  amount: string;
  destinationTag: string;
  onCurrencyPress: () => void;
  onAmountChange: (t: string) => void;
  onTagChange: (t: string) => void;
}) {
  return (
    <>
      <Text className="mb-2 text-xs text-white/60">Currency</Text>
      <TouchableOpacity
        onPress={onCurrencyPress}
        className="mb-4 flex-row items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
      >
        <View className="flex-row items-center">
          <CurrencyIconImage currency={currency} size={28} />
          <Text className="ml-2 text-base font-semibold text-white">{currency}</Text>
        </View>
        <Text className="text-white/40">▾</Text>
      </TouchableOpacity>

      <Text className="mb-2 text-xs text-white/60">Amount</Text>
      <TextInput
        value={amount}
        onChangeText={onAmountChange}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor="#666"
        className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white"
      />

      <Text className="mb-2 text-xs text-white/60">Destination Tag (optional)</Text>
      <TextInput
        value={destinationTag}
        onChangeText={onTagChange}
        keyboardType="number-pad"
        placeholder="Enter destination tag…"
        placeholderTextColor="#666"
        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white"
      />
    </>
  );
}

function ConvertableForm({
  sendCurrency,
  receiveCurrency,
  sendAmount,
  receiveAmount,
  destinationTag,
  loadingAmm,
  ammError,
  ammInfo,
  calcError,
  onSendCurrencyPress,
  onReceiveCurrencyPress,
  onSendAmountChange,
  onReceiveAmountChange,
  onTagChange,
  inputType,
}: {
  sendCurrency: string;
  receiveCurrency: string;
  sendAmount: string;
  receiveAmount: string;
  destinationTag: string;
  loadingAmm: boolean;
  ammError: string | null;
  ammInfo: AmmInfo | null;
  calcError: string | null;
  onSendCurrencyPress: () => void;
  onReceiveCurrencyPress: () => void;
  onSendAmountChange: (t: string) => void;
  onReceiveAmountChange: (t: string) => void;
  onTagChange: (t: string) => void;
  inputType: ConvertInputType;
}) {
  return (
    <>
      {loadingAmm ? (
        <View className="mb-3 flex-row items-center rounded-full border border-blue-500/40 bg-blue-900/20 px-3 py-2">
          <ActivityIndicator color="#60a5fa" />
          <Text className="ml-2 text-sm text-blue-400">Loading AMM pool data…</Text>
        </View>
      ) : null}

      {ammError ? (
        <View className="mb-3 rounded-full border border-red-500/40 bg-red-900/20 px-3 py-2">
          <Text className="text-sm text-red-400">{ammError}</Text>
        </View>
      ) : null}

      {ammInfo && !loadingAmm ? (
        <View className="mb-3 rounded-full border border-green-500/40 bg-green-900/20 px-3 py-2">
          <Text className="text-sm text-green-400">
            AMM Pool: {ammInfo.formattedAmount1.currency}/
            {ammInfo.formattedAmount2.currency} ({(ammInfo.tradingFee / 1000).toFixed(3)}%
            fee)
          </Text>
        </View>
      ) : null}

      {calcError ? (
        <View className="mb-3 rounded-full border border-red-500/40 bg-red-900/20 px-3 py-2">
          <Text className="text-sm text-red-400">Calc: {calcError}</Text>
        </View>
      ) : null}

      <Text className="mb-2 text-xs text-white/60">Send</Text>
      <View className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={onSendCurrencyPress}
            className="flex-row items-center rounded-full bg-white/10 px-3 py-2"
          >
            <CurrencyIconImage currency={sendCurrency} size={24} />
            <Text className="ml-2 mr-1 text-base font-semibold text-white">
              {sendCurrency}
            </Text>
            <Text className="text-white/60">▾</Text>
          </TouchableOpacity>
          <TextInput
            value={sendAmount}
            onChangeText={onSendAmountChange}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#666"
            editable={inputType === "exact_input" || sendAmount === ""}
            className="flex-1 text-right text-2xl font-light text-white"
          />
        </View>
      </View>

      <Text className="mb-2 text-xs text-white/60">Receive</Text>
      <View className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={onReceiveCurrencyPress}
            className="flex-row items-center rounded-full bg-white/10 px-3 py-2"
          >
            <CurrencyIconImage currency={receiveCurrency} size={24} />
            <Text className="ml-2 mr-1 text-base font-semibold text-white">
              {receiveCurrency}
            </Text>
            <Text className="text-white/60">▾</Text>
          </TouchableOpacity>
          <TextInput
            value={receiveAmount}
            onChangeText={onReceiveAmountChange}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#666"
            editable={inputType === "exact_output" || receiveAmount === ""}
            className="flex-1 text-right text-2xl font-light text-white"
          />
        </View>
      </View>

      <Text className="mb-2 text-xs text-white/60">Destination Tag (optional)</Text>
      <TextInput
        value={destinationTag}
        onChangeText={onTagChange}
        keyboardType="number-pad"
        placeholder="Enter destination tag…"
        placeholderTextColor="#666"
        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white"
      />
    </>
  );
}

function getPoolPair(amm: AmmInfo, sendCurrency: string): { poolIn: number; poolOut: number } | null {
  const a1 = amm.formattedAmount1;
  const a2 = amm.formattedAmount2;
  if (a1.currency === sendCurrency) {
    return { poolIn: parseFloat(a1.value), poolOut: parseFloat(a2.value) };
  }
  if (a2.currency === sendCurrency) {
    return { poolIn: parseFloat(a2.value), poolOut: parseFloat(a1.value) };
  }
  return null;
}
