import { forwardRef } from "react";
import { ScrollView, type ScrollViewProps } from "react-native";

export const AppScrollView = forwardRef<ScrollView, ScrollViewProps>(function AppScrollView(
  {
    keyboardShouldPersistTaps = "handled",
    keyboardDismissMode = "on-drag",
    automaticallyAdjustKeyboardInsets = true,
    ...props
  },
  ref,
) {
  return (
    <ScrollView
      ref={ref}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      keyboardDismissMode={keyboardDismissMode}
      automaticallyAdjustKeyboardInsets={automaticallyAdjustKeyboardInsets}
      {...props}
    />
  );
});
