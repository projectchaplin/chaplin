import { Text, View } from "react-native";

import { colors, spacing } from "@/theme/colors";

export function SectionHeading({
  eyebrow,
  title,
  detail,
}: {
  eyebrow?: string;
  title: string;
  detail?: string;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      {eyebrow ? (
        <Text
          selectable
          style={{
            color: colors.accent,
            fontSize: 11,
            fontWeight: "800",
            letterSpacing: 1.5,
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </Text>
      ) : null}
      <Text
        selectable
        style={{
          color: colors.label,
          fontSize: 27,
          lineHeight: 31,
          fontWeight: "800",
          letterSpacing: -0.6,
        }}
      >
        {title}
      </Text>
      {detail ? (
        <Text
          selectable
          style={{ color: colors.secondaryLabel, fontSize: 15, lineHeight: 22 }}
        >
          {detail}
        </Text>
      ) : null}
    </View>
  );
}
