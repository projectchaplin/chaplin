import { Redirect } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";

import { NativeButton } from "@/components/native-button";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { colors, radii, spacing } from "@/theme/colors";

export function SettingsScreen() {
  const { session, signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);
  if (!session) return <Redirect href="/auth" />;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        gap: spacing.lg,
        padding: spacing.md,
        paddingBottom: 80,
      }}
    >
      <View
        style={{
          gap: spacing.xs,
          padding: spacing.md,
          borderRadius: radii.md,
          backgroundColor: colors.elevated,
        }}
      >
        <Text selectable style={{ color: colors.label, fontWeight: "800" }}>
          Creator account
        </Text>
        <Text selectable style={{ color: colors.secondaryLabel }}>
          {session.user.email}
        </Text>
      </View>
      <View style={{ gap: spacing.sm }}>
        <NativeButton variant="outlined" onPress={() => void signOut()}>
          Sign out
        </NativeButton>
        <NativeButton
          variant="text"
          onPress={() =>
            Alert.alert(
              "Delete account",
              "This permanently removes your profile, actors, drafts, generated media, and creator activity.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete account",
                  style: "destructive",
                  onPress: () => {
                    setDeleting(true);
                    void api
                      .delete<{ deleted: true }>("/api/v1/mobile/session")
                      .then(() => signOut())
                      .catch((error: unknown) => {
                        Alert.alert(
                          "Could not delete account",
                          error instanceof Error
                            ? error.message
                            : "Try again shortly.",
                        );
                      })
                      .finally(() => setDeleting(false));
                  },
                },
              ],
            )
          }
          loading={deleting}
        >
          Delete account
        </NativeButton>
      </View>
      <Text
        selectable
        style={{ color: colors.secondaryLabel, fontSize: 12, lineHeight: 18 }}
      >
        Chaplin 0.1 · TestFlight foundation
      </Text>
    </ScrollView>
  );
}
