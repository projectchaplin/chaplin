import { mobileError, requireMobileIdentity } from "@/lib/server/mobile-auth";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const identity = await requireMobileIdentity(request);
    return Response.json({ identity });
  } catch (error) {
    return mobileError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const identity = await requireMobileIdentity(request);
    const admin = getSupabaseAdminClient();
    const characters = await admin
      .from("characters")
      .select("id")
      .eq("maker_id", identity.id);
    if (characters.error) {
      throw new Error(`Load account actors: ${characters.error.message}`);
    }
    const characterIds = (characters.data ?? []).map((row) => row.id);
    if (characterIds.length) {
      const assets = await admin
        .from("media_assets")
        .select("storage_path")
        .in("character_id", characterIds)
        .not("storage_path", "is", null);
      if (assets.error) {
        throw new Error(`Load account media: ${assets.error.message}`);
      }
      const storagePaths = (assets.data ?? [])
        .map((asset) => asset.storage_path)
        .filter((path): path is string => Boolean(path));
      if (storagePaths.length) {
        const removed = await admin.storage
          .from("character-media")
          .remove(storagePaths);
        if (removed.error) {
          throw new Error(`Remove account media: ${removed.error.message}`);
        }
      }
      const removedCharacters = await admin
        .from("characters")
        .delete()
        .eq("maker_id", identity.id);
      if (removedCharacters.error) {
        throw new Error(
          `Remove account actors: ${removedCharacters.error.message}`,
        );
      }
    }
    for (const [table, column] of [
      ["feed_replies", "author_id"],
      ["feed_reactions", "user_id"],
      ["feed_posts", "author_id"],
      ["stories", "author_id"],
      ["users", "id"],
    ] as const) {
      const result = await admin.from(table).delete().eq(column, identity.id);
      if (result.error) {
        throw new Error(`Remove account data from ${table}: ${result.error.message}`);
      }
    }
    const authResult = await admin.auth.admin.deleteUser(identity.id);
    if (authResult.error) {
      throw new Error(`Remove account login: ${authResult.error.message}`);
    }
    return Response.json({ deleted: true });
  } catch (error) {
    return mobileError(error);
  }
}
