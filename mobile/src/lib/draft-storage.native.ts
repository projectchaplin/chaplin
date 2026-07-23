import "expo-sqlite/localStorage/install";

export const draftStorage: Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
> = globalThis.localStorage;
