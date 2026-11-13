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

export default { Linking, Platform, Share };
