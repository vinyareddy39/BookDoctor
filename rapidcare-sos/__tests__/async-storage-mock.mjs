const storage = new Map();

export const AsyncStorage = {
  getItem: async (key) => storage.get(key) ?? null,
  setItem: async (key, value) => {
    storage.set(key, String(value));
  },
  removeItem: async (key) => {
    storage.delete(key);
  },
  clear: async () => {
    storage.clear();
  },
  getAllKeys: async () => Array.from(storage.keys()),
};

export default AsyncStorage;

