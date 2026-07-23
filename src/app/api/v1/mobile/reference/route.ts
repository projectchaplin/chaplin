import { POST as uploadReference } from "@/app/api/admin/upload/route";
import {
  mobileError,
  requireMobileIdentity,
  requireOwnedCharacter,
} from "@/lib/server/mobile-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const identity = await requireMobileIdentity(request);
    const input = await request.formData();
    const characterId =
      typeof input.get("characterId") === "string"
        ? String(input.get("characterId")).trim()
        : "";
    await requireOwnedCharacter(identity, characterId);
    const file = input.get("file");
    if (!(file instanceof File)) throw new Error("Choose an actor reference.");
    const body = new FormData();
    body.set("characterId", characterId);
    body.set("kind", "avatar");
    body.set("file", file);
    const forwarded = new Request(request.url, { method: "POST", body });
    return uploadReference(forwarded);
  } catch (error) {
    return mobileError(error);
  }
}
