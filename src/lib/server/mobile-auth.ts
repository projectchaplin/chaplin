import "server-only";

import type { AuthIdentity } from "@/lib/server/auth";
import { identityFromAccessToken } from "@/lib/server/auth";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function requireMobileIdentity(request: Request) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) throw new Error("Sign in to continue.");
  const identity = await identityFromAccessToken(match[1]);
  if (!identity) throw new Error("Your session expired. Sign in again.");
  return identity;
}

export function mobileError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "The mobile request failed.";
  const status =
    message === "Sign in to continue." ||
    message === "Your session expired. Sign in again."
      ? 401
      : message.includes("not found") || message.includes("does not belong")
        ? 404
        : message.includes("allowance")
          ? 429
          : 400;
  return Response.json(
    {
      error: message,
      code:
        status === 401
          ? "UNAUTHENTICATED"
          : status === 429
            ? "BETA_ALLOWANCE_EXHAUSTED"
            : "INVALID_REQUEST",
    },
    { status },
  );
}

export async function requireOwnedCharacter(
  identity: AuthIdentity,
  characterId: string,
) {
  if (!characterId.trim()) throw new Error("Choose an actor.");
  const result = await getSupabaseAdminClient()
    .from("characters")
    .select("id,maker_id")
    .eq("id", characterId.trim())
    .maybeSingle();
  if (result.error) throw new Error(`Load actor ownership: ${result.error.message}`);
  if (!result.data || result.data.maker_id !== identity.id) {
    throw new Error("This actor does not belong to your studio.");
  }
}

export async function enforceMobileBetaAllowance(
  identity: AuthIdentity,
  characterId: string,
) {
  if (identity.role === "admin") return;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const result = await getSupabaseAdminClient()
    .from("generation_jobs")
    .select("id", { count: "exact", head: true })
    .eq("character_id", characterId)
    .gte("created_at", since);
  if (result.error) throw new Error(`Check beta allowance: ${result.error.message}`);
  if ((result.count ?? 0) >= 12) {
    throw new Error(
      "This actor has used today’s free beta allowance. Try again tomorrow.",
    );
  }
}
