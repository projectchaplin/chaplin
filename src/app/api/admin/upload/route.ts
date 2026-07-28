import { beginGeneration, completeGeneration, ensureCharacter, failGeneration, saveMediaAsset } from "@/lib/server/supabase-admin";
import { calculateGenerationBilling } from "@/lib/server/billing";
import type { Character } from "@/lib/types";
import { requireOwnedCharacter, requireRequestIdentity } from "@/lib/server/auth";
import {
  assertRequestBodySize,
  enforceRateLimit,
  securityErrorStatus,
} from "@/lib/server/request-security";

export const runtime = "nodejs";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function hasValidImageSignature(bytes: Uint8Array, contentType: string) {
  if (contentType === "image/png") {
    return bytes.length >= 8
      && bytes[0] === 0x89
      && bytes[1] === 0x50
      && bytes[2] === 0x4e
      && bytes[3] === 0x47
      && bytes[4] === 0x0d
      && bytes[5] === 0x0a
      && bytes[6] === 0x1a
      && bytes[7] === 0x0a;
  }
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  return contentType === "image/webp"
    && bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

export async function POST(request: Request) {
  let jobId: string | undefined;
  try {
    assertRequestBodySize(request, MAX_IMAGE_BYTES + 128 * 1024);
    const identity = await requireRequestIdentity(request);
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
    await requireOwnedCharacter(identity, cleanCharacterId);
    if (identity.role !== "admin") {
      await enforceRateLimit({
        request,
        bucket: "image-upload",
        limit: 20,
        windowSeconds: 24 * 60 * 60,
        identityId: identity.id,
      });
    }
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    if (!hasValidImageSignature(fileBytes, file.type)) {
      return Response.json({ error: "The uploaded file does not match its image type." }, { status: 400 });
    }
    if (typeof characterJson === "string" && characterJson) {
      const character = JSON.parse(characterJson) as Character;
      if (character.id !== cleanCharacterId) {
        return Response.json({ error: "AI actor identity does not match this upload." }, { status: 400 });
      }
      await ensureCharacter({ ...character, makerId: identity.id });
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
      bytes: fileBytes.buffer.slice(fileBytes.byteOffset, fileBytes.byteOffset + fileBytes.byteLength),
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
    return Response.json(
      { error: message },
      { status: securityErrorStatus(error, message === "Sign in to continue." ? 401 : 500) },
    );
  }
}
