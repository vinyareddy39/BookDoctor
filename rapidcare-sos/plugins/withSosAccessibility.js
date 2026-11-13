const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Expo Config Plugin for RapidCare-SOS Accessibility Service
 * - Adds BIND_ACCESSIBILITY_SERVICE permission and service declaration to AndroidManifest.xml
 * - Injects accessibility_service_config.xml
 * - Copies native Kotlin service and module into the generated Android source tree
 */
const withSosAccessibility = (config) => {
  // 1. Modify AndroidManifest.xml
  config = withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;

    if (!androidManifest.application[0].service) {
      androidManifest.application[0].service = [];
    }

    const services = androidManifest.application[0].service;
    const existing = services.find(
      (s) => s.$["android:name"] === "com.sosride.accessibility.SosAccessibilityService"
    );

    if (!existing) {
      services.push({
        $: {
          "android:name": "com.sosride.accessibility.SosAccessibilityService",
          "android:permission": "android.permission.BIND_ACCESSIBILITY_SERVICE",
          "android:label": "@string/accessibility_service_name",
          "android:exported": "true",
        },
        "intent-filter": [
          {
            action: [
              {
                $: {
                  "android:name": "android.accessibilityservice.AccessibilityService",
                },
              },
            ],
          },
        ],
        "meta-data": [
          {
            $: {
              "android:name": "android.accessibilityservice",
              "android:resource": "@xml/accessibility_service_config",
            },
          },
        ],
      });
    }

    return config;
  });

  // 2. Inject XML resources and Native Kotlin files during prebuild
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const resXmlDir = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/res/xml"
      );
      if (!fs.existsSync(resXmlDir)) {
        fs.mkdirSync(resXmlDir, { recursive: true });
      }

      const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:description="@string/accessibility_service_description"
    android:packageNames="com.ubercab"
    android:accessibilityEventTypes="typeWindowStateChanged|typeWindowContentChanged"
    android:accessibilityFlags="flagDefault|flagRetrieveInteractiveWindows|flagReportViewIds"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:notificationTimeout="100"
    android:canRetrieveWindowContent="true" />
`;
      fs.writeFileSync(path.join(resXmlDir, "accessibility_service_config.xml"), xmlContent, "utf-8");

      return config;
    },
  ]);

  return config;
};

module.exports = withSosAccessibility;

