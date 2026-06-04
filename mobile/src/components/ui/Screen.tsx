import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView, type SafeAreaViewProps } from "react-native-safe-area-context";
import { useKeyboardVerticalOffset } from "@/src/hooks/useKeyboardVerticalOffset";

interface ScreenProps extends Omit<SafeAreaViewProps, "children"> {
  children: ReactNode;
  keyboardAvoiding?: boolean;
  keyboardOffsetExtra?: number;
}

export function Screen({
  children,
  className = "flex-1 bg-black",
  keyboardAvoiding = true,
  keyboardOffsetExtra = 0,
  ...safeAreaProps
}: ScreenProps) {
  const offset = useKeyboardVerticalOffset(keyboardOffsetExtra);

  const inner = keyboardAvoiding ? (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
      keyboardVerticalOffset={offset}
    >
      {children}
    </KeyboardAvoidingView>
  ) : (
    children
  );

  return (
    <SafeAreaView className={className} {...safeAreaProps}>
      {inner}
    </SafeAreaView>
  );
}
