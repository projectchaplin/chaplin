import { buildScenePackage } from "@/lib/production-prompting";
import type { Character } from "@/lib/types";
import {
  mobileError,
  requireMobileIdentity,
  requireOwnedCharacter,
} from "@/lib/server/mobile-auth";
import {
  getSupabaseAdminClient,
  listCharacters,
} from "@/lib/server/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const identity = await requireMobileIdentity(request);
    const input = (await request.json()) as Record<string, unknown>;
    const draftId =
      typeof input.draftId === "string" ? input.draftId.trim() : "";
    if (!draftId) throw new Error("Choose a Spark draft.");
    const result = await getSupabaseAdminClient()
      .from("story_drafts")
      .select("body")
      .eq("id", draftId)
      .eq("owner_id", identity.id)
      .eq("format", "spark")
      .maybeSingle();
    if (result.error) throw new Error(`Load Spark: ${result.error.message}`);
    if (!result.data) throw new Error("Spark draft not found.");
    const body = result.data.body as {
      castIds?: string[];
      scenes?: Array<{
        setting?: string;
        objective?: string;
        action?: string;
        lines?: Array<{ text?: string }>;
      }>;
    };
    const characterId = body.castIds?.[0] ?? "";
    await requireOwnedCharacter(identity, characterId);
    const character = (await listCharacters()).find(
      (candidate) => candidate.id === characterId,
    );
    if (!character) throw new Error("Actor not found.");
    const scene = body.scenes?.[0];
    const performanceCharacter: Character = {
      ...character,
      brollLine: scene?.lines?.[0]?.text?.trim() || character.brollLine,
      brollScene: [scene?.setting, scene?.objective, scene?.action]
        .filter(Boolean)
        .join(". "),
    };
    const scenePackage = buildScenePackage(performanceCharacter);
    return Response.json({
      prompts: {
        dialogue: scenePackage.dialogue,
        image: scenePackage.image,
        video: scenePackage.video,
        sfx: scenePackage.sfx,
        theme: scenePackage.theme,
      },
    });
  } catch (error) {
    return mobileError(error);
  }
}
