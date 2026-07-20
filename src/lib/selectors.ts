import type { ChaplinWorld } from "@/lib/types";

// Pure helpers over a world slice. The traceability walk lives here so every
// screen (character profile, story player, studio, ledger) reads the chain
// the same way: character -> castings -> stories -> ledger -> maker.

export function getCharacter(world: ChaplinWorld, id: string) {
  return world.characters.find((c) => c.id === id);
}

export function getStory(world: ChaplinWorld, id: string) {
  return world.stories.find((s) => s.id === id);
}

export function getUser(world: ChaplinWorld, id: string) {
  return world.users.find((u) => u.id === id);
}

export function castingsForCharacter(world: ChaplinWorld, characterId: string) {
  return world.castings.filter((c) => c.characterId === characterId);
}

export function castingsForStory(world: ChaplinWorld, storyId: string) {
  return world.castings.filter((c) => c.storyId === storyId);
}

/** The character's "résumé": every story it has been cast in, newest first. */
export function resumeForCharacter(world: ChaplinWorld, characterId: string) {
  const castings = castingsForCharacter(world, characterId);
  return castings
    .map((cst) => ({ casting: cst, story: getStory(world, cst.storyId) }))
    .filter((r): r is { casting: (typeof castings)[number]; story: NonNullable<ReturnType<typeof getStory>> } => Boolean(r.story))
    .sort((a, b) => (a.casting.timestamp < b.casting.timestamp ? 1 : -1));
}

/** Full cast list for a story, each entry carrying its character record. */
export function castForStory(world: ChaplinWorld, storyId: string) {
  return castingsForStory(world, storyId)
    .map((cst) => ({ casting: cst, character: getCharacter(world, cst.characterId) }))
    .filter((r): r is { casting: (typeof world.castings)[number]; character: NonNullable<ReturnType<typeof getCharacter>> } =>
      Boolean(r.character)
    );
}

export function ledgerForCharacter(world: ChaplinWorld, characterId: string) {
  return world.ledger
    .filter((l) => l.characterId === characterId)
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

export function ledgerForMaker(world: ChaplinWorld, makerId: string) {
  return world.ledger
    .filter((l) => l.makerId === makerId)
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

export function charactersByMaker(world: ChaplinWorld, makerId: string) {
  return world.characters.filter((c) => c.makerId === makerId);
}

export function storiesByAuthor(world: ChaplinWorld, authorId: string) {
  return world.stories.filter((s) => s.authorId === authorId);
}

export function makerEarnings(world: ChaplinWorld, makerId: string) {
  return ledgerForMaker(world, makerId).reduce((sum, l) => sum + l.amount, 0);
}

/** Full ledger, richly joined for the global traceability table. */
export function topCharactersByEarnings(world: ChaplinWorld, limit = 5) {
  return [...world.characters]
    .sort((a, b) => b.stats.earnings - a.stats.earnings)
    .slice(0, limit);
}

export function topCharactersByFans(world: ChaplinWorld, limit = 6) {
  return [...world.characters].sort((a, b) => b.stats.fans - a.stats.fans).slice(0, limit);
}

export function recentStories(world: ChaplinWorld, limit = 6) {
  return [...world.stories]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit);
}

export function availableForCasting(world: ChaplinWorld, limit = 8) {
  return [...world.characters]
    .sort((a, b) => b.stats.castings - a.stats.castings)
    .slice(0, limit);
}
