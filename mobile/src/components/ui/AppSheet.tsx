import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface AppSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Rendered below the title row (e.g. segmented controls). */
  headerExtra?: ReactNode;
  keyboardAvoiding?: boolean;
  scrollable?: boolean;
  children: ReactNode;
}

export function AppSheet({
  visible,
  onClose,
  title,
  headerExtra,
  keyboardAvoiding = false,
  scrollable = true,
  children,
}: AppSheetProps) {
  const body = scrollable ? (
    <ScrollView contentContainerClassName="px-6 py-5" keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View className="flex-1 px-6 py-5">{children}</View>
  );

  const content = (
    <>
      <View className="border-b border-white/10 px-6 py-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-bold text-white">{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Text className="text-white/60">Close</Text>
          </TouchableOpacity>
        </View>
        {headerExtra}
      </View>
      {body}
    </>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView className="flex-1 bg-black">
        {keyboardAvoiding ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            className="flex-1"
          >
            {content}
          </KeyboardAvoidingView>
        ) : (
          content
        )}
      </SafeAreaView>
    </Modal>
  );
}
