import { useHeaderHeight } from "@react-navigation/elements";

/** Stack header height for KeyboardAvoidingView; 0 on tab screens without a header. */
export function useKeyboardVerticalOffset(extra = 0) {
  const headerHeight = useHeaderHeight();
  return headerHeight + extra;
}
