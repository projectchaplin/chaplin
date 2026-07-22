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
    if (password.length < 8) throw new Error("Password must be at least 8 characters.");
    const supabase = getSupabaseAuthClient();

    if (action === "signup") {
      const name = typeof input.name === "string" ? input.name.trim().slice(0, 80) : "";
      const role: AccountRole = input.role === "brand" ? "brand" : "creator";
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
      const identity = await ensureAuthProfile(result.data.user);
      if (!result.data.session) return NextResponse.json({ identity, requiresEmailConfirmation: true }, { status: 201 });
      const response = NextResponse.json({ identity, requiresEmailConfirmation: false }, { status: 201 });
      setSessionCookies(response, result.data.session);
      setRoleCookie(response, identity.role);
      return response;
    }

    if (action === "login") {
      const result = await supabase.auth.signInWithPassword({ email, password });
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
