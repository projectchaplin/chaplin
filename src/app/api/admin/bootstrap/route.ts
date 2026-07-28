import { seedAdminCatalog } from "@/lib/server/supabase-admin";
import { requireAdminIdentity } from "@/lib/server/auth";
import { securityErrorStatus } from "@/lib/server/request-security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  try {
    await requireAdminIdentity(request);
    return Response.json(await seedAdminCatalog());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Catalog seed failed.";
    return Response.json(
      { error: message },
      { status: securityErrorStatus(error, message === "Sign in to continue." ? 401 : 500) },
    );
  }
}
