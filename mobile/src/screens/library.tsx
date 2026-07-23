import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Share, ScrollView, Text, View } from "react-native";

import { EmptyView } from "@/components/state-view";
import type { LibraryItem } from "@/domain/types";
import { api } from "@/lib/api";
import { colors, radii, spacing } from "@/theme/colors";

export function LibraryScreen() {
  const library = useQuery({
    queryKey: ["library"],
    queryFn: () => api.get<{ items: LibraryItem[] }>("/api/v1/mobile/library"),
  });

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        gap: spacing.md,
        padding: spacing.md,
        paddingBottom: 120,
      }}
    >
      {library.isError ? (
        <Text selectable style={{ color: colors.danger }}>
          {library.error.message}
        </Text>
      ) : null}
      {library.data?.items.length ? (
        library.data.items.map((item) => (
          <View
            key={item.id}
            style={{
              overflow: "hidden",
              borderRadius: radii.lg,
              borderCurve: "continuous",
              backgroundColor: colors.elevated,
              borderWidth: 1,
              borderColor: colors.separator,
            }}
          >
            {item.kind.includes("image") ||
            item.kind === "gallery" ||
            item.kind === "avatar" ||
            item.kind === "banner" ? (
              <Image
                source={{ uri: item.url }}
                contentFit="cover"
                transition={180}
                style={{ width: "100%", aspectRatio: 16 / 9 }}
              />
            ) : null}
            <View style={{ gap: spacing.xs, padding: spacing.md }}>
              <Text
                selectable
                style={{ color: colors.label, fontSize: 17, fontWeight: "800" }}
              >
                {item.characterName}
              </Text>
              <Text selectable style={{ color: colors.secondaryLabel }}>
                {item.kind} · {new Date(item.createdAt).toLocaleString()}
              </Text>
              <Text
                accessibilityRole="button"
                onPress={() =>
                  void Share.share({
                    title: `${item.characterName} on Chaplin`,
                    message: item.url,
                    url: item.url,
                  })
                }
                style={{ color: colors.accent, fontWeight: "700", paddingTop: 4 }}
              >
                Share output
              </Text>
            </View>
          </View>
        ))
      ) : !library.isLoading ? (
        <EmptyView
          title="No finished takes yet."
          message="Generated images, voices, and five-second Sparks will collect here automatically."
        />
      ) : null}
    </ScrollView>
  );
}
