import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";

const PRESETS = [0, 0.5, 1];

interface Props {
  slippage: number;
  onChange: (value: number) => void;
}

export function AmmSlippageControl({ slippage, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");

  return (
    <View className="mb-3">
      <TouchableOpacity onPress={() => setOpen((o) => !o)} className="self-end px-2 py-1">
        <Text className="text-xs text-white/60">Slippage: {slippage}%</Text>
      </TouchableOpacity>
      {open ? (
        <View className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3">
          <View className="mb-2 flex-row gap-2">
            {PRESETS.map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => onChange(p)}
                className={`rounded-full px-3 py-1 ${slippage === p ? "bg-primary" : "bg-white/10"}`}
              >
                <Text className={`text-xs ${slippage === p ? "text-black" : "text-white/80"}`}>{p}%</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            value={custom}
            onChangeText={setCustom}
            placeholder="Custom %"
            placeholderTextColor="#666"
            keyboardType="decimal-pad"
            className="rounded-lg border border-white/15 px-3 py-2 text-white"
          />
          <TouchableOpacity
            onPress={() => {
              const n = Number(custom);
              if (!Number.isNaN(n) && n >= 0) onChange(n);
            }}
            className="mt-2 items-center rounded-lg bg-white/10 py-2"
          >
            <Text className="text-xs text-white">Apply custom</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
