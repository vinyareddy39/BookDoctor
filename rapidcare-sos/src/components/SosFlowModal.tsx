import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
} from "react-native";
import { EMERGENCY_CONFIG } from "../config/emergencyConfig";
import CallAmbulanceHeader from "./CallAmbulanceHeader";
import { getCurrentOrLastKnownLocation, LocationResult } from "../services/locationService";
import {
  findNearestEmergencyHospital,
  HospitalCandidate,
} from "../services/hospitalService";
import {
  dispatchEmergencySms,
  createLocationAlertMessage,
  createHospitalUpdateMessage,
  createWatchdogFailedMessage,
  createLocationUnavailableMessage,
  EmergencyContactInfo,
} from "../services/smsService";
import { openUberRide } from "../services/uberService";

export type SosPhase =
  | "COUNTDOWN"
  | "LOCATING"
  | "HOSPITAL_SEARCH"
  | "UBER_LAUNCHING"
  | "WATCHDOG_WAIT"
  | "CONFIRMED"
  | "ALERT_108_112";

interface SosFlowModalProps {
  visible: boolean;
  contacts: EmergencyContactInfo[];
  onClose: () => void;
  // Test injection hooks
  cancelCountdownSeconds?: number;
  placesApiKey?: string;
  mockLocation?: LocationResult;
  mockHospital?: HospitalCandidate | null;
  onPhaseChange?: (phase: SosPhase) => void;
}

