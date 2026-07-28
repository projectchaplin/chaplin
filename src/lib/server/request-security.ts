import "server-only";

import { createHash, createHmac } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export class RequestSecurityError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "RequestSecurityError";
  }
}

export function securityErrorStatus(error: unknown, fallback = 400) {
  return error instanceof RequestSecurityError ? error.status : fallback;
}

export function safeInternalPath(value: unknown, fallback: string) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }
  try {
    const parsed = new URL(value, "https://chaplin.invalid");
    return parsed.origin === "https://chaplin.invalid"
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}

export function assertRequestBodySize(request: Request, maximumBytes: number) {
  const rawLength = request.headers.get("content-length");
  if (!rawLength) return;
  const length = Number(rawLength);
  if (!Number.isFinite(length) || length < 0 || length > maximumBytes) {
    throw new RequestSecurityError("The request is too large.", 413, "REQUEST_TOO_LARGE");
  }
}

export function assertMutationOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) return;
  if (/^Bearer\s+/i.test(request.headers.get("authorization") ?? "")) return;

  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    throw new RequestSecurityError("Cross-site requests are not allowed.", 403, "UNTRUSTED_ORIGIN");
  }
  if (!origin) return;

  const requestOrigin = new URL(request.url).origin;
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL
    ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin
    : requestOrigin;
  if (origin !== requestOrigin && origin !== configuredOrigin) {
    throw new RequestSecurityError("Cross-site requests are not allowed.", 403, "UNTRUSTED_ORIGIN");
  }
}

function requestAddress(request: Request) {
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]
    ?? request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-real-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]
    ?? "unknown"
  ).trim();
}

function privateFingerprint(value: string) {
  const secret =
    process.env.RATE_LIMIT_SALT
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? "chaplin-rate-limit";
  return createHmac("sha256", secret).update(value).digest("hex").slice(0, 32);
}

export async function enforceRateLimit(input: {
  request: Request;
  bucket: string;
  limit: number;
  windowSeconds: number;
  identityId?: string;
  discriminator?: string;
}) {
  if (process.env.NODE_ENV === "test") return;
  const address = privateFingerprint(requestAddress(input.request));
  const discriminator = input.discriminator
    ? createHash("sha256").update(input.discriminator.toLowerCase()).digest("hex").slice(0, 20)
    : "none";
  const subject = input.identityId ? `user:${input.identityId}` : `ip:${address}`;
  const key = `${input.bucket}:${subject}:d:${discriminator}`;
  const result = await getSupabaseAdminClient().rpc("consume_api_rate_limit", {
    requested_key: key,
    requested_limit: input.limit,
    requested_window_seconds: input.windowSeconds,
  });
  if (result.error) {
    throw new RequestSecurityError(
      "Request protection is temporarily unavailable.",
      503,
      "RATE_LIMIT_UNAVAILABLE",
    );
  }
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!row || row.allowed !== true) {
    throw new RequestSecurityError(
      "Too many requests. Please wait and try again.",
      429,
      "RATE_LIMITED",
    );
  }
}
