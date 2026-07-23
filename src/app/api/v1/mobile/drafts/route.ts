import {
  mobileError,
  requireMobileIdentity,
  requireOwnedCharacter,
} from "@/lib/server/mobile-auth";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";

function shapeDraft(row: {
  id: string;
  body: unknown;
  created_at: string;
  updated_at: string;
}) {
  const body =
    row.body && typeof row.body === "object"
      ? (row.body as Record<string, unknown>)
      : {};
  return {
    ...body,
    id: row.id,
    format: "spark",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: Request) {
  try {
    const identity = await requireMobileIdentity(request);
    const id = new URL(request.url).searchParams.get("id")?.trim();
    let query = getSupabaseAdminClient()
      .from("story_drafts")
      .select("id,body,created_at,updated_at")
      .eq("owner_id", identity.id)
      .eq("format", "spark");
    if (id) query = query.eq("id", id).limit(1);
    else query = query.order("updated_at", { ascending: false }).limit(50);
    const result = await query;
    if (result.error) throw new Error(`Load Spark drafts: ${result.error.message}`);
    const drafts = (result.data ?? []).map(shapeDraft);
    if (id) {
      if (!drafts[0]) throw new Error("Spark draft not found.");
      return Response.json({ draft: drafts[0] });
    }
    return Response.json({ drafts });
  } catch (error) {
    return mobileError(error);
  }
}

export async function POST(request: Request) {
  try {
    const identity = await requireMobileIdentity(request);
    const input = (await request.json()) as Record<string, unknown>;
    const castIds = Array.isArray(input.castIds)
      ? input.castIds.filter((value): value is string => typeof value === "string")
      : [];
    const characterId = castIds[0] ?? "";
    await requireOwnedCharacter(identity, characterId);
    const title =
      typeof input.title === "string" ? input.title.trim().slice(0, 160) : "";
    const logline =
      typeof input.logline === "string" ? input.logline.trim().slice(0, 600) : "";
    if (!title) throw new Error("Give the Spark a title.");
    const id = typeof input.id === "string" ? input.id.trim() : "";
    const body = {
      format: "spark",
      title,
      logline,
      creativeDirection:
        typeof input.creativeDirection === "string"
          ? input.creativeDirection.trim().slice(0, 2000)
          : "",
      castIds: castIds.slice(0, 1),
      scenes: Array.isArray(input.scenes) ? input.scenes.slice(0, 1) : [],
    };
    const values = {
      owner_id: identity.id,
      format: "spark",
      title,
      logline,
      body,
      updated_at: new Date().toISOString(),
    };
    const table = getSupabaseAdminClient().from("story_drafts");
    const result = id
      ? await table
          .update(values)
          .eq("id", id)
          .eq("owner_id", identity.id)
          .select("id,body,created_at,updated_at")
          .single()
      : await table
          .insert(values)
          .select("id,body,created_at,updated_at")
          .single();
    if (result.error) throw new Error(`Save Spark draft: ${result.error.message}`);
    return Response.json(
      { draft: shapeDraft(result.data) },
      { status: id ? 200 : 201 },
    );
  } catch (error) {
    return mobileError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const identity = await requireMobileIdentity(request);
    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) throw new Error("Choose a Spark draft.");
    const result = await getSupabaseAdminClient()
      .from("story_drafts")
      .delete()
      .eq("id", id)
      .eq("owner_id", identity.id);
    if (result.error) throw new Error(`Delete Spark draft: ${result.error.message}`);
    return Response.json({ ok: true });
  } catch (error) {
    return mobileError(error);
  }
}
