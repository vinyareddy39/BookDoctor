export const Linking = {
  openedUrls: [],
  failNativeApp: false,
  async openURL(url) {
    Linking.openedUrls.push(url);
    if (Linking.failNativeApp && url.startsWith("uber://")) {
      throw new Error(`Native app open failed for ${url}`);
    }
    return true;
  },
  async canOpenURL(url) {
    if (Linking.failNativeApp && url.startsWith("uber://")) return false;
    return true;
  },
  reset() {
    Linking.openedUrls = [];
    Linking.failNativeApp = false;
  }
};

export const Platform = {
  OS: "android",
  select(obj) {
    return obj[Platform.OS] ?? obj.default;
  }
};

export const Share = {
  sharedItems: [],
  async share(content, options) {
    Share.sharedItems.push({ content, options });
    return { action: "sharedAction" };
  },
  reset() {
    Share.sharedItems = [];
  }
};

export const NativeModules = {
  SosAccessibilityModule: {
    isAccessibilityServiceEnabled: async () => false,
    startSosAutoConfirm: async () => true,
    stopSosAutoConfirm: async () => true,
    openAccessibilitySettings: async () => true,
    getCalibrationDump: async () => "[]",
  }
};

export class NativeEventEmitter {
  constructor(module) {
    this.module = module;
    this.listeners = new Map();
  }
  addListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return {
      remove: () => {
        this.listeners.get(event)?.delete(callback);
      }
    };
  }
  emit(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const h of handlers) h(data);
    }
  }
  removeAllListeners() {
    this.listeners.clear();
  }
}

export default { Linking, Platform, Share, NativeModules, NativeEventEmitter };
