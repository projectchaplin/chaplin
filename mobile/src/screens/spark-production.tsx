import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAudioPlayer } from "expo-audio";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useState } from "react";
import { Pressable, ScrollView, Share, Text, View } from "react-native";

import { NativeButton } from "@/components/native-button";
import { SectionHeading } from "@/components/section-heading";
import type {
  Character,
  GenerationState,
  SparkDraft,
} from "@/domain/types";
import { api } from "@/lib/api";
import { colors, radii, spacing } from "@/theme/colors";

type VoicePreview = {
  generated_voice_id: string;
  audio_base_64: string;
  duration_secs?: number;
};

type SparkPrompts = {
  dialogue: string;
  image: string;
  video: string;
  sfx: string;
  theme: string;
};

function VoicePreviewRow({
  preview,
  selected,
  onSelect,
}: {
  preview: VoicePreview;
  selected: boolean;
  onSelect: () => void;
}) {
  const player = useAudioPlayer({
    uri: `data:audio/mpeg;base64,${preview.audio_base_64}`,
  });
  return (
    <Pressable
      onPress={onSelect}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radii.md,
        backgroundColor: colors.elevated,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.accent : colors.separator,
      }}
    >
      <Text
        accessibilityRole="button"
        onPress={() => player.play()}
        style={{ color: colors.accent, fontSize: 18, fontWeight: "800" }}
      >
        ▶
      </Text>
      <Text selectable style={{ flex: 1, color: colors.label }}>
        Voice take {preview.generated_voice_id.slice(0, 6)}
      </Text>
      {selected ? <Text style={{ color: colors.accent }}>✓</Text> : null}
    </Pressable>
  );
}

function VideoOutput({ url }: { url: string }) {
  const player = useVideoPlayer(url, (instance) => {
    instance.loop = true;
  });
  return (
    <VideoView
      player={player}
      nativeControls
      allowsPictureInPicture
      style={{
        width: "100%",
        aspectRatio: 16 / 9,
        borderRadius: radii.lg,
      }}
    />
  );
}

