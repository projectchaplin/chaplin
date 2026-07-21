import { seedAdminCatalog } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  try {
    return Response.json(await seedAdminCatalog());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Catalog seed failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
