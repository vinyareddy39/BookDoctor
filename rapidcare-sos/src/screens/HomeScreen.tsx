import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Linking,
} from "react-native";
import { useStore } from "../store/useStore";
import SosFlowModal from "../components/SosFlowModal";
import { EMERGENCY_CONFIG } from "../config/emergencyConfig";

export default function HomeScreen({ navigation }: any) {
  const user = useStore((state) => state.user);
  const [showSosModal, setShowSosModal] = useState(false);

  useEffect(() => {
    // If no user profile exists, force them to onboard
    if (!user) {
      navigation.replace("Onboarding");
    }
  }, [user]);

  if (!user) return <View style={styles.container} />;

  const contacts = user.contacts || [];

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.welcome}>Hi, {user.name}</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("Contacts")}
          style={styles.manageButton}
          accessibilityLabel="Manage Emergency Contacts"
        >
          <Text style={styles.link}>Manage Contacts ({contacts.length}/3)</Text>
        </TouchableOpacity>
      </View>

      {/* Emergency Notice Banner */}
      <View style={styles.noticeBanner}>
        <Text style={styles.noticeText}>
          ⚠️ {EMERGENCY_CONFIG.WARNING_TEXT}
        </Text>
      </View>

      {/* Main Center Area with SOS Button */}
      <View style={styles.center}>
        {contacts.length === 0 && (
          <View style={styles.contactsWarning}>
            <Text style={styles.contactsWarningText}>
              ⚠️ No emergency contacts added. (SMS alerts skipped; ride flow will still proceed).
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.sosButton}
          onPress={() => setShowSosModal(true)}
          activeOpacity={0.8}
          accessibilityLabel="Emergency SOS Button"
          accessibilityRole="button"
        >
          <Text style={styles.sosText}>SOS</Text>
          <Text style={styles.sosSubtext}>EMERGENCY</Text>
        </TouchableOpacity>

        <Text style={styles.instruction}>
          Tap to find nearest emergency hospital & dispatch Uber
        </Text>
      </View>

      {/* Persistent Call 108 Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.bottomAmbulanceButton}
          onPress={() => Linking.openURL(`tel:${EMERGENCY_CONFIG.AMBULANCE_NUMBER}`)}
          accessibilityLabel="Call 108 Ambulance"
        >
          <Text style={styles.bottomAmbulanceText}>
            📞 CALL {EMERGENCY_CONFIG.AMBULANCE_NUMBER} AMBULANCE
          </Text>
        </TouchableOpacity>
      </View>

      {/* SOS Ride Flow Modal */}
      <SosFlowModal
        visible={showSosModal}
        contacts={contacts}
        onClose={() => setShowSosModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
    alignItems: "center",
  },
  welcome: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#212121",
  },
  manageButton: {
    minHeight: 44,
    justifyContent: "center",
  },
  link: {
    color: "#0288d1",
    fontWeight: "bold",
    fontSize: 14,
  },
  noticeBanner: {
    backgroundColor: "#fff3e0",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#ffe0b2",
  },
  noticeText: {
    color: "#e65100",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  contactsWarning: {
    backgroundColor: "#ffebee",
    borderColor: "#ef9a9a",
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 30,
    width: "100%",
  },
  contactsWarningText: {
    color: "#c62828",
    fontSize: 12,
    textAlign: "center",
  },
  sosButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#d32f2f",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#d32f2f",
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 12,
    minWidth: 56, // Accessible touch target ≥ 56dp
    minHeight: 56,
  },
  sosText: {
    color: "#ffffff",
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: 2,
  },
  sosSubtext: {
    color: "#ffcdd2",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
    letterSpacing: 1,
  },
  instruction: {
    marginTop: 24,
    color: "#666666",
    fontSize: 13,
    textAlign: "center",
    maxWidth: 260,
  },
  bottomBar: {
    padding: 16,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#eeeeee",
  },
  bottomAmbulanceButton: {
    backgroundColor: "#2e7d32",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56, // Accessible touch target
  },
  bottomAmbulanceText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 15,
  },
});
