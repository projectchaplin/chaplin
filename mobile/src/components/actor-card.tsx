import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

import type { Character } from "@/domain/types";
import { colors, radii, spacing } from "@/theme/colors";

export function ActorCard({
  character,
  onPress,
  selected = false,
}: {
  character: Character;
  onPress?: () => void;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.sm,
        borderRadius: radii.md,
        borderCurve: "continuous",
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.accent : colors.separator,
        backgroundColor: colors.elevated,
        opacity: pressed ? 0.72 : 1,
      })}
    >
      {character.imageUrl ? (
        <Image
          source={{ uri: character.imageUrl }}
          contentFit="cover"
          transition={180}
          style={{ width: 68, height: 68, borderRadius: 16 }}
        />
      ) : (
        <View
          style={{
            width: 68,
            height: 68,
            borderRadius: 16,
            backgroundColor: `hsl(${character.avatarHue}, 62%, 34%)`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: colors.white, fontSize: 24, fontWeight: "800" }}>
            {character.name.slice(0, 1)}
          </Text>
        </View>
      )}
      <View style={{ flex: 1, gap: 3 }}>
        <Text
          selectable
          numberOfLines={1}
          style={{ color: colors.label, fontSize: 17, fontWeight: "700" }}
        >
          {character.name}
        </Text>
        <Text
          selectable
          numberOfLines={2}
          style={{ color: colors.secondaryLabel, fontSize: 13, lineHeight: 18 }}
        >
          {character.tagline}
        </Text>
      </View>
      {selected ? (
        <Text style={{ color: colors.accent, fontSize: 20 }}>✓</Text>
      ) : null}
    </Pressable>
  );
}
