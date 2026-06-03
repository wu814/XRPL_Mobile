import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, type StyleProp, type ViewStyle } from "react-native";

interface DexRefreshButtonProps {
  refreshing: boolean;
  onPress: () => void;
  disabled?: boolean;
  size?: number;
  color?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function DexRefreshButton({
  refreshing,
  onPress,
  disabled = false,
  size = 18,
  color = "#8EDFE2",
  accessibilityLabel = "Refresh",
  style,
}: DexRefreshButtonProps) {
  const isDisabled = disabled || refreshing;
  const spin = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (refreshing) {
      spin.setValue(0);
      loopRef.current = Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 700,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loopRef.current.start();
    } else {
      loopRef.current?.stop();
      spin.setValue(0);
    }
    return () => loopRef.current?.stop();
  }, [refreshing, spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      hitSlop={8}
      accessibilityLabel={accessibilityLabel}
      style={[style, isDisabled && !refreshing ? { opacity: 0.4 } : undefined]}
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <MaterialIcons name="refresh" size={size} color={isDisabled && !refreshing ? "#666" : color} />
      </Animated.View>
    </Pressable>
  );
}