export function SparkProductionScreen({ draftId }: { draftId: string }) {
  const queryClient = useQueryClient();
  const [previews, setPreviews] = useState<VoicePreview[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [message, setMessage] = useState("");

  const draftQuery = useQuery({
    queryKey: ["draft", draftId],
    queryFn: () =>
      api.get<{ draft: SparkDraft }>(
        `/api/v1/mobile/drafts?id=${encodeURIComponent(draftId)}`,
      ),
  });
  const characters = useQuery({
    queryKey: ["characters"],
    queryFn: () =>
      api.get<{ characters: Character[] }>("/api/v1/mobile/characters"),
  });
  const characterId = draftQuery.data?.draft.castIds[0];
  const character = characters.data?.characters.find(
    (item) => item.id === characterId,
  );
  const state = useQuery({
    queryKey: ["generation-state", characterId],
    enabled: Boolean(characterId),
    queryFn: () =>
      api.get<GenerationState>(
        `/api/v1/mobile/generate?characterId=${encodeURIComponent(characterId!)}`,
      ),
    refetchInterval: 15_000,
  });
  const prompts = useQuery({
    queryKey: ["spark-prompts", draftId],
    enabled: Boolean(draftQuery.data?.draft && characterId),
    queryFn: () =>
      api.post<{ prompts: SparkPrompts }>("/api/v1/mobile/spark-prompts", {
        draftId,
      }),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["generation-state", characterId],
      }),
      queryClient.invalidateQueries({ queryKey: ["library"] }),
    ]);
  };

  const designVoice = useMutation({
    mutationFn: () =>
      api.post<{ previews: VoicePreview[] }>("/api/v1/mobile/generate", {
        action: "voice-design",
        characterId,
        description: character?.voiceDesc,
        previewText:
          prompts.data?.prompts.dialogue ||
          character?.tagline ||
          "This is the choice I came here to make.",
      }),
    onSuccess: (data) => {
      setPreviews(data.previews || []);
      setSelectedVoice(data.previews?.[0]?.generated_voice_id || "");
      setMessage("Choose the voice that belongs to this actor.");
    },
    onError: (cause) =>
      setMessage(cause instanceof Error ? cause.message : "Voice design failed."),
  });

  const lockVoice = useMutation({
    mutationFn: () =>
      api.post("/api/v1/mobile/generate", {
        action: "voice-save",
        characterId,
        name: character?.name,
        description: character?.voiceDesc,
        generatedVoiceId: selectedVoice,
      }),
    onSuccess: async () => {
      setMessage("Voice locked. Every future line uses this identity.");
      await refresh();
    },
    onError: (cause) =>
      setMessage(cause instanceof Error ? cause.message : "Voice lock failed."),
  });

  const generateImage = useMutation({
    mutationFn: () =>
      api.post<{ url: string }>("/api/v1/mobile/generate", {
        action: "image",
        characterId,
        prompt: prompts.data?.prompts.image,
        imagePurpose: "identity",
      }),
    onSuccess: async () => {
      setMessage("Identity frame ready.");
      await refresh();
    },
    onError: (cause) =>
      setMessage(cause instanceof Error ? cause.message : "Image failed."),
  });

  const generateVideo = useMutation({
    mutationFn: () =>
      api.post<{ url: string }>("/api/v1/mobile/generate", {
        action: "video",
        characterId,
        prompt: prompts.data?.prompts.video,
        reference: state.data?.production?.visualReference?.url,
      }),
    onSuccess: async ({ url }) => {
      setMessage("Spark complete.");
      await refresh();
      void Share.share({
        title: `${character?.name || "Chaplin"} Spark`,
        message: url,
        url,
      });
    },
    onError: (cause) =>
      setMessage(cause instanceof Error ? cause.message : "Video failed."),
  });

  const video = state.data?.production?.assets
    ?.filter((asset) => asset.kind === "video")
    .at(-1);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        gap: spacing.xl,
        padding: spacing.md,
        paddingBottom: 100,
      }}
    >
      <SectionHeading
        eyebrow="Production"
        title={draftQuery.data?.draft.title || "Preparing Spark"}
        detail={draftQuery.data?.draft.logline}
      />
      {character?.imageUrl ? (
        <Image
          source={{ uri: character.imageUrl }}
          contentFit="cover"
          style={{
            width: "100%",
            aspectRatio: 16 / 9,
            borderRadius: radii.lg,
          }}
        />
      ) : null}
      <View style={{ gap: spacing.md }}>
        <SectionHeading
          eyebrow="01"
          title="Lock the voice"
          detail={
            state.data?.production?.voiceId
              ? "The actor has a persistent voice."
              : "Audition three voices, then make one permanent."
          }
        />
        {!state.data?.production?.voiceId ? (
          <>
            <NativeButton
              loading={designVoice.isPending}
              disabled={!character || !prompts.data}
              onPress={() => designVoice.mutate()}
            >
              Design voice takes
            </NativeButton>
            {previews.map((preview) => (
              <VoicePreviewRow
                key={preview.generated_voice_id}
                preview={preview}
                selected={selectedVoice === preview.generated_voice_id}
                onSelect={() => setSelectedVoice(preview.generated_voice_id)}
              />
            ))}
            {previews.length ? (
              <NativeButton
                loading={lockVoice.isPending}
                disabled={!selectedVoice}
                onPress={() => lockVoice.mutate()}
              >
                Lock selected voice
              </NativeButton>
            ) : null}
          </>
        ) : (
          <Text selectable style={{ color: colors.success, fontWeight: "800" }}>
            Voice identity locked
          </Text>
        )}
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionHeading
          eyebrow="02"
          title="Create the first frame"
          detail="This approved identity frame becomes the source of truth for motion."
        />
        {state.data?.production?.visualReference ? (
          <Image
            source={{ uri: state.data.production.visualReference.url }}
            contentFit="cover"
            style={{
              width: "100%",
              aspectRatio: 16 / 9,
              borderRadius: radii.lg,
            }}
          />
        ) : (
          <NativeButton
            loading={generateImage.isPending}
            disabled={!prompts.data}
            onPress={() => generateImage.mutate()}
          >
            Generate identity frame
          </NativeButton>
        )}
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionHeading
          eyebrow="03"
          title="Make the Spark"
          detail="Animate the approved frame into one five-second performance choice."
        />
        {video ? (
          <>
            <VideoOutput url={video.url} />
            <NativeButton
              onPress={() =>
                void Share.share({
                  title: `${character?.name || "Chaplin"} Spark`,
                  message: video.url,
                  url: video.url,
                })
              }
            >
              Share Spark
            </NativeButton>
          </>
        ) : (
          <NativeButton
            loading={generateVideo.isPending}
            disabled={
              !prompts.data || !state.data?.production?.visualReference?.url
            }
            onPress={() => generateVideo.mutate()}
          >
            Generate five-second Spark
          </NativeButton>
        )}
      </View>
      {message ? (
        <Text selectable style={{ color: colors.secondaryLabel, lineHeight: 21 }}>
          {message}
        </Text>
      ) : null}
    </ScrollView>
  );
}
