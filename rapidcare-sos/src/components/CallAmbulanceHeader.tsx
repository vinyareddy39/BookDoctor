import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Linking } from "react-native";
import { EMERGENCY_CONFIG } from "../config/emergencyConfig";

export default function CallAmbulanceHeader() {
  const handleCall108 = () => {
    Linking.openURL(`tel:${EMERGENCY_CONFIG.AMBULANCE_NUMBER}`);
  };

  const handleCall112 = () => {
    Linking.openURL(`tel:${EMERGENCY_CONFIG.NATIONAL_EMERGENCY_NUMBER}`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.warningBox}>
        <Text style={styles.warningText}>
          ⚠️ {EMERGENCY_CONFIG.WARNING_TEXT}
        </Text>
      </View>
      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={styles.ambulanceButton}
          onPress={handleCall108}
          accessibilityLabel="Call 108 Ambulance helpline"
        >
          <Text style={styles.ambulanceButtonText}>
            📞 CALL {EMERGENCY_CONFIG.AMBULANCE_NUMBER} (AMBULANCE)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.emergency112Button}
          onPress={handleCall112}
          accessibilityLabel="Call 112 National Emergency"
        >
          <Text style={styles.emergency112Text}>
            CALL {EMERGENCY_CONFIG.NATIONAL_EMERGENCY_NUMBER}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#1e1e1e",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  warningBox: {
    marginBottom: 8,
  },
  warningText: {
    color: "#ffca28",
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
  },
  buttonsRow: {
    flexDirection: "row",
    gap: 8,
  },
  ambulanceButton: {
    flex: 2,
    backgroundColor: "#2e7d32",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  ambulanceButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 13,
  },
  emergency112Button: {
    flex: 1,
    backgroundColor: "#d32f2f",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  emergency112Text: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 12,
  },
});

