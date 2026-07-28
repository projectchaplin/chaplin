import { notFound } from "next/navigation";
import CharacterProfilePage from "@/components/CharacterProfilePage";
import { characterViewerAccess } from "@/lib/character-access";
import { getServerAuthIdentity } from "@/lib/server/auth";
import { listCharacters } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

export default async function CharacterProfileRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [identity, characters] = await Promise.all([
    getServerAuthIdentity(),
    listCharacters(),
  ]);
  const character = characters.find((item) => item.id === id);
  if (!character) notFound();

  return (
    <CharacterProfilePage
      initialCharacter={character}
      viewerAccess={characterViewerAccess(identity, character.makerId)}
    />
  );
}
