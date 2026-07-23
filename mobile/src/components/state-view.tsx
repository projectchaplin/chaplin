import { ActivityIndicator, Text, View } from "react-native";

import { NativeButton } from "@/components/native-button";
import { colors, spacing } from "@/theme/colors";

export function LoadingView({ label = "Loading Chaplin…" }: { label?: string }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.md,
        padding: spacing.xl,
        backgroundColor: colors.background,
      }}
    >
      <ActivityIndicator color={colors.accent} />
      <Text selectable style={{ color: colors.secondaryLabel }}>
        {label}
      </Text>
    </View>
  );
}

export function EmptyView({
  title,
  message,
  action,
  onAction,
}: {
  title: string;
  message: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View
      style={{
        minHeight: 240,
        justifyContent: "center",
        gap: spacing.sm,
        padding: spacing.lg,
      }}
    >
      <Text
        selectable
        style={{ color: colors.label, fontSize: 24, fontWeight: "800" }}
      >
        {title}
      </Text>
      <Text
        selectable
        style={{ color: colors.secondaryLabel, fontSize: 15, lineHeight: 22 }}
      >
        {message}
      </Text>
      {action && onAction ? (
        <View style={{ paddingTop: spacing.sm }}>
          <NativeButton onPress={onAction}>{action}</NativeButton>
        </View>
      ) : null}
    </View>
  );
}
