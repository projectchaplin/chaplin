import { supabase } from "@/lib/supabase";

const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code = "REQUEST_FAILED",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function hasApiConfig() {
  return Boolean(baseUrl);
}

async function token() {
  const session = await supabase?.auth.getSession();
  return session?.data.session?.access_token ?? null;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (!baseUrl) {
    throw new ApiError(
      "Set EXPO_PUBLIC_API_URL in mobile/.env to connect Chaplin to the web backend.",
      0,
      "MISSING_API_URL",
    );
  }
  const accessToken = await token();
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  };
  if (!response.ok) {
    throw new ApiError(
      data.error || `Chaplin returned ${response.status}.`,
      response.status,
      data.code,
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, body: FormData) =>
    apiRequest<T>(path, { method: "POST", body }),
};
