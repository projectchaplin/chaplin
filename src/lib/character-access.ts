export type CharacterViewerIdentity = {
  id: string;
  role: "creator" | "admin";
} | null;

export function characterViewerAccess(identity: CharacterViewerIdentity, makerId: string) {
  const isAdmin = identity?.role === "admin";
  return {
    canManage: Boolean(identity && (isAdmin || identity.id === makerId)),
    canCast: Boolean(identity),
    isAdmin,
  };
}
