import { notFound, redirect } from "next/navigation";
import CharacterContextGraph from "@/components/CharacterContextGraph";
import CharacterNodeWorkspace from "@/components/CharacterNodeWorkspace";
import { buildCharacterGraph } from "@/lib/character-graph";
import { getServerAuthIdentity } from "@/lib/server/auth";
import { listCharacters } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

export default async function CharacterSystemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const identity = await getServerAuthIdentity();
  if (identity?.role !== "admin") {
    redirect(`/super-admin?next=${encodeURIComponent(`/characters/${id}/system`)}`);
  }

  const characters = await listCharacters();
  const character = characters.find((item) => item.id === id);
  if (!character) notFound();

  const graph = buildCharacterGraph(character);

  return (
    <>
      {/* The graph first: it answers where every prompt's context comes from,
          which is the question the workspace below assumes you already know. */}
      <section className="app-width px-4 pt-8 sm:px-6" data-character-context-graph>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">Context map</p>
        <h1 className="reel-title mt-1 text-3xl">Where {character.name} comes from</h1>
        <p className="mt-1.5 max-w-2xl text-xs leading-5 text-grey">
          Every generator reads a specific part of this character. These edges are the routing contract the
          prompt builders enforce, not an illustration — if a node feeds Dialogue and nothing else, that is
          exactly what happens at generation time.
        </p>
        <div className="mt-4 rounded-2xl border border-line bg-black/20 p-3 sm:p-4">
          <CharacterContextGraph graph={graph} />
        </div>
      </section>
      <CharacterNodeWorkspace character={character} />
    </>
  );
}
