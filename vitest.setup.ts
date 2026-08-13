/**
 * A localStorage for the `node` test environment.
 *
 * The plan, the part habits, the profile prefs and the receipt aliases all live
 * in localStorage, which `node` does not have. Tests that need isolation still
 * stub their own via `vi.stubGlobal` — this only stops the ones that don't from
 * dying on `localStorage is not defined`.
 */
const store = new Map<string, string>()

const localStorageStub: Storage = {
  get length() {
    return store.size
  },
  clear: () => store.clear(),
  getItem: (key: string) => store.get(key) ?? null,
  key: (index: number) => [...store.keys()][index] ?? null,
  removeItem: (key: string) => {
    store.delete(key)
  },
  setItem: (key: string, value: string) => {
    store.set(key, String(value))
  },
}

// Defined unconditionally: Node 25 already exposes a `localStorage` global, but
// without `--experimental-webstorage` it carries none of the methods, so an
// `in` check would see it and skip the replacement.
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageStub,
  configurable: true,
  writable: true,
})
