import { NextRequest, NextResponse } from "next/server";
import { ProductCardSchema } from "@/lib/product-card";
import { requireRequestIdentity } from "@/lib/server/auth";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { assertRequestBodySize, enforceRateLimit, securityErrorStatus } from "@/lib/server/request-security";

export const runtime = "nodejs";

async function ownedProduct(request: NextRequest, id: string) {
  const identity = await requireRequestIdentity(request);
  const admin = getSupabaseAdminClient();
  const result = await admin.from("products").select("*").eq("id", id).maybeSingle();
  if (result.error) throw new Error(`Load product: ${result.error.message}`);
  if (!result.data) throw new Error("Product not found.");
  if (identity.role !== "admin" && result.data.owner_id !== identity.id) throw new Error("You do not have access to this product.");
  return { identity, admin, product: result.data };
}

async function ensureReferenceAssets(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  referenceImages: string[],
  ownerId: string,
  isAdmin: boolean,
) {
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

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not update product.";
  return NextResponse.json(
    { error: message },
    { status: securityErrorStatus(error, /Sign in/i.test(message) ? 401 : /access|not found/i.test(message) ? 403 : 400) },
  );
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json({ product: (await ownedProduct(request, id)).product });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertRequestBodySize(request, 256 * 1024);
    const { id } = await params;
    const { admin, identity } = await ownedProduct(request, id);
    await enforceRateLimit({ request, bucket: "product-update", limit: 60, windowSeconds: 3600, identityId: identity.id });
    const product = ProductCardSchema.parse(await request.json());
    await ensureReferenceAssets(admin, product.reference_images, identity.id, identity.role === "admin");
    const result = await admin.from("products").update({
      brand_name: product.brand_name, product_name: product.product_name, reference_images: product.reference_images,
      identity_block: product.identity_block, must_preserve: product.must_preserve, negative_prompt: product.negative_prompt,
      claims_allowed: product.claims_allowed, handling_notes: product.handling_notes, updated_at: new Date().toISOString(),
    }).eq("id", id).select("*").single();
    if (result.error) throw new Error(`Update product: ${result.error.message}`);
    return NextResponse.json({ product: result.data });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { admin, identity } = await ownedProduct(request, id);
    await enforceRateLimit({ request, bucket: "product-delete", limit: 20, windowSeconds: 3600, identityId: identity.id });
    const result = await admin.from("products").delete().eq("id", id);
    if (result.error) throw new Error(`Delete product: ${result.error.message}`);
    return new NextResponse(null, { status: 204 });
  } catch (error) { return errorResponse(error); }
}
