import { NextRequest, NextResponse } from "next/server";
import { requireRequestIdentity } from "@/lib/server/auth";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { normalizeProductionFormat } from "@/lib/production-formats";

export const runtime = "nodejs";

const FORMATS = new Set(["spark", "punch", "episode", "spot"]);

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not access drafts.";
  return NextResponse.json(
    { error: message },
    { status: message === "Sign in to continue." ? 401 : 400 },
  );
}

export async function GET(request: NextRequest) {
  try {
    const identity = await requireRequestIdentity(request);
    const id = request.nextUrl.searchParams.get("id");
    const admin = getSupabaseAdminClient();
    let query = admin
      .from("story_drafts")
      .select("id, format, title, logline, body, created_at, updated_at")
      .eq("owner_id", identity.id);

    if (id) query = query.eq("id", id).limit(1);
    else query = query.order("updated_at", { ascending: false });

    const result = await query;
    if (result.error) throw new Error(`Load drafts: ${result.error.message}`);
    if (id) {
      const draft = result.data?.[0] ?? null;
      return draft
        ? NextResponse.json({ draft })
        : NextResponse.json({ error: "Draft not found." }, { status: 404 });
    }
    return NextResponse.json({ drafts: result.data ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const identity = await requireRequestIdentity(request);
    const input = await request.json() as Record<string, unknown>;
    const id = clean(input.id, 64);
    const requestedFormat = normalizeProductionFormat(typeof input.format === "string" ? input.format : null);
    const format = FORMATS.has(requestedFormat) ? requestedFormat : "punch";
    const title = clean(input.title, 160);
    const logline = clean(input.logline, 600);
    const body = input.body && typeof input.body === "object" ? input.body : {};
    const values = {
        owner_id: identity.id,
        format,
        title,
        logline,
        body,
        updated_at: new Date().toISOString(),
      };
    const drafts = getSupabaseAdminClient().from("story_drafts");
    const result = id
      ? await drafts
        .update(values)
        .eq("id", id)
        .eq("owner_id", identity.id)
        .select("id, format, title, logline, body, created_at, updated_at")
        .single()
      : await drafts
        .insert(values)
      .select("id, format, title, logline, body, created_at, updated_at")
      .single();
    if (result.error) throw new Error(`Save draft: ${result.error.message}`);
    return NextResponse.json({ draft: result.data }, { status: id ? 200 : 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const identity = await requireRequestIdentity(request);
    const id = request.nextUrl.searchParams.get("id")?.trim();
    if (!id) throw new Error("Choose a draft to delete.");
    const result = await getSupabaseAdminClient()
      .from("story_drafts")
      .delete()
      .eq("id", id)
      .eq("owner_id", identity.id);
    if (result.error) throw new Error(`Delete draft: ${result.error.message}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
