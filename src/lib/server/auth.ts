import "server-only";

import { createClient, type Session, type User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export type AccountRole = "creator" | "brand" | "admin";

export type AuthIdentity = {
  id: string;
  email: string;
  name: string;
  role: AccountRole;
};

export const ACCESS_COOKIE = "chaplin-access-token";
export const REFRESH_COOKIE = "chaplin-refresh-token";

export function getSupabaseAuthClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase Auth needs SUPABASE_URL and SUPABASE_ANON_KEY in .env.local.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function roleBadges(role: AccountRole) {
  if (role === "admin") return ["admin"];
  if (role === "brand") return ["brand"];
  return ["maker", "caster"];
}

function requestedRole(user: User): AccountRole {
  const metadataRole = user.user_metadata?.account_role;
  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL ?? "chaplin@chaplin.in").trim().toLowerCase();
  if (superAdminEmail && user.email?.toLowerCase() === superAdminEmail) return "admin";
  return metadataRole === "brand" ? "brand" : "creator";
}

export async function ensureAuthProfile(user: User): Promise<AuthIdentity> {
  if (!user.email) throw new Error("The authenticated account has no email address.");
  const admin = getSupabaseAdminClient();
  const role = requestedRole(user);
  const name = String(user.user_metadata?.display_name ?? user.email.split("@")[0] ?? "Chaplin Creator").trim().slice(0, 80);
  const handleBase = user.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").toLowerCase() || "creator";
  const handle = `@${handleBase}_${user.id.slice(0, 4)}`;

  const profileResult = await admin.from("user_profiles").upsert({
    user_id: user.id,
    email: user.email,
    display_name: name,
    account_role: role,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (profileResult.error) throw new Error(`Save authenticated profile: ${profileResult.error.message}`);

  const userResult = await admin.from("users").upsert({
    id: user.id,
    name,
    handle,
    role_badges: roleBadges(role),
    avatar_initial: name.slice(0, 1).toUpperCase(),
    avatar_hue: role === "brand" ? 28 : role === "admin" ? 165 : 202,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (userResult.error) throw new Error(`Save authenticated creator: ${userResult.error.message}`);

  return { id: user.id, email: user.email, name, role };
}

export async function identityFromAccessToken(accessToken: string) {
  const result = await getSupabaseAuthClient().auth.getUser(accessToken);
  if (result.error || !result.data.user) return null;
  return ensureAuthProfile(result.data.user);
}

export async function requireRequestIdentity(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const identity = accessToken ? await identityFromAccessToken(accessToken) : null;
  if (!identity) throw new Error("Sign in to continue.");
  return identity;
}

export async function getServerAuthIdentity() {
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  return accessToken ? identityFromAccessToken(accessToken) : null;
}

export async function refreshAuthSession(refreshToken: string): Promise<{ session: Session; identity: AuthIdentity } | null> {
  const result = await getSupabaseAuthClient().auth.refreshSession({ refresh_token: refreshToken });
  if (result.error || !result.data.session || !result.data.user) return null;
  return { session: result.data.session, identity: await ensureAuthProfile(result.data.user) };
}
