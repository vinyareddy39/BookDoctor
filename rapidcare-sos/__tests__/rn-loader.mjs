import fs from "node:fs";
import { fileURLToPath } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "react-native") {
    return {
      format: "module",
      shortCircuit: true,
      url: new URL("./rn-mock.mjs", import.meta.url).href,
    };
  }

  if (specifier === "expo-sms") {
    return {
      format: "module",
      shortCircuit: true,
      url: new URL("./expo-sms-mock.mjs", import.meta.url).href,
    };
  }

  // Handle extensionless relative imports for TypeScript
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const parentURL = context.parentURL;
    if (parentURL) {
      const candidateURL = new URL(specifier, parentURL);
      const filePath = fileURLToPath(candidateURL);

      for (const ext of [".ts", ".tsx", ".js", ".json"]) {
        if (fs.existsSync(filePath + ext)) {
          return nextResolve(specifier + ext, context);
        }
      }
    }
  }

  return nextResolve(specifier, context);
}
