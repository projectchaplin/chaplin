import { Color } from "expo-router";
import { Platform } from "react-native";

export const colors = {
  background: Platform.select({
    ios: Color.ios.systemBackground,
    android: Color.android.dynamic.surface,
    default: "#120d18",
  })!,
  elevated: Platform.select({
    ios: Color.ios.secondarySystemBackground,
    android: Color.android.dynamic.surfaceContainer,
    default: "#1d1625",
  })!,
  grouped: Platform.select({
    ios: Color.ios.systemGroupedBackground,
    android: Color.android.dynamic.surfaceContainerLow,
    default: "#17111f",
  })!,
  label: Platform.select({
    ios: Color.ios.label,
    android: Color.android.dynamic.onSurface,
    default: "#f8f4fb",
  })!,
  secondaryLabel: Platform.select({
    ios: Color.ios.secondaryLabel,
    android: Color.android.dynamic.onSurfaceVariant,
    default: "#b9afc2",
  })!,
  separator: Platform.select({
    ios: Color.ios.separator,
    android: Color.android.dynamic.outlineVariant,
    default: "rgba(255,255,255,0.12)",
  })!,
  accent: "#f24c72",
  accentSoft: "#ff8ba6",
  cyan: "#20d9d2",
  purple: "#776dff",
  success: "#45d483",
  warning: "#f6b84a",
  danger: "#ff5a66",
  white: "#ffffff",
  black: "#000000",
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 44,
};

export const radii = {
  sm: 12,
  md: 18,
  lg: 26,
  pill: 999,
};
