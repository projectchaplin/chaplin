import { Button, Host } from "@expo/ui";
import * as Haptics from "expo-haptics";
import { type PropsWithChildren } from "react";
import { ActivityIndicator, View } from "react-native";

import { colors, radii } from "@/theme/colors";

type NativeButtonProps = PropsWithChildren<{
  onPress: () => void;
  variant?: "filled" | "outlined" | "text";
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
}>;

export function NativeButton({
  children,
  onPress,
  variant = "filled",
  disabled,
  loading,
  testID,
}: NativeButtonProps) {
  const handlePress = () => {
    if (disabled || loading) return;
    if (process.env.EXPO_OS === "ios") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  return (
    <Host matchContents style={{ opacity: disabled ? 0.45 : 1 }}>
      <Button
        testID={testID}
        variant={variant}
        onPress={handlePress}
        style={{
          height: 50,
          width: "100%",
          borderRadius: radii.md,
          backgroundColor: variant === "filled" ? colors.accent : undefined,
        }}
      >
        {loading ? (
          <View style={{ minHeight: 22, justifyContent: "center" }}>
            <ActivityIndicator color={colors.white} />
          </View>
        ) : (
          children
        )}
      </Button>
    </Host>
  );
}
