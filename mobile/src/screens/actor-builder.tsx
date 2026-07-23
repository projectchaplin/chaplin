import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { FormField } from "@/components/form-field";
import { NativeButton } from "@/components/native-button";
import { SectionHeading } from "@/components/section-heading";
import {
  archetypes,
  type Archetype,
  type Character,
  type CharacterSuggestion,
  type VoiceGender,
} from "@/domain/types";
import { api } from "@/lib/api";
// Expo resolves the native SQLite implementation by platform; TypeScript uses
// the web-safe base module during static analysis.
import { draftStorage } from "@/lib/draft-storage";
import { colors, radii, spacing } from "@/theme/colors";

const DRAFT_KEY = "chaplin-mobile:actor-draft";

type ActorForm = {
  name: string;
  archetype: Archetype;
  brief: string;
  appearanceBrief: string;
  worldBrief: string;
  voiceGender: VoiceGender;
  tagline: string;
  personality: string;
  voiceDescription: string;
  signatureSfx: string;
  themeScore: string;
};

const initialForm: ActorForm = {
  name: "",
  archetype: "hero",
  brief: "",
  appearanceBrief: "",
  worldBrief: "",
  voiceGender: "androgynous",
  tagline: "",
  personality: "",
  voiceDescription: "",
  signatureSfx: "",
  themeScore: "",
};

