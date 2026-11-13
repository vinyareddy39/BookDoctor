import React, { useState } from "react";
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
} from "react-native";
import { useStore } from "../store/useStore";
import { User } from "../types";
import { EMERGENCY_CONFIG, isLocalhostUrl } from "../config/emergencyConfig";
import {
  testServerConnection,
  ensureDeviceAuthToken,
  setCachedDeviceId,
  setCachedAuthToken,
  ServerConnectionTestResult,
} from "../services/apiClient";

export default function OnboardingScreen({ navigation }: any) {
  const user = useStore((state) => state.user);
  const deviceId = useStore((state) => state.deviceId);
  const serverAuthToken = useStore((state) => state.serverAuthToken);
  const outboundVoiceCallEnabled = useStore((state) => state.outboundVoiceCallEnabled);
  const setUser = useStore((state) => state.setUser);
  const setServerAuthToken = useStore((state) => state.setServerAuthToken);
  const setOutboundVoiceCallEnabled = useStore((state) => state.setOutboundVoiceCallEnabled);
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
