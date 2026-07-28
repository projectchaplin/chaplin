import "server-only";

import { createClient, type Session, type User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { ensureWelcomeCredits } from "@/lib/server/credits";
import { CHAPLIN_BRAND_AVATAR, userAvatarUrl } from "@/lib/user-avatars";

export type AccountRole = "creator" | "admin";

export type AuthIdentity = {
  id: string;
  email: string;
  name: string;
  role: AccountRole;
  imageUrl: string;
  creditBalance: number | null;
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
  return ["maker"];
}

function requestedRole(user: User): AccountRole {
  const metadataRole = user.user_metadata?.account_role;
  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL ?? "chaplin@chaplin.in").trim().toLowerCase();
  if (superAdminEmail && user.email?.toLowerCase() === superAdminEmail) return "admin";
  return metadataRole === "admin" ? "admin" : "creator";
}

export async function ensureAuthProfile(user: User): Promise<AuthIdentity> {
  if (!user.email) throw new Error("The authenticated account has no email address.");
  const admin = getSupabaseAdminClient();
  const role = requestedRole(user);
  const name = role === "admin"
    ? "Chaplin"
    : String(user.user_metadata?.display_name ?? user.email.split("@")[0] ?? "Chaplin Creator").trim().slice(0, 80);
  const handleBase = user.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").toLowerCase() || "creator";
  const handle = role === "admin" ? "@chaplin" : `@${handleBase}_${user.id.slice(0, 4)}`;
  const existingUser = await admin
    .from("users")
    .select("image_url")
    .eq("id", user.id)
    .maybeSingle();
  if (existingUser.error) throw new Error(`Load creator avatar: ${existingUser.error.message}`);
  const imageUrl = role === "admin"
    ? CHAPLIN_BRAND_AVATAR
    : existingUser.data?.image_url || userAvatarUrl(user.id);

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
    avatar_hue: role === "admin" ? 165 : 202,
    image_url: imageUrl,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (userResult.error) throw new Error(`Save authenticated creator: ${userResult.error.message}`);

  const creditBalance = role === "creator" ? await ensureWelcomeCredits(user.id) : null;
  return { id: user.id, email: user.email, name, role, imageUrl, creditBalance };
}

export async function identityFromAccessToken(accessToken: string) {
  const result = await getSupabaseAuthClient().auth.getUser(accessToken);
  if (result.error || !result.data.user) return null;
  return ensureAuthProfile(result.data.user);
}

export async function requireRequestIdentity(request: NextRequest | Request) {
  const requestWithCookies = request as NextRequest;
  const cookieToken = typeof requestWithCookies.cookies?.get === "function"
    ? requestWithCookies.cookies.get(ACCESS_COOKIE)?.value
    : undefined;
  const bearerToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const accessToken = cookieToken ?? bearerToken;
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
