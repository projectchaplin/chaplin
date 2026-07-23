import { NextRequest, NextResponse } from "next/server";
import { requireRequestIdentity } from "@/lib/server/auth";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";

const IMAGE_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const identity = await requireRequestIdentity(request);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Upload a PNG, JPEG, or WebP product image." }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Product image must be between 1 byte and 12 MB." }, { status: 400 });
    }

    const storagePath = `products/${identity.id}/${crypto.randomUUID()}.${IMAGE_TYPES.get(file.type)}`;
    const admin = getSupabaseAdminClient();
    const upload = await admin.storage
      .from("character-media")
      .upload(storagePath, await file.arrayBuffer(), {
        contentType: file.type,
        upsert: false,
      });
    if (upload.error) throw new Error(`Upload product image: ${upload.error.message}`);
    const url = admin.storage.from("character-media").getPublicUrl(storagePath).data.publicUrl;
    return NextResponse.json({
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
      { status: message === "Sign in to continue." ? 401 : 500 },
    );
  }
}
