const memory = new Map<string, string>();

const fallbackStorage: Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
> = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => {
    memory.set(key, value);
  },
  removeItem: (key) => {
    memory.delete(key);
  },
};

export const draftStorage =
  typeof globalThis.localStorage === "undefined"
    ? fallbackStorage
    : globalThis.localStorage;
