const store = new Map();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem:    (k) => store.get(k) ?? null,
    setItem:    (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear:      () => store.clear(),
  },
  configurable: true,
  writable: true,
});
