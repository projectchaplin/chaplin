import { NextRequest, NextResponse } from "next/server";
import { ProductCardSchema } from "@/lib/product-card";
import { requireRequestIdentity } from "@/lib/server/auth";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { assertRequestBodySize, enforceRateLimit, securityErrorStatus } from "@/lib/server/request-security";

export const runtime = "nodejs";

function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not save product.";
  return NextResponse.json({ error: message }, { status: securityErrorStatus(error, message === "Sign in to continue." ? 401 : 400) });
}

async function ensureReferenceAssets(referenceImages: string[], ownerId: string, isAdmin: boolean) {
  const admin = getSupabaseAdminClient();
  const result = await admin.from("media_assets").select("id,metadata").in("id", referenceImages);
  if (result.error) throw new Error(`Validate product references: ${result.error.message}`);
  if ((result.data ?? []).length !== referenceImages.length) throw new Error("One or more product reference images no longer exist.");
  if (!isAdmin && (result.data ?? []).some((asset) => {
    const metadata = asset.metadata && typeof asset.metadata === "object"
      ? asset.metadata as Record<string, unknown>
      : {};
    return metadata.ownerId !== ownerId;
  })) {
    throw new Error("One or more product reference images do not belong to your account.");
  }
}

function rowPayload(product: ReturnType<typeof ProductCardSchema.parse>, ownerId: string) {
  return {
    owner_id: ownerId,
    brand_name: product.brand_name,
    product_name: product.product_name,
    reference_images: product.reference_images,
    identity_block: product.identity_block,
    must_preserve: product.must_preserve,
    negative_prompt: product.negative_prompt,
    claims_allowed: product.claims_allowed,
    handling_notes: product.handling_notes,
    updated_at: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const identity = await requireRequestIdentity(request);
    const admin = getSupabaseAdminClient();
    let query = admin.from("products").select("*").order("updated_at", { ascending: false });
    if (identity.role !== "admin") query = query.eq("owner_id", identity.id);
    const result = await query;
    if (result.error) throw new Error(`Load products: ${result.error.message}`);
    return NextResponse.json({ products: result.data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertRequestBodySize(request, 256 * 1024);
    const identity = await requireRequestIdentity(request);
    await enforceRateLimit({ request, bucket: "product-create", limit: 12, windowSeconds: 86400, identityId: identity.id });
    const product = ProductCardSchema.parse(await request.json());
    await ensureReferenceAssets(product.reference_images, identity.id, identity.role === "admin");
    const result = await getSupabaseAdminClient().from("products").insert(rowPayload(product, identity.id)).select("*").single();
    if (result.error) throw new Error(`Create product: ${result.error.message}`);
    return NextResponse.json({ product: result.data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