export default function SosFlowModal({
  visible,
  contacts,
  onClose,
  cancelCountdownSeconds = EMERGENCY_CONFIG.CANCEL_COUNTDOWN_SECONDS,
  placesApiKey,
  mockLocation,
  mockHospital,
  onPhaseChange,
}: SosFlowModalProps) {
  const [phase, setPhase] = useState<SosPhase>("COUNTDOWN");
  const [countdown, setCountdown] = useState(cancelCountdownSeconds);
  const [watchdogSecondsLeft, setWatchdogSecondsLeft] = useState(
    EMERGENCY_CONFIG.WATCHDOG_TIMEOUT_SECONDS
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [location, setLocation] = useState<LocationResult | null>(null);
  const [hospital, setHospital] = useState<HospitalCandidate | null>(null);

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Notify phase changes for testing/observability
  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase]);

  // Reset when opened
  useEffect(() => {
    if (visible) {
      setCountdown(cancelCountdownSeconds);
      setWatchdogSecondsLeft(EMERGENCY_CONFIG.WATCHDOG_TIMEOUT_SECONDS);
      setErrorMessage(null);
      setLocation(null);
      setHospital(null);

      if (cancelCountdownSeconds > 0) {
        setPhase("COUNTDOWN");
      } else {
        startEmergencyPipeline();
      }
    } else {
      clearTimers();
    }
    return () => clearTimers();
  }, [visible]);

  const clearTimers = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (watchdogTimerRef.current) clearInterval(watchdogTimerRef.current);
  };

  // 1. Cancel Countdown Timer
  useEffect(() => {
    if (phase !== "COUNTDOWN" || !visible) return;

    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current!);
          startEmergencyPipeline();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [phase, visible]);

  // Cancel Handler
  const handleCancelCountdown = () => {
    clearTimers();
    onClose();
  };

  // 2. Emergency Pipeline Orchestrator
  const startEmergencyPipeline = async () => {
    clearTimers();

    // ── STEP A: ACQUIRE GPS LOCATION ──
    setPhase("LOCATING");
    let currentCoords: LocationResult;
    try {
      if (mockLocation) {
        currentCoords = mockLocation;
      } else {
        currentCoords = await getCurrentOrLastKnownLocation(
          EMERGENCY_CONFIG.LOCATION_TIMEOUT_MS
        );
      }
      setLocation(currentCoords);
    } catch (locErr: any) {
      console.error("[SosFlow] Location acquisition failed:", locErr.message);
      // Dispatch location failure SMS
      await dispatchEmergencySms(contacts, createLocationUnavailableMessage());
      setErrorMessage("Unable to determine your GPS location. Please call 108 directly.");
      setPhase("ALERT_108_112");
      return;
    }

    // ── STEP B: SEND LOCATION SMS BEFORE HOSPITAL LOOKUP ──
    const locationSms = createLocationAlertMessage(
      currentCoords.latitude,
      currentCoords.longitude
    );
    await dispatchEmergencySms(contacts, locationSms);

    // ── STEP C: HOSPITAL LOOKUP (Places -> Overpass) ──
    setPhase("HOSPITAL_SEARCH");
    let targetHospital: HospitalCandidate | null = null;
    try {
      if (mockHospital !== undefined) {
        targetHospital = mockHospital;
      } else {
        targetHospital = await findNearestEmergencyHospital(
          currentCoords.latitude,
          currentCoords.longitude,
          placesApiKey
        );
      }
    } catch (hospErr: any) {
      console.warn("[SosFlow] Hospital discovery error:", hospErr.message);
      targetHospital = null;
    }

    if (!targetHospital) {
      console.warn("[SosFlow] No emergency hospital found. Skipping Uber dispatch without hard-coded coordinates.");
      setErrorMessage("No verified emergency hospital could be found nearby. Call 108 immediately.");
      setPhase("ALERT_108_112");
      return;
    }

    setHospital(targetHospital);

    // ── STEP D: SECOND SMS WITH HOSPITAL NAME ──
    const hospitalSms = createHospitalUpdateMessage(targetHospital.name);
    await dispatchEmergencySms(contacts, hospitalSms);

    // ── STEP E: LAUNCH UBER APP VIA DEEP LINK ──
    setPhase("UBER_LAUNCHING");
    try {
      await openUberRide(
        { latitude: currentCoords.latitude, longitude: currentCoords.longitude },
        {
          name: targetHospital.name,
          latitude: targetHospital.latitude,
          longitude: targetHospital.longitude,
          address: targetHospital.address,
        }
      );
    } catch (uberErr) {
      console.error("[SosFlow] Failed to trigger Uber opening:", uberErr);
    }

    // ── STEP F: START 45-SECOND CONFIRMATION WATCHDOG ──
    setPhase("WATCHDOG_WAIT");
    startWatchdogTimer(targetHospital);
  };

  const startWatchdogTimer = (hospitalObj: HospitalCandidate) => {
    let secondsLeft = EMERGENCY_CONFIG.WATCHDOG_TIMEOUT_SECONDS;
    setWatchdogSecondsLeft(secondsLeft);

    watchdogTimerRef.current = setInterval(async () => {
      secondsLeft -= 1;
      setWatchdogSecondsLeft(secondsLeft);

      if (secondsLeft <= 0) {
        clearInterval(watchdogTimerRef.current!);
        console.warn("[SosFlow] 45-second watchdog expired without booking confirmation!");

        // Send 3rd failed confirmation SMS
        await dispatchEmergencySms(contacts, createWatchdogFailedMessage());

        setErrorMessage(
          `Uber ride could not be automatically confirmed within ${EMERGENCY_CONFIG.WATCHDOG_TIMEOUT_SECONDS}s. Uber may still assign a driver: check the Uber app and cancel any pending trip.`
        );
        setPhase("ALERT_108_112");
      }
    }, 1000);
  };

  const handleManualConfirmed = () => {
    clearTimers();
    setPhase("CONFIRMED");
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.modalRoot}>
        {/* Persistent Call 108 / 112 header visible on ALL screens */}
        <CallAmbulanceHeader />

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Contacts Warning if none registered */}
          {(!contacts || contacts.length === 0) && phase !== "ALERT_108_112" && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningBannerText}>
                ⚠️ No emergency contacts configured. SMS alerts skipped; ride flow continues.
              </Text>
            </View>
          )}

          {/* ── PHASE 1: COUNTDOWN ── */}
          {phase === "COUNTDOWN" && (
            <View style={styles.centerBox}>
              <View style={styles.countdownBadge}>
                <Text style={styles.countdownNumber}>{countdown}</Text>
              </View>
              <Text style={styles.headline}>EMERGENCY SOS TRIGGERED</Text>
              <Text style={styles.subtext}>
                Acquiring location and requesting emergency ride to nearest hospital in {countdown} seconds...
              </Text>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelCountdown}
                accessibilityLabel="Cancel SOS false alarm"
              >
                <Text style={styles.cancelButtonText}>CANCEL SOS (FALSE ALARM)</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── PHASE 2: LOCATING ── */}
          {phase === "LOCATING" && (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#d32f2f" />
              <Text style={styles.headline}>Acquiring Live GPS Location</Text>
              <Text style={styles.subtext}>
                Locking high-accuracy coordinates (12s timeout)...
              </Text>
            </View>
          )}

          {/* ── PHASE 3: HOSPITAL SEARCH ── */}
          {phase === "HOSPITAL_SEARCH" && (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#d32f2f" />
              <Text style={styles.headline}>Finding Nearest Emergency Hospital</Text>
              <Text style={styles.subtext}>
                Checking Google Places & OpenStreetMap Overpass (ranked by straight-line distance)...
              </Text>
            </View>
          )}

          {/* ── PHASE 4: UBER LAUNCHING / WATCHDOG ── */}
          {(phase === "UBER_LAUNCHING" || phase === "WATCHDOG_WAIT") && (
            <View style={styles.centerBox}>
              <View style={styles.hospitalCard}>
                <Text style={styles.hospitalLabel}>DESTINATION HOSPITAL (NEAREST ER):</Text>
                <Text style={styles.hospitalName}>{hospital?.name}</Text>
                {hospital?.address ? (
                  <Text style={styles.hospitalAddress}>{hospital.address}</Text>
                ) : null}
                <Text style={styles.hospitalDistance}>
                  Approx. {Math.round(hospital?.distanceMeters || 0)}m straight-line distance
                </Text>
              </View>

              {Platform.OS === "ios" ? (
                <View style={styles.platformGuideBox}>
                  <Text style={styles.platformGuideHeadline}>📱 Uber App Opened</Text>
                  <Text style={styles.platformGuideBody}>
                    Pickup and hospital drop-off have been pre-filled.
                  </Text>
                  <Text style={styles.platformGuidePrompt}>
                    👉 Tap Confirm in Uber to book.
                  </Text>
                </View>
              ) : (
                <View style={styles.platformGuideBox}>
                  <Text style={styles.platformGuideHeadline}>🤖 Android Ride Automation Active</Text>
                  <Text style={styles.platformGuideBody}>
                    Selecting ride tier and tapping confirmation. If a payment or consent screen appears, please tap manually.
                  </Text>
                </View>
              )}

              <View style={styles.watchdogBox}>
                <Text style={styles.watchdogText}>
                  Watchdog timer: {watchdogSecondsLeft}s remaining
                </Text>
              </View>

              <TouchableOpacity
                style={styles.confirmedButton}
                onPress={handleManualConfirmed}
              >
                <Text style={styles.confirmedButtonText}>RIDE CONFIRMED IN UBER</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── PHASE 5: CONFIRMED ── */}
          {phase === "CONFIRMED" && (
            <View style={styles.centerBox}>
              <Text style={styles.successIcon}>✅</Text>
              <Text style={styles.headline}>Emergency Ride Confirmed</Text>
              <Text style={styles.subtext}>
                Your Uber is en route to {hospital?.name}. Emergency contacts were notified via SMS.
              </Text>
              <TouchableOpacity style={styles.doneButton} onPress={onClose}>
                <Text style={styles.doneButtonText}>RETURN TO HOME</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── PHASE 6: ALERT 108 / 112 ── */}
          {phase === "ALERT_108_112" && (
            <View style={styles.centerBox}>
              <Text style={styles.alertIcon}>🚨</Text>
              <Text style={styles.alertHeadline}>EMERGENCY ALERT</Text>
              {errorMessage && <Text style={styles.alertSubtext}>{errorMessage}</Text>}

              <View style={styles.alertCallButtons}>
                <TouchableOpacity
                  style={styles.bigAmbulanceButton}
                  onPress={() => Linking.openURL(`tel:${EMERGENCY_CONFIG.AMBULANCE_NUMBER}`)}
                >
                  <Text style={styles.bigAmbulanceText}>
                    📞 CALL {EMERGENCY_CONFIG.AMBULANCE_NUMBER} (AMBULANCE)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.big112Button}
                  onPress={() => Linking.openURL(`tel:${EMERGENCY_CONFIG.NATIONAL_EMERGENCY_NUMBER}`)}
                >
                  <Text style={styles.big112Text}>
                    CALL {EMERGENCY_CONFIG.NATIONAL_EMERGENCY_NUMBER} (NATIONAL EMERGENCY)
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.dismissAlertButton} onPress={onClose}>
                <Text style={styles.dismissAlertText}>DISMISS</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: "#121212",
  },
  scrollContent: {
    padding: 20,
    flexGrow: 1,
    justifyContent: "center",
  },
  centerBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  warningBanner: {
    backgroundColor: "rgba(255, 179, 0, 0.2)",
    borderColor: "#ffb300",
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  warningBannerText: {
    color: "#ffca28",
    fontSize: 12,
    textAlign: "center",
    fontWeight: "bold",
  },
  countdownBadge: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#d32f2f",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    shadowColor: "#d32f2f",
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 10,
  },
  countdownNumber: {
    fontSize: 54,
    fontWeight: "900",
    color: "#ffffff",
  },
  headline: {
    fontSize: 20,
    fontWeight: "900",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 10,
  },
  subtext: {
    fontSize: 14,
    color: "#b0b0b0",
    textAlign: "center",
    marginBottom: 24,
    maxWidth: 300,
  },
  cancelButton: {
    backgroundColor: "#2c2c2c",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    minHeight: 56, // Accessible tap target
    minWidth: 240,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#555",
  },
  cancelButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 14,
  },
  hospitalCard: {
    backgroundColor: "#1e1e1e",
    padding: 16,
    borderRadius: 12,
    width: "100%",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#333",
  },
  hospitalLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#ff6659",
    marginBottom: 4,
  },
  hospitalName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  hospitalAddress: {
    fontSize: 12,
    color: "#b0b0b0",
    marginBottom: 6,
  },
  hospitalDistance: {
    fontSize: 12,
    color: "#00e676",
    fontWeight: "600",
  },
  platformGuideBox: {
    backgroundColor: "#1b2838",
    borderColor: "#2196f3",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    width: "100%",
    marginBottom: 16,
  },
  platformGuideHeadline: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#64b5f6",
    marginBottom: 6,
  },
  platformGuideBody: {
    fontSize: 13,
    color: "#e0e0e0",
    marginBottom: 8,
  },
  platformGuidePrompt: {
    fontSize: 15,
    fontWeight: "900",
    color: "#ffeb3b",
  },
  watchdogBox: {
    marginBottom: 20,
  },
  watchdogText: {
    color: "#ffb300",
    fontSize: 12,
    fontWeight: "bold",
  },
  confirmedButton: {
    backgroundColor: "#2e7d32",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    minHeight: 56,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmedButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 14,
  },
  successIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  doneButton: {
    backgroundColor: "#333",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  doneButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  alertIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  alertHeadline: {
    fontSize: 24,
    fontWeight: "900",
    color: "#d32f2f",
    marginBottom: 10,
  },
  alertSubtext: {
    fontSize: 14,
    color: "#e0e0e0",
    textAlign: "center",
    marginBottom: 24,
  },
  alertCallButtons: {
    width: "100%",
    gap: 12,
    marginBottom: 20,
  },
  bigAmbulanceButton: {
    backgroundColor: "#2e7d32",
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
    minHeight: 60,
    justifyContent: "center",
  },
  bigAmbulanceText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 16,
  },
  big112Button: {
    backgroundColor: "#d32f2f",
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
    minHeight: 60,
    justifyContent: "center",
  },
  big112Text: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 14,
  },
  dismissAlertButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  dismissAlertText: {
    color: "#888",
    fontSize: 13,
  },
});

