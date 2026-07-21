import { beginGeneration, completeGeneration, ensureCharacter, failGeneration, saveMediaAsset } from "@/lib/server/supabase-admin";
import { calculateGenerationBilling } from "@/lib/server/billing";
import type { Character } from "@/lib/types";

export const runtime = "nodejs";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  let jobId: string | undefined;
  try {
    const form = await request.formData();
    const characterId = form.get("characterId");
    const characterJson = form.get("character");
    const kind = form.get("kind");
    const file = form.get("file");

    if (typeof characterId !== "string" || !characterId.trim()) {
      return Response.json({ error: "characterId is required." }, { status: 400 });
    }
    if (kind !== "avatar" && kind !== "banner" && kind !== "gallery") {
      return Response.json({ error: "kind must be avatar, banner, or gallery." }, { status: 400 });
    }
    if (!(file instanceof File) || !IMAGE_TYPES.has(file.type)) {
      return Response.json({ error: "Upload a PNG, JPEG, or WebP image." }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
      return Response.json({ error: "Image must be between 1 byte and 12 MB." }, { status: 400 });
    }

    const cleanCharacterId = characterId.trim();
    if (typeof characterJson === "string" && characterJson) {
      const character = JSON.parse(characterJson) as Character;
      if (character.id !== cleanCharacterId) {
        return Response.json({ error: "AI actor identity does not match this upload." }, { status: 400 });
      }
      await ensureCharacter(character);
    }
    jobId = await beginGeneration({
      characterId: cleanCharacterId,
      kind: `upload-${kind}`,
      provider: "supabase",
      model: "direct-upload",
      prompt: file.name,
    });
    const asset = await saveMediaAsset({
      characterId: cleanCharacterId,
      kind,
      provider: "upload",
      bytes: await file.arrayBuffer(),
      contentType: file.type,
      metadata: { originalName: file.name, size: file.size },
    });
    await completeGeneration(
      jobId,
      asset.id,
      { originalName: file.name, contentType: file.type, bytes: file.size },
      await calculateGenerationBilling({
        kind: `upload-${kind}`,
        usage: { providerUsage: { bytes: file.size, contentType: file.type } },
      })
    );
    return Response.json(asset);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    if (jobId) await failGeneration(jobId, message);
    return Response.json({ error: message }, { status: 500 });
  }
}
