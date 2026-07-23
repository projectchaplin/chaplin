import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { ActorCard } from "@/components/actor-card";
import { EmptyView } from "@/components/state-view";
import type { Character, LibraryItem, MobileIdentity } from "@/domain/types";
import { api } from "@/lib/api";
import { colors, radii, spacing } from "@/theme/colors";

export function StudioScreen() {
  const router = useRouter();
  const identity = useQuery({
    queryKey: ["mobile-session"],
    queryFn: () => api.get<{ identity: MobileIdentity }>("/api/v1/mobile/session"),
  });
  const characters = useQuery({
    queryKey: ["characters"],
    queryFn: () =>
      api.get<{ characters: Character[] }>("/api/v1/mobile/characters"),
  });
  const library = useQuery({
    queryKey: ["library"],
    queryFn: () => api.get<{ items: LibraryItem[] }>("/api/v1/mobile/library"),
  });

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={undefined}
      contentContainerStyle={{
        gap: spacing.xl,
        padding: spacing.md,
        paddingBottom: 120,
      }}
    >
      <View
        style={{
          overflow: "hidden",
          gap: spacing.md,
          padding: spacing.lg,
          minHeight: 180,
          borderRadius: radii.lg,
          borderCurve: "continuous",
          backgroundColor: "#241426",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.12)",
        }}
      >
        <Text
          selectable
          style={{
            color: colors.accentSoft,
            fontSize: 11,
            fontWeight: "800",
            letterSpacing: 1.4,
            textTransform: "uppercase",
          }}
        >
          Your Chaplin studio
        </Text>
        <Text
          selectable
          style={{
            color: colors.white,
            fontSize: 30,
            lineHeight: 34,
            fontWeight: "900",
          }}
        >
          {identity.data?.identity.name
            ? `Welcome back, ${identity.data.identity.name}.`
            : "Build someone worth watching."}
        </Text>
        <Text selectable style={{ color: "#d3c7d8", lineHeight: 21 }}>
          Your actors, Sparks, and unfinished ideas stay together here.
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Pressable
          onPress={() => router.push("/actor/new")}
          style={({ pressed }) => ({
            flex: 1,
            padding: spacing.md,
            borderRadius: radii.md,
            backgroundColor: colors.accent,
            opacity: pressed ? 0.72 : 1,
          })}
        >
          <Text style={{ color: colors.white, fontWeight: "800" }}>+ Actor</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/spark/new")}
          style={({ pressed }) => ({
            flex: 1,
            padding: spacing.md,
            borderRadius: radii.md,
            backgroundColor: colors.elevated,
            borderWidth: 1,
            borderColor: colors.separator,
            opacity: pressed ? 0.72 : 1,
          })}
        >
          <Text style={{ color: colors.label, fontWeight: "800" }}>✦ Spark</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/settings")}
          style={({ pressed }) => ({
            padding: spacing.md,
            borderRadius: radii.md,
            backgroundColor: colors.elevated,
            borderWidth: 1,
            borderColor: colors.separator,
            opacity: pressed ? 0.72 : 1,
          })}
        >
          <Text style={{ color: colors.label, fontWeight: "800" }}>•••</Text>
        </Pressable>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text
          selectable
          style={{ color: colors.label, fontSize: 20, fontWeight: "800" }}
        >
          Your actors
        </Text>
        {characters.isError ? (
          <Text selectable style={{ color: colors.danger }}>
            {characters.error.message}
          </Text>
        ) : null}
        {characters.data?.characters.length ? (
          characters.data.characters.slice(0, 4).map((character) => (
            <ActorCard
              key={character.id}
              character={character}
              onPress={() =>
                router.push({
                  pathname: "/spark/new",
                  params: { characterId: character.id },
                })
              }
            />
          ))
        ) : !characters.isLoading ? (
          <EmptyView
            title="Your first actor starts here."
            message="Define a human contradiction, a repeatable face, and a voice worth recognizing."
            action="Create an actor"
            onAction={() => router.push("/actor/new")}
          />
        ) : null}
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text
          selectable
          style={{ color: colors.label, fontSize: 20, fontWeight: "800" }}
        >
          Recent output
        </Text>
        {library.data?.items.length ? (
          library.data.items.slice(0, 3).map((item) => (
            <View
              key={item.id}
              style={{
                padding: spacing.md,
                borderRadius: radii.md,
                backgroundColor: colors.elevated,
                gap: spacing.xs,
              }}
            >
              <Text selectable style={{ color: colors.label, fontWeight: "800" }}>
                {item.characterName}
              </Text>
              <Text selectable style={{ color: colors.secondaryLabel }}>
                {item.kind} · {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>
          ))
        ) : (
          <Text selectable style={{ color: colors.secondaryLabel }}>
            Finished takes will appear here.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}
