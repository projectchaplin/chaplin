import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ensureAuthProfile,
  getSupabaseAuthClient,
  identityFromAccessToken,
  refreshAuthSession,
  type AccountRole,
} from "@/lib/server/auth";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";

function setSessionCookies(response: NextResponse, session: { access_token: string; refresh_token: string; expires_in: number }) {
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(ACCESS_COOKIE, session.access_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: session.expires_in });
  response.cookies.set(REFRESH_COOKIE, session.refresh_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

function setRoleCookie(response: NextResponse, role: AccountRole) {
  const appRole = role === "admin" ? "admin" : role === "brand" ? "brand" : "maker";
  response.cookies.set("chaplin-demo-role", appRole, { sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
}

function clearSessionCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  response.cookies.set("chaplin-demo-role", "", { path: "/", maxAge: 0 });
}

function autoConfirmEmailEnabled() {
  const configured = process.env.AUTH_AUTO_CONFIRM?.trim().toLowerCase();
  if (configured === "true") return true;
  if (configured === "false") return false;
  return process.env.NODE_ENV !== "production";
}

async function confirmAuthUser(userId: string) {
  const result = await getSupabaseAdminClient().auth.admin.updateUserById(userId, { email_confirm: true });
  if (result.error) throw new Error(`Confirm local account: ${result.error.message}`);
}

async function findAuthUserIdByEmail(email: string) {
  const admin = getSupabaseAdminClient();
  for (let page = 1; page <= 10; page += 1) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (result.error) throw new Error(`Find local account: ${result.error.message}`);
    const user = result.data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return user.id;
    if (result.data.users.length < 100) return null;
  }
  return null;
}

async function ensureSuperAdminUser(email: string, password: string, resetExisting = false) {
  const admin = getSupabaseAdminClient();
  const userId = await findAuthUserIdByEmail(email);
  const attributes = {
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: "Chaplin Super Admin",
      account_role: "admin",
    },
  };
  if (userId) {
    if (!resetExisting) return;
    const result = await admin.auth.admin.updateUserById(userId, attributes);
    if (result.error) throw new Error(`Prepare Super Admin: ${result.error.message}`);
    return;
  }
  const result = await admin.auth.admin.createUser(attributes);
  if (result.error) throw new Error(`Create Super Admin: ${result.error.message}`);
}

export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
    const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
    const identity = accessToken ? await identityFromAccessToken(accessToken) : null;
    if (identity) {
      const response = NextResponse.json({ identity });
      setRoleCookie(response, identity.role);
      return response;
    }
    if (refreshToken) {
      const refreshed = await refreshAuthSession(refreshToken);
      if (refreshed) {
        const response = NextResponse.json({ identity: refreshed.identity });
        setSessionCookies(response, refreshed.session);
        setRoleCookie(response, refreshed.identity.role);
        return response;
      }
    }
    const response = NextResponse.json({ identity: null });
    clearSessionCookies(response);
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load the account." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = await request.json() as Record<string, unknown>;
    const action = input.action;
    if (action === "logout") {
      const response = NextResponse.json({ ok: true });
      clearSessionCookies(response);
      return response;
    }

    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    const password = typeof input.password === "string" ? input.password : "";
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid email address.");
    const supabase = getSupabaseAuthClient();

    if (action === "admin-login") {
      const expectedEmail = (process.env.SUPER_ADMIN_EMAIL ?? "chaplin@chaplin.in").trim().toLowerCase();
      const expectedPassword = process.env.SUPER_ADMIN_PASSWORD ?? "chaplin";
      if (email !== expectedEmail || password !== expectedPassword) {
        throw new Error("Incorrect Super Admin email or password.");
      }
      await ensureSuperAdminUser(expectedEmail, expectedPassword);
      let result = await supabase.auth.signInWithPassword({ email: expectedEmail, password: expectedPassword });
      if (result.error) {
        await ensureSuperAdminUser(expectedEmail, expectedPassword, true);
        result = await supabase.auth.signInWithPassword({ email: expectedEmail, password: expectedPassword });
      }
      if (result.error) throw new Error(result.error.message);
      if (!result.data.session || !result.data.user) throw new Error("Supabase did not return an admin session.");
      const identity = await ensureAuthProfile(result.data.user);
      if (identity.role !== "admin") throw new Error("This account is not authorized as Super Admin.");
      const response = NextResponse.json({ identity });
      setSessionCookies(response, result.data.session);
      setRoleCookie(response, identity.role);
      return response;
    }

    if (password.length < 8) throw new Error("Password must be at least 8 characters.");

    if (action === "signup") {
      const name = typeof input.name === "string" ? input.name.trim().slice(0, 80) : "";
      const role: AccountRole = "creator";
      if (!name) throw new Error("Enter your name or studio name.");
      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name, account_role: role },
          emailRedirectTo: `${request.nextUrl.origin}/auth?confirmed=1`,
        },
      });
      if (result.error) throw new Error(result.error.message);
      if (!result.data.user) throw new Error("Supabase did not create an account.");
      let session = result.data.session;
      let user = result.data.user;
      if (!session && autoConfirmEmailEnabled()) {
        await confirmAuthUser(user.id);
        const login = await supabase.auth.signInWithPassword({ email, password });
        if (login.error) throw new Error(login.error.message);
        if (!login.data.session || !login.data.user) throw new Error("Supabase did not return a session after confirming the local account.");
        session = login.data.session;
        user = login.data.user;
      }
      const identity = await ensureAuthProfile(user);
      if (!session) return NextResponse.json({ identity, requiresEmailConfirmation: true }, { status: 201 });
      const response = NextResponse.json({ identity, requiresEmailConfirmation: false }, { status: 201 });
      setSessionCookies(response, session);
      setRoleCookie(response, identity.role);
      return response;
    }

    if (action === "login") {
      let result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error && autoConfirmEmailEnabled() && /email not confirmed/i.test(result.error.message)) {
        const userId = await findAuthUserIdByEmail(email);
        if (userId) {
          await confirmAuthUser(userId);
          result = await supabase.auth.signInWithPassword({ email, password });
        }
      }
      if (result.error) throw new Error(result.error.message);
      if (!result.data.session || !result.data.user) throw new Error("Supabase did not return a session.");
      const identity = await ensureAuthProfile(result.data.user);
      const response = NextResponse.json({ identity });
      setSessionCookies(response, result.data.session);
      setRoleCookie(response, identity.role);
      return response;
    }

    throw new Error("Unknown authentication action.");
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Authentication failed." }, { status: 400 });
  }
}
