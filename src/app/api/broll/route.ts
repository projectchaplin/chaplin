import { getHomepageBrollState } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ characters: await getHomepageBrollState() });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not load B-roll." },
      { status: 500 }
    );
  }
}
