import {
  mobileError,
  requireMobileIdentity,
} from "@/lib/server/mobile-auth";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const identity = await requireMobileIdentity(request);
    const admin = getSupabaseAdminClient();
    const characters = await admin
      .from("characters")
      .select("id,name")
      .eq("maker_id", identity.id);
    if (characters.error) {
      throw new Error(`Load mobile actors: ${characters.error.message}`);
    }
    const names = new Map(
      (characters.data ?? []).map((character) => [
        character.id,
        character.name,
      ]),
    );
    const ids = [...names.keys()];
    if (!ids.length) return Response.json({ items: [] });
    const assets = await admin
      .from("media_assets")
      .select("id,character_id,kind,url,created_at")
      .in("character_id", ids)
      .order("created_at", { ascending: false })
      .limit(100);
    if (assets.error) {
      throw new Error(`Load mobile library: ${assets.error.message}`);
    }
    return Response.json({
      items: (assets.data ?? []).map((asset) => ({
        id: asset.id,
        characterId: asset.character_id,
        characterName: names.get(asset.character_id) ?? "Chaplin actor",
        kind: asset.kind,
        url: asset.url,
        createdAt: asset.created_at,
      })),
    });
  } catch (error) {
    return mobileError(error);
  }
}
