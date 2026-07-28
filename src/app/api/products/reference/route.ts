import { NextRequest, NextResponse } from "next/server";
import { requireRequestIdentity } from "@/lib/server/auth";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { assertRequestBodySize, enforceRateLimit, securityErrorStatus } from "@/lib/server/request-security";

export const runtime = "nodejs";

const IMAGE_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    assertRequestBodySize(request, MAX_IMAGE_BYTES + 128 * 1024);
    const identity = await requireRequestIdentity(request);
    await enforceRateLimit({ request, bucket: "product-reference-upload", limit: 20, windowSeconds: 86400, identityId: identity.id });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Upload a PNG, JPEG, or WebP product image." }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Product image must be between 1 byte and 12 MB." }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const png = file.type === "image/png" && bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const jpeg = file.type === "image/jpeg" && bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const webp = file.type === "image/webp" && bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (!png && !jpeg && !webp) {
      return NextResponse.json({ error: "The uploaded file does not match its image type." }, { status: 400 });
    }
    const storagePath = `products/${identity.id}/${crypto.randomUUID()}.${IMAGE_TYPES.get(file.type)}`;
    const admin = getSupabaseAdminClient();
    const upload = await admin.storage
      .from("character-media")
      .upload(storagePath, bytes, {
        contentType: file.type,
        upsert: false,
      });
    if (upload.error) throw new Error(`Upload product image: ${upload.error.message}`);
    const url = admin.storage.from("character-media").getPublicUrl(storagePath).data.publicUrl;
    const asset = await admin.from("media_assets").insert({
      character_id: null,
      kind: "reference",
      provider: "upload",
      url,
      storage_path: storagePath,
      metadata: { ownerId: identity.id, filename: file.name.slice(0, 180), purpose: "product_reference" },
    }).select("id").single();
    if (asset.error || !asset.data) throw new Error(`Save product reference: ${asset.error?.message ?? "no asset returned"}`);
    return NextResponse.json({
      assetId: asset.data.id,
      url,
      storagePath,
      name: file.name.slice(0, 180),
      contentType: file.type,
      size: file.size,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Product image upload failed.";
    return NextResponse.json(
      { error: message },
      { status: securityErrorStatus(error, message === "Sign in to continue." ? 401 : 500) },
    );
  }
}
