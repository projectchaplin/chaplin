import {
  type KeyboardTypeOptions,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors, radii, spacing } from "@/theme/colors";

type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoComplete?: React.ComponentProps<typeof TextInput>["autoComplete"];
  hint?: string;
  maxLength?: number;
};

export function FormField({
  label,
  hint,
  multiline,
  ...props
}: FormFieldProps) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text
        selectable
        style={{
          color: colors.secondaryLabel,
          fontSize: 12,
          fontWeight: "700",
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <TextInput
        {...props}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        placeholderTextColor={colors.secondaryLabel}
        selectionColor={colors.accent}
        style={{
          minHeight: multiline ? 118 : 50,
          borderRadius: radii.md,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: colors.separator,
          backgroundColor: colors.elevated,
          color: colors.label,
          paddingHorizontal: spacing.md,
          paddingVertical: multiline ? spacing.md : spacing.sm,
          fontSize: 16,
          lineHeight: 23,
        }}
      />
      {hint ? (
        <Text selectable style={{ color: colors.secondaryLabel, fontSize: 12 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
