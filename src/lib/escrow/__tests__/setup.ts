if (!globalThis.navigator) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).navigator = {
    clipboard: {
      writeText: async () => {},
    },
    onLine: true,
  };
}

if (!globalThis.localStorage) {
  let store: Record<string, string> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
}
