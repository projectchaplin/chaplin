import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { SectionHeading } from "@/components/section-heading";
import { colors, radii, spacing } from "@/theme/colors";

function CreationPath({
  number,
  title,
  detail,
  accent,
  onPress,
}: {
  number: string;
  title: string;
  detail: string;
  accent: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 190,
        justifyContent: "space-between",
        gap: spacing.lg,
        padding: spacing.lg,
        borderRadius: radii.lg,
        borderCurve: "continuous",
        backgroundColor: colors.elevated,
        borderWidth: 1,
        borderColor: colors.separator,
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <Text
        style={{
          color: accent,
          fontSize: 12,
          fontWeight: "900",
          letterSpacing: 1.5,
        }}
      >
        {number}
      </Text>
      <View style={{ gap: spacing.xs }}>
        <Text
          selectable
          style={{ color: colors.label, fontSize: 27, fontWeight: "800" }}
        >
          {title}
        </Text>
        <Text
          selectable
          style={{ color: colors.secondaryLabel, fontSize: 15, lineHeight: 22 }}
        >
          {detail}
        </Text>
      </View>
    </Pressable>
  );
}

export function CreateScreen() {
  const router = useRouter();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        gap: spacing.xl,
        padding: spacing.md,
        paddingBottom: 120,
      }}
    >
      <SectionHeading
        eyebrow="Two tools, one performance"
        title="Start with the actor or the moment."
        detail="Both paths meet in a five-second Spark you can refine, generate, and share."
      />
      <CreationPath
        number="01 · Identity"
        title="Create an AI actor"
        detail="Give Chaplin a human brief. Lock personality, voice direction, visual identity, and the production bible."
        accent={colors.cyan}
        onPress={() => router.push("/actor/new")}
      />
      <CreationPath
        number="02 · Performance"
        title="Write a Spark"
        detail="Choose an actor, describe one charged moment, and turn it into a shootable five-second performance."
        accent={colors.accent}
        onPress={() => router.push("/spark/new")}
      />
    </ScrollView>
  );
}
