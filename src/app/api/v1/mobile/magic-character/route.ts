import { POST as writeCharacter } from "@/app/api/write/character/route";
import { mobileError, requireMobileIdentity } from "@/lib/server/mobile-auth";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    await requireMobileIdentity(request);
    const body = await request.text();
    const forwarded = new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return writeCharacter(forwarded);
  } catch (error) {
    return mobileError(error);
  }
}
