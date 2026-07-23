import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  ScrollView,
  Text,
  View,
} from "react-native";

import { ActorCard } from "@/components/actor-card";
import { FormField } from "@/components/form-field";
import { NativeButton } from "@/components/native-button";
import { SectionHeading } from "@/components/section-heading";
import type { Character, SparkDraft } from "@/domain/types";
import { api } from "@/lib/api";
import { colors, radii, spacing } from "@/theme/colors";

export function SparkWriterScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ characterId?: string }>();
  const [selectedId, setSelectedId] = useState(params.characterId || "");
  const [brief, setBrief] = useState("");
  const [draft, setDraft] = useState<SparkDraft | null>(null);
  const [error, setError] = useState("");

  const characters = useQuery({
    queryKey: ["characters"],
    queryFn: () =>
      api.get<{ characters: Character[] }>("/api/v1/mobile/characters"),
  });

  const resolvedSelectedId =
    selectedId || characters.data?.characters[0]?.id || "";

  const selected = useMemo(
    () =>
      characters.data?.characters.find(
        (character) => character.id === resolvedSelectedId,
      ),
    [characters.data, resolvedSelectedId],
  );

  const magic = useMutation({
    mutationFn: () =>
      api.post<{ draft: Omit<SparkDraft, "format"> }>(
        "/api/v1/mobile/magic-spark",
        { characterId: resolvedSelectedId, brief },
      ),
    onSuccess: ({ draft: next }) =>
      setDraft({ ...next, format: "spark" }),
    onError: (cause) =>
      setError(cause instanceof Error ? cause.message : "Could not write Spark."),
  });

  const save = useMutation({
    mutationFn: () =>
      api.post<{ draft: SparkDraft }>("/api/v1/mobile/drafts", {
        ...draft,
        format: "spark",
      }),
    onSuccess: async ({ draft: saved }) => {
      await queryClient.invalidateQueries({ queryKey: ["drafts"] });
      router.replace(`/spark/${saved.id}`);
    },
    onError: (cause) =>
      setError(cause instanceof Error ? cause.message : "Could not save Spark."),
  });

  const scene = draft?.scenes[0];
  const line = scene?.lines[0];

  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          gap: spacing.xl,
          padding: spacing.md,
          paddingBottom: 120,
        }}
      >
        <SectionHeading
          eyebrow="Five seconds"
          title="One readable choice."
          detail="A Spark is not a miniature movie. It is one charged performance beat that proves who the actor is."
        />
        <View style={{ gap: spacing.sm }}>
          <Text
            selectable
            style={{ color: colors.label, fontSize: 18, fontWeight: "800" }}
          >
            Choose the actor
          </Text>
          {characters.data?.characters.map((character) => (
            <ActorCard
              key={character.id}
              character={character}
              selected={character.id === resolvedSelectedId}
              onPress={() => setSelectedId(character.id)}
            />
          ))}
        </View>
        {selected ? (
          <View style={{ gap: spacing.md }}>
            <FormField
              label="The moment"
              value={brief}
              onChangeText={setBrief}
              multiline
              maxLength={1000}
              placeholder={`${selected.name} realizes the safe exit is actually the trap, then chooses to walk toward it…`}
              hint="Describe visible pressure and the choice—not the whole backstory."
            />
            <NativeButton
              loading={magic.isPending}
              disabled={brief.trim().length < 12}
              onPress={() => {
                setError("");
                magic.mutate();
              }}
            >
              ✦ Write the Spark
            </NativeButton>
          </View>
        ) : (
          <Text selectable style={{ color: colors.warning }}>
            Create an actor before writing a Spark.
          </Text>
        )}

        {draft && scene ? (
          <View
            style={{
              gap: spacing.md,
              padding: spacing.md,
              borderRadius: radii.lg,
              borderCurve: "continuous",
              backgroundColor: colors.elevated,
              borderWidth: 1,
              borderColor: colors.separator,
            }}
          >
            <SectionHeading
              eyebrow="Editable draft"
              title={draft.title}
              detail={draft.logline}
            />
            <FormField
              label="Title"
              value={draft.title}
              onChangeText={(value) =>
                setDraft((current) =>
                  current ? { ...current, title: value } : current,
                )
              }
            />
            <FormField
              label="Setting"
              value={scene.setting}
              onChangeText={(value) =>
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        scenes: [
                          { ...current.scenes[0], setting: value },
                          ...current.scenes.slice(1),
                        ],
                      }
                    : current,
                )
              }
              multiline
            />
            <FormField
              label="Visible action"
              value={scene.action}
              onChangeText={(value) =>
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        scenes: [
                          { ...current.scenes[0], action: value },
                          ...current.scenes.slice(1),
                        ],
                      }
                    : current,
                )
              }
              multiline
            />
            {line ? (
              <FormField
                label="Dialogue"
                value={line.text}
                onChangeText={(value) =>
                  setDraft((current) => {
                    if (!current) return current;
                    const first = current.scenes[0];
                    return {
                      ...current,
                      scenes: [
                        {
                          ...first,
                          lines: [
                            { ...first.lines[0], text: value },
                            ...first.lines.slice(1),
                          ],
                        },
                        ...current.scenes.slice(1),
                      ],
                    };
                  })
                }
                multiline
              />
            ) : null}
            {error ? (
              <Text selectable style={{ color: colors.danger }}>
                {error}
              </Text>
            ) : null}
            <NativeButton
              loading={save.isPending}
              disabled={!draft.title.trim() || !scene.action.trim()}
              onPress={() => {
                setError("");
                save.mutate();
              }}
            >
              Lock draft and produce
            </NativeButton>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