export function ActorBuilderScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ActorForm>(() => {
    try {
      return {
        ...initialForm,
        ...(JSON.parse(draftStorage.getItem(DRAFT_KEY) || "{}") as Partial<ActorForm>),
      };
    } catch {
      return initialForm;
    }
  });
  const [reference, setReference] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState<CharacterSuggestion | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      draftStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    }, 250);
    return () => clearTimeout(timer);
  }, [form]);

  const update = <K extends keyof ActorForm>(key: K, value: ActorForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const magic = useMutation({
    mutationFn: () =>
      api.post<{ suggestion: CharacterSuggestion }>(
        "/api/v1/mobile/magic-character",
        {
          target: "all",
          name: form.name,
          archetype: form.archetype,
          archetypes: [form.archetype],
          characterBrief: form.brief,
          appearanceBrief: form.appearanceBrief,
          worldBrief: form.worldBrief,
          voiceGender: form.voiceGender,
          tagline: form.tagline,
          personality: form.personality,
          voiceDesc: form.voiceDescription,
          sfxDesc: form.signatureSfx,
          themeDesc: form.themeScore,
        },
      ),
    onSuccess: ({ suggestion: next }) => {
      setSuggestion(next);
      setForm((current) => ({
        ...current,
        tagline: next.tagline,
        personality: next.personality,
        voiceGender: next.voiceGender,
        voiceDescription: next.voiceDescription,
        signatureSfx: next.signatureSfx,
        themeScore: next.themeScore,
      }));
      if (process.env.EXPO_OS === "ios") {
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
      }
    },
    onError: (cause) =>
      setError(cause instanceof Error ? cause.message : "Magic Character failed."),
  });

  const create = useMutation({
    mutationFn: async () => {
      const result = await api.post<{ character: Character }>(
        "/api/v1/mobile/characters",
        {
          ...form,
          productionBible: suggestion?.productionBible,
        },
      );
      if (reference) {
        const body = new FormData();
        body.append("characterId", result.character.id);
        body.append("kind", "avatar");
        body.append(
          "file",
          {
            uri: reference.uri,
            name: reference.fileName || `actor-${Date.now()}.jpg`,
            type: reference.mimeType || "image/jpeg",
          } as unknown as Blob,
        );
        await api.upload("/api/v1/mobile/reference", body);
      }
      return result.character;
    },
    onSuccess: async (character) => {
      draftStorage.removeItem(DRAFT_KEY);
      await queryClient.invalidateQueries({ queryKey: ["characters"] });
      router.replace({
        pathname: "/spark/new",
        params: { characterId: character.id },
      });
    },
    onError: (cause) =>
      setError(cause instanceof Error ? cause.message : "Could not save actor."),
  });

  const canUseMagic = form.name.trim().length > 1 && form.brief.trim().length >= 20;
  const canCreate = useMemo(
    () =>
      form.name.trim() &&
      form.tagline.trim() &&
      form.personality.trim() &&
      form.voiceDescription.trim(),
    [form],
  );

  const chooseImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (!result.canceled) setReference(result.assets[0]);
  };

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
          eyebrow="Identity first"
          title="Build someone a camera can recognize."
          detail="Start with the human contradiction. Chaplin turns it into repeatable performance, voice, and visual direction."
        />

        <View style={{ gap: spacing.md }}>
          <FormField
            label="Actor name"
            value={form.name}
            onChangeText={(value) => update("name", value)}
            placeholder="e.g. Ferra Voss"
            autoCapitalize="words"
          />
          <FormField
            label="Who are they?"
            value={form.brief}
            onChangeText={(value) => update("brief", value)}
            placeholder="A retired railway detective who is kind in public and ruthless at chess…"
            multiline
            maxLength={1500}
            hint="At least one or two specific sentences."
          />
          <View style={{ gap: spacing.sm }}>
            <Text
              selectable
              style={{
                color: colors.secondaryLabel,
                fontSize: 12,
                fontWeight: "700",
                textTransform: "uppercase",
              }}
            >
              Dramatic archetype
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm }}
            >
              {archetypes.map((item) => (
                <Pressable
                  key={item.value}
                  onPress={() => update("archetype", item.value)}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: radii.pill,
                    backgroundColor:
                      form.archetype === item.value
                        ? colors.accent
                        : colors.elevated,
                    borderWidth: 1,
                    borderColor:
                      form.archetype === item.value
                        ? colors.accent
                        : colors.separator,
                  }}
                >
                  <Text style={{ color: colors.label, fontWeight: "700" }}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <FormField
            label="Appearance direction"
            value={form.appearanceBrief}
            onChangeText={(value) => update("appearanceBrief", value)}
            placeholder="Late 30s, angular face, cropped hair, weathered khaki jacket…"
            multiline
          />
          <FormField
            label="World direction"
            value={form.worldBrief}
            onChangeText={(value) => update("worldBrief", value)}
            placeholder="Rain-dark railway world, tungsten practicals, deep green and brass…"
            multiline
          />
          <NativeButton
            loading={magic.isPending}
            disabled={!canUseMagic}
            onPress={() => {
              setError("");
              magic.mutate();
            }}
          >
            ✦ Build the character
          </NativeButton>
        </View>

        {form.tagline ? (
          <View style={{ gap: spacing.md }}>
            <SectionHeading
              eyebrow="Chaplin identity"
              title={form.tagline}
              detail="Everything below remains editable before you lock the actor."
            />
            <FormField
              label="Personality"
              value={form.personality}
              onChangeText={(value) => update("personality", value)}
              multiline
            />
            <FormField
              label="Voice direction"
              value={form.voiceDescription}
              onChangeText={(value) => update("voiceDescription", value)}
              multiline
            />
            <FormField
              label="Signature sound"
              value={form.signatureSfx}
              onChangeText={(value) => update("signatureSfx", value)}
              multiline
            />
            <FormField
              label="Theme"
              value={form.themeScore}
              onChangeText={(value) => update("themeScore", value)}
              multiline
            />
            <Pressable
              onPress={() => void chooseImage()}
              style={{
                minHeight: 170,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                borderRadius: radii.lg,
                borderCurve: "continuous",
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: colors.separator,
                backgroundColor: colors.elevated,
              }}
            >
              {reference ? (
                <Image
                  source={{ uri: reference.uri }}
                  contentFit="cover"
                  style={{ width: "100%", height: 220 }}
                />
              ) : (
                <Text style={{ color: colors.accent, fontWeight: "800" }}>
                  Choose an identity reference
                </Text>
              )}
            </Pressable>
            {error ? (
              <Text selectable style={{ color: colors.danger }}>
                {error}
              </Text>
            ) : null}
            <NativeButton
              loading={create.isPending}
              disabled={!canCreate}
              onPress={() => {
                setError("");
                create.mutate();
              }}
            >
              Save actor and write a Spark
            </NativeButton>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
