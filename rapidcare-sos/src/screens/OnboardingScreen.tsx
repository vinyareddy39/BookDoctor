import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Linking,
  Alert,
  Switch,
  ActivityIndicator,
  Modal,
  Platform,
} from "react-native";
import { useStore } from "../store/useStore";
import type { User } from "../types/index";
import { EMERGENCY_CONFIG, isLocalhostUrl } from "../config/emergencyConfig";
import {
  testServerConnection,
  ensureDeviceAuthToken,
  setCachedDeviceId,
  setCachedAuthToken,
  ServerConnectionTestResult,
} from "../services/apiClient";
import {
  isAccessibilityServiceEnabled,
  openAccessibilitySettings,
  getCalibrationDump,
} from "../services/accessibilityService";

export default function OnboardingScreen({ navigation }: any) {
  const user = useStore((state) => state.user);
  const deviceId = useStore((state) => state.deviceId);
  const serverAuthToken = useStore((state) => state.serverAuthToken);
  const outboundVoiceCallEnabled = useStore((state) => state.outboundVoiceCallEnabled);
  const autoConfirmEnabled = useStore((state) => state.autoConfirmEnabled);
  const autoConfirmDisclosed = useStore((state) => state.autoConfirmDisclosed);
  const setUser = useStore((state) => state.setUser);
  const setServerAuthToken = useStore((state) => state.setServerAuthToken);
  const setOutboundVoiceCallEnabled = useStore((state) => state.setOutboundVoiceCallEnabled);
  const setAutoConfirmEnabled = useStore((state) => state.setAutoConfirmEnabled);
  const setAutoConfirmDisclosed = useStore((state) => state.setAutoConfirmDisclosed);
  const emergencyKillSwitch = useStore((state) => state.emergencyKillSwitch);
  const uberConnection = useStore((state) => state.uberConnection);
  const setUberConnection = useStore((state) => state.setUberConnection);
  const disconnectUber = useStore((state) => state.disconnectUber);

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [bloodGroup, setBloodGroup] = useState(user?.medicalId?.bloodGroup || "");
  const [allergies, setAllergies] = useState(user?.medicalId?.allergies || "");
  const [conditions, setConditions] = useState(user?.medicalId?.conditions || "");
  const [medications, setMedications] = useState(user?.medicalId?.medications || "");

  // Server connection check state
  const [testingConn, setTestingConn] = useState(false);
  const [connResult, setConnResult] = useState<ServerConnectionTestResult | null>(null);

  // Accessibility state
  const [serviceEnabledInOs, setServiceEnabledInOs] = useState(false);
  const [showDisclosureModal, setShowDisclosureModal] = useState(false);
  const [showDumpModal, setShowDumpModal] = useState(false);
  const [calibrationDumpText, setCalibrationDumpText] = useState("");

  useEffect(() => {
    if (Platform.OS === "android") {
      isAccessibilityServiceEnabled().then(setServiceEnabledInOs).catch(() => {});
    }
  }, []);

  const configuredApiUrl = EMERGENCY_CONFIG.API_URL;
  const isLocalWarning = !configuredApiUrl || isLocalhostUrl(configuredApiUrl);

  const handleTestServerConnection = async () => {
    setTestingConn(true);
    setConnResult(null);
    const result = await testServerConnection(configuredApiUrl);
    setConnResult(result);
    setTestingConn(false);
  };

  const handleSave = () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert("Required Fields", "Name and Phone number are required.");
      return;
    }

    const updatedUser: User = {
      id: user?.id || `user_${Date.now()}`,
      name: name.trim(),
      phone: phone.trim(),
      medicalId: {
        bloodGroup,
        allergies,
        conditions,
        medications,
      },
      contacts: user?.contacts || [],
    };

    setUser(updatedUser);
    navigation.replace("Home");
  };

  /**
   * Connect Uber OAuth Flow
   * Authenticates device session if needed, fetches OAuth authorize URL from server, and opens browser/app.
   */
  const handleConnectUber = async () => {
    try {
      const serverBase = EMERGENCY_CONFIG.API_URL;
      if (serverBase && !isLocalhostUrl(serverBase)) {
        setCachedDeviceId(deviceId);
        if (serverAuthToken) setCachedAuthToken(serverAuthToken);

        const token = await ensureDeviceAuthToken(serverBase, deviceId, name);
        if (token) setServerAuthToken(token);

        const res = await fetch(`${serverBase}/api/uber/connect`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const data = await res.json();
        if (res.ok && data?.url) {
          await Linking.openURL(data.url);
          return;
        } else if (data?.error) {
          Alert.alert("Uber OAuth Configuration Notice", data.error);
          return;
        }
      }
    } catch (err: any) {
      console.warn("[UberConnect] Server connect fetch notice:", err.message);
    }

    // Direct sandbox/dev connection toggle for offline/local testing
    Alert.alert(
      "Connect Uber Account",
      "Authorize RapidCare SOS to request emergency rides in Sandbox mode.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Connect (Sandbox Mode)",
          onPress: () => {
            setUberConnection({
              connected: true,
              accessToken: "sandbox_uber_oauth_token",
              riderName: name || "Verified Rider",
              expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
            });
            Alert.alert("Uber Connected", "Your Uber account is connected for auto-booking.");
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Settings & Medical ID</Text>
        <Text style={styles.subtitle}>
          Configure server connectivity, Uber linking, safety preferences, and triage details.
        </Text>

        {/* Server Connectivity Section */}
        <View style={styles.serverCard}>
          <Text style={styles.cardTitle}>🌐 Backend Server Connectivity</Text>
          <Text style={styles.urlValue}>
            API URL: {configuredApiUrl || "(Not set — edit EXPO_PUBLIC_API_URL in .env)"}
          </Text>
          {isLocalWarning && (
            <Text style={styles.localWarningText}>
              ⚠️ Real phones cannot reach localhost. Set EXPO_PUBLIC_API_URL in rapidcare-sos/.env to your computer's LAN IP or an ngrok HTTPS URL.
            </Text>
          )}
          <TouchableOpacity
            style={styles.testConnBtn}
            onPress={handleTestServerConnection}
            disabled={testingConn}
            accessibilityLabel="Test server connection"
          >
            {testingConn ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.testConnBtnText}>Test server connection</Text>
            )}
          </TouchableOpacity>
          {connResult && (
            <View style={[styles.connResultBox, connResult.ok ? styles.connOk : styles.connErr]}>
              <Text style={connResult.ok ? styles.connOkText : styles.connErrText}>
                {connResult.ok
                  ? `✅ Connected (${connResult.latencyMs}ms) — Status: ${connResult.data?.status} | Uber: ${connResult.data?.uberEnv} | SMS: ${connResult.data?.smsProvider}`
                  : `❌ ${connResult.error}`}
              </Text>
            </View>
          )}
        </View>

        {/* Uber Connection Section */}
        <View style={styles.uberCard}>
          <Text style={styles.cardTitle}>🚗 Uber Integration</Text>
          <Text style={styles.uberDesc}>
            Connect your Uber account so emergency rides to the nearest ER can display live fare estimates and request automatically.
          </Text>
          {uberConnection.connected ? (
            <View style={styles.uberConnectedRow}>
              <Text style={styles.uberStatusActive}>✅ Connected as {uberConnection.riderName || "Rider"}</Text>
              <TouchableOpacity style={styles.disconnectBtn} onPress={disconnectUber}>
                <Text style={styles.disconnectBtnText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.connectUberBtn} onPress={handleConnectUber}>
              <Text style={styles.connectUberBtnText}>Connect Uber Account</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Outbound Voice Call Safety Setting (OFF by default) */}
        <View style={styles.voiceCard}>
          <View style={styles.voiceRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.cardTitle}>📞 Automated Outbound Voice Call</Text>
              <Text style={styles.voiceDesc}>
                Disabled by default. When OFF, emergency buttons only open your phone's native 108/112 dialer and never trigger Twilio voice calls.
              </Text>
            </View>
            <Switch
              value={outboundVoiceCallEnabled}
              onValueChange={setOutboundVoiceCallEnabled}
              accessibilityLabel="Toggle automated outbound emergency voice call"
            />
          </View>
        </View>

        {/* Android Accessibility Auto-Confirm (OFF by default) */}
        <View style={styles.accessibilityCard}>
          <View style={styles.accessibilityHeaderRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.cardTitle}>🤖 Android Uber Auto-Confirm</Text>
              <Text style={styles.accessibilityDesc}>
                Uses Android Accessibility Service to automatically tap "Confirm" inside the official Uber app during an SOS emergency. Strictly OFF by default.
              </Text>
            </View>
            <Switch
              value={autoConfirmEnabled}
              onValueChange={(val) => {
                if (val) {
                  if (!autoConfirmDisclosed) {
                    setShowDisclosureModal(true);
                  } else {
                    setAutoConfirmEnabled(true);
                  }
                } else {
                  emergencyKillSwitch();
                }
              }}
              accessibilityLabel="Toggle Android Uber auto-confirm"
            />
          </View>

          {autoConfirmEnabled && (
            <View style={styles.accessibilityActiveBox}>
              <Text style={styles.accessibilityActiveTitle}>⚡ AUTO-CONFIRM ARMED</Text>
              <Text style={styles.accessibilityActiveDetail}>
                System Service: {serviceEnabledInOs ? "✅ Enabled in Android OS" : "⚠️ Not Enabled in OS Settings"}
              </Text>

              <View style={styles.accessibilityBtnRow}>
                <TouchableOpacity
                  style={styles.openSettingsBtn}
                  onPress={async () => {
                    await openAccessibilitySettings();
                    const enabled = await isAccessibilityServiceEnabled();
                    setServiceEnabledInOs(enabled);
                  }}
                >
                  <Text style={styles.openSettingsBtnText}>Open Accessibility Settings</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dumpBtn}
                  onPress={async () => {
                    const dump = await getCalibrationDump();
                    setCalibrationDumpText(dump || "No calibration events recorded yet.");
                    setShowDumpModal(true);
                  }}
                >
                  <Text style={styles.dumpBtnText}>Calibration Dump</Text>
                </TouchableOpacity>
              </View>

              {/* Instant Kill Switch */}
              <TouchableOpacity
                style={styles.killSwitchBtn}
                onPress={() => {
                  emergencyKillSwitch();
                  Alert.alert("Kill Switch Triggered", "Auto-confirm has been instantly disabled.");
                }}
              >
                <Text style={styles.killSwitchText}>🛑 EMERGENCY KILL SWITCH: DISABLE NOW</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Accessibility Disclosure Modal */}
        <Modal
          visible={showDisclosureModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDisclosureModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>⚠️ Android Accessibility Disclosure</Text>
              <ScrollView style={styles.modalScroll}>
                <Text style={styles.modalTextBold}>
                  RapidCare SOS requires clear, informed consent before enabling automatic ride confirmation:
                </Text>
                <Text style={styles.modalBullet}>
                  • <Text style={styles.boldText}>Destination Verification:</Text> Before tapping Confirm, the service checks that the screen shows the nearest ER hospital name or address. If mismatched, automation is blocked immediately.
                </Text>
                <Text style={styles.modalBullet}>
                  • <Text style={styles.boldText}>Surge & Fare Protection:</Text> Never confirms dialogs mentioning surge pricing, fares, cost increases, or payment updates.
                </Text>
                <Text style={styles.modalBullet}>
                  • <Text style={styles.boldText}>Watchdog Timer (45s):</Text> If Uber fails to confirm within 45 seconds, the service automatically disarms, alerts emergency contacts, and presents the 108/112 dialer.
                </Text>
                <Text style={styles.modalBullet}>
                  • <Text style={styles.boldText}>Privacy Protection:</Text> Zero personal identifiable information (phone numbers, GPS coordinates) is ever written to logs.
                </Text>
                <Text style={styles.modalBullet}>
                  • <Text style={styles.boldText}>Instant Kill Switch:</Text> You can disable this feature at any moment with one tap.
                </Text>
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowDisclosureModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalAgreeBtn}
                  onPress={async () => {
                    setAutoConfirmDisclosed(true);
                    setAutoConfirmEnabled(true);
                    setShowDisclosureModal(false);
                    if (Platform.OS === "android") {
                      const enabled = await isAccessibilityServiceEnabled();
                      setServiceEnabledInOs(enabled);
                      if (!enabled) {
                        Alert.alert(
                          "Enable RapidCare Service",
                          "Please enable 'RapidCare SOS Ride Service' under Installed Apps in Android Accessibility settings.",
                          [
                            { text: "Later", style: "cancel" },
                            { text: "Open Settings", onPress: () => openAccessibilitySettings() },
                          ]
                        );
                      }
                    }
                  }}
                >
                  <Text style={styles.modalAgreeText}>I Agree & Enable</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Calibration Dump Modal */}
        <Modal
          visible={showDumpModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDumpModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>🔍 Calibration Screen Dump</Text>
              <ScrollView style={styles.dumpScroll}>
                <Text style={styles.dumpText}>{calibrationDumpText}</Text>
              </ScrollView>
              <TouchableOpacity
                style={styles.modalAgreeBtn}
                onPress={() => setShowDumpModal(false)}
              >
                <Text style={styles.modalAgreeText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Text style={styles.label}>Full Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. John Doe"
          placeholderTextColor="#888"
        />

        <Text style={styles.label}>Phone Number *</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="+91 98765 43210"
          placeholderTextColor="#888"
        />

        <Text style={styles.label}>Blood Group</Text>
        <TextInput
          style={styles.input}
          value={bloodGroup}
          onChangeText={setBloodGroup}
          placeholder="O+, A+, B-, etc."
          placeholderTextColor="#888"
        />

        <Text style={styles.label}>Allergies</Text>
        <TextInput
          style={styles.input}
          value={allergies}
          onChangeText={setAllergies}
          placeholder="e.g. Penicillin, Peanuts"
          placeholderTextColor="#888"
        />

        <Text style={styles.label}>Medical Conditions</Text>
        <TextInput
          style={styles.input}
          value={conditions}
          onChangeText={setConditions}
          placeholder="e.g. Asthma, Diabetes, Hypertension"
          placeholderTextColor="#888"
        />

        <Text style={styles.label}>Current Medications</Text>
        <TextInput
          style={styles.input}
          value={medications}
          onChangeText={setMedications}
          placeholder="e.g. Inhaler, Metformin"
          placeholderTextColor="#888"
        />

        <TouchableOpacity style={styles.button} onPress={handleSave}>
          <Text style={styles.buttonText}>Save Profile & Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { padding: 20 },
  title: { fontSize: 26, fontWeight: "bold", color: "#d32f2f", marginBottom: 5 },
  subtitle: { fontSize: 13, color: "#666", marginBottom: 20, lineHeight: 18 },
  cardTitle: { fontSize: 15, fontWeight: "bold", color: "#111", marginBottom: 6 },
  serverCard: {
    backgroundColor: "#f0f7ff",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bbdefb",
    marginBottom: 16,
  },
  urlValue: { fontSize: 12, color: "#0d47a1", fontWeight: "600", marginBottom: 8 },
  localWarningText: { fontSize: 12, color: "#c62828", marginBottom: 10, lineHeight: 16 },
  testConnBtn: {
    backgroundColor: "#1565c0",
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: "center",
  },
  testConnBtnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  connResultBox: { marginTop: 10, padding: 10, borderRadius: 8, borderWidth: 1 },
  connOk: { backgroundColor: "#e8f5e9", borderColor: "#a5d6a7" },
  connErr: { backgroundColor: "#ffebee", borderColor: "#ef9a9a" },
  connOkText: { color: "#2e7d32", fontSize: 12, fontWeight: "600" },
  connErrText: { color: "#c62828", fontSize: 12, fontWeight: "600" },
  uberCard: {
    backgroundColor: "#f5f5f5",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginBottom: 16,
  },
  uberDesc: { fontSize: 12, color: "#555", lineHeight: 16, marginBottom: 12 },
  uberConnectedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#e8f5e9",
    padding: 10,
    borderRadius: 8,
  },
  uberStatusActive: { color: "#2e7d32", fontWeight: "bold", fontSize: 13 },
  disconnectBtn: { paddingVertical: 4, paddingHorizontal: 10, backgroundColor: "#fff", borderRadius: 6 },
  disconnectBtnText: { color: "#c62828", fontSize: 12, fontWeight: "600" },
  connectUberBtn: {
    backgroundColor: "#000",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  connectUberBtnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  voiceCard: {
    backgroundColor: "#fafafa",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginBottom: 20,
  },
  voiceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  voiceDesc: { fontSize: 12, color: "#555", lineHeight: 16 },
  accessibilityCard: {
    backgroundColor: "#f9fbe7",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dce775",
    marginBottom: 20,
  },
  accessibilityHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  accessibilityDesc: { fontSize: 12, color: "#555", lineHeight: 16 },
  accessibilityActiveBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  accessibilityActiveTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#2e7d32",
    marginBottom: 4,
  },
  accessibilityActiveDetail: {
    fontSize: 12,
    color: "#333",
    marginBottom: 10,
  },
  accessibilityBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  openSettingsBtn: {
    flex: 1,
    backgroundColor: "#33691e",
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  openSettingsBtnText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  dumpBtn: {
    flex: 1,
    backgroundColor: "#424242",
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  dumpBtnText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  killSwitchBtn: {
    backgroundColor: "#b71c1c",
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: "center",
  },
  killSwitchText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
    width: "100%",
    maxHeight: "80%",
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#c62828", marginBottom: 12 },
  modalScroll: { maxHeight: 300, marginBottom: 16 },
  modalTextBold: { fontSize: 13, fontWeight: "600", color: "#222", marginBottom: 10 },
  modalBullet: { fontSize: 12, color: "#444", marginBottom: 8, lineHeight: 18 },
  boldText: { fontWeight: "bold", color: "#111" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  modalCancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: "#eee" },
  modalCancelText: { color: "#444", fontWeight: "600", fontSize: 14 },
  modalAgreeBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: "#2e7d32" },
  modalAgreeText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  dumpScroll: { maxHeight: 350, backgroundColor: "#212121", padding: 12, borderRadius: 8, marginBottom: 16 },
  dumpText: { color: "#a5d6a7", fontFamily: "monospace", fontSize: 11 },
  label: { fontSize: 14, fontWeight: "700", marginBottom: 6, color: "#333" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 15,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#d32f2f",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 30,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
