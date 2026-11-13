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
  Alert,
} from "react-native";
import { EMERGENCY_CONFIG } from "../config/emergencyConfig";
import CallAmbulanceHeader from "./CallAmbulanceHeader";
import { getCurrentOrLastKnownLocation, LocationResult } from "../services/locationService";
import { findNearestEmergencyHospital, HospitalCandidate } from "../services/hospitalService";
import {
  dispatchEmergencySms,
  createLocationAlertMessage,
  createHospitalUpdateMessage,
  createWatchdogFailedMessage,
  createLocationUnavailableMessage,
  EmergencyContactInfo,
} from "../services/smsService";
import {
  buildUberLinks,
  openUberRide,
  fetchUberEstimate,
  requestUberAutoBooking,
  pollUberRideStatus,
  cancelUberRide,
  UberEstimateResponse,
  UberRideBookingResponse,
  UberRideStatusResponse,
} from "../services/uberService";
import { useStore } from "../store/useStore";
import { setCachedAuthToken, setCachedDeviceId } from "../services/apiClient";

export type SosPhase =
  | "LOCATING_AND_ESTIMATING"
  | "COUNTDOWN"
  | "AUTO_BOOKING"
  | "RIDE_ACTIVE"
  | "DEEP_LINK_FALLBACK"
  | "ALERT_108_112";

interface SosFlowModalProps {
  visible: boolean;
  contacts: EmergencyContactInfo[];
  onClose: () => void;
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
  const uberConnection = useStore((state) => state.uberConnection);
  const deviceId = useStore((state) => state.deviceId);
  const serverAuthToken = useStore((state) => state.serverAuthToken);

  const [phase, setPhase] = useState<SosPhase>("LOCATING_AND_ESTIMATING");
  const [countdown, setCountdown] = useState(cancelCountdownSeconds);
  const [watchdogSecondsLeft, setWatchdogSecondsLeft] = useState(
    EMERGENCY_CONFIG.WATCHDOG_TIMEOUT_SECONDS
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [smsNotice, setSmsNotice] = useState<string | null>(null);

  const [location, setLocation] = useState<LocationResult | null>(null);
  const [hospital, setHospital] = useState<HospitalCandidate | null>(null);
  const [estimate, setEstimate] = useState<UberEstimateResponse | null>(null);

  // Active Uber ride tracking
  const [activeRide, setActiveRide] = useState<UberRideBookingResponse | null>(null);
  const [rideLiveStatus, setRideLiveStatus] = useState<UberRideStatusResponse | null>(null);

  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchdogTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase]);

  // Reset when opened
  useEffect(() => {
    if (visible) {
      setCachedDeviceId(deviceId);
      if (serverAuthToken) {
        setCachedAuthToken(serverAuthToken);
      }
      setCountdown(cancelCountdownSeconds);
      setWatchdogSecondsLeft(EMERGENCY_CONFIG.WATCHDOG_TIMEOUT_SECONDS);
      setErrorMessage(null);
      setFallbackNotice(null);
      setSmsNotice(null);
      setLocation(null);
      setHospital(null);
      setEstimate(null);
      setActiveRide(null);
      setRideLiveStatus(null);

      // Start initial discovery & fare estimation
      initiateDiscoveryAndEstimate();
    } else {
      clearAllTimers();
    }
    return () => clearAllTimers();
  }, [visible]);

  const clearAllTimers = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (watchdogTimerRef.current) clearInterval(watchdogTimerRef.current);
    if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
  };

  /**
   * STEP 1: Fast Location & Hospital & Estimate Resolution
   * Required by Uber: Fare must be visible to the user during the countdown when Uber is connected!
   */
  const initiateDiscoveryAndEstimate = async () => {
    clearAllTimers();
    setPhase("LOCATING_AND_ESTIMATING");

    // 1. Get Location & Street Address
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
      console.error("[SosFlow] Location failed:", locErr.message);
      await dispatchEmergencySms(contacts, createLocationUnavailableMessage(), "location_unavailable");
      setErrorMessage("Unable to determine your GPS location (permission denied or unavailable). Please call 108/112 directly.");
      setPhase("ALERT_108_112");
      return;
    }

    // 2. Send SMS #1 (Location pin) BEFORE hospital lookup starts
    const locationSms = createLocationAlertMessage(currentCoords.latitude, currentCoords.longitude);
    const sms1Res = await dispatchEmergencySms(contacts, locationSms, "location");
    if (sms1Res.warning) {
      setSmsNotice(sms1Res.warning);
    }

    // 3. Find Hospital (Places -> Overpass)
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
    }

    if (!targetHospital) {
      setErrorMessage("No verified emergency hospital could be found nearby (Places/Overpass failed or offline). Call 108/112 immediately.");
      setPhase("ALERT_108_112");
      return;
    }

    setHospital(targetHospital);

    // Send SMS #2 (Hospital update)
    const sms2Res = await dispatchEmergencySms(contacts, createHospitalUpdateMessage(targetHospital.name), "hospital");
    if (sms2Res.warning && !sms1Res.warning) {
      setSmsNotice(sms2Res.warning);
    }

    // 4. Fetch Uber Fare Estimate ONLY when Uber is connected
    let est: UberEstimateResponse | null = null;
    if (uberConnection.connected) {
      est = await fetchUberEstimate(
        { latitude: currentCoords.latitude, longitude: currentCoords.longitude, address: currentCoords.address },
        { name: targetHospital.name, latitude: targetHospital.latitude, longitude: targetHospital.longitude }
      );
      setEstimate(est);
    } else {
      setEstimate(null);
    }

    // 5. Begin 5s Cancel Countdown with Pickup Address, Hospital & Fare status visible
    setPhase("COUNTDOWN");
    if (cancelCountdownSeconds > 0) {
      startCountdownTimer(currentCoords, targetHospital, est);
    } else {
      executeAutoBooking(currentCoords, targetHospital, est);
    }
  };

  /**
   * 5s Cancel Countdown
   */
  const startCountdownTimer = (
    coords: LocationResult,
    targetHosp: HospitalCandidate,
    estObj: UberEstimateResponse | null
  ) => {
    let timeLeft = cancelCountdownSeconds;
    setCountdown(timeLeft);

    countdownTimerRef.current = setInterval(() => {
      timeLeft -= 1;
      setCountdown(timeLeft);

      if (timeLeft <= 0) {
        clearInterval(countdownTimerRef.current!);
        executeAutoBooking(coords, targetHosp, estObj);
      }
    }, 1000);
  };

  const handleCancelCountdown = () => {
    clearAllTimers();
    onClose();
  };

  /**
   * STEP 2: Automatic Uber Booking Dispatch (or prefilled deep link fallback if Uber not connected)
   */
  const executeAutoBooking = async (
    coords: LocationResult,
    targetHosp: HospitalCandidate,
    estObj: UberEstimateResponse | null
  ) => {
    clearAllTimers();

    // If Uber is NOT connected, skip auto-booking API and fall back directly to deep link + 108/112
    if (!uberConnection.connected) {
      setFallbackNotice("Uber is not connected. Opening pre-filled Uber deep link — or call 108/112 immediately.");
      startWatchdogTimer(targetHosp);
      await triggerDeepLinkFallback(coords, targetHosp);
      return;
    }

    setPhase("AUTO_BOOKING");
    startWatchdogTimer(targetHosp);

    try {
      const bookRes = await requestUberAutoBooking(
        { latitude: coords.latitude, longitude: coords.longitude, address: coords.address },
        { name: targetHosp.name, latitude: targetHosp.latitude, longitude: targetHosp.longitude },
        estObj?.fare_id || "",
        estObj?.product_id || "uber-go"
      );

      if (bookRes.success && bookRes.ride_id) {
        setActiveRide(bookRes);
        setPhase("RIDE_ACTIVE");
        startStatusPolling(bookRes.ride_id);
        return;
      }

      // If API booking reports not authorized ("account not registered as developer") or fails, fall back cleanly
      setFallbackNotice(
        bookRes.error ||
          "Uber auto-booking unavailable or not authorised for this account. Opened Uber app deep link instead."
      );
      await triggerDeepLinkFallback(coords, targetHosp);
    } catch (bookingErr: any) {
      console.warn("[SosFlow] Booking dispatch error, falling back to deep link:", bookingErr.message);
      setFallbackNotice("Uber auto-booking failed due to a network/server error. Opened Uber app deep link instead.");
      await triggerDeepLinkFallback(coords, targetHosp);
    }
  };

  const triggerDeepLinkFallback = async (coords: LocationResult, targetHosp: HospitalCandidate) => {
    setPhase("DEEP_LINK_FALLBACK");
    try {
      await openUberRide(
        { latitude: coords.latitude, longitude: coords.longitude },
        { name: targetHosp.name, latitude: targetHosp.latitude, longitude: targetHosp.longitude, address: targetHosp.address }
      );
    } catch (linkErr: any) {
      console.warn("[SosFlow] Deep link open failed, directing to 108/112 screen:", linkErr?.message);
      setErrorMessage("Could not launch Uber app or browser. Call 108 or 112 immediately.");
      setPhase("ALERT_108_112");
    }
  };

  /**
   * 45-Second Watchdog Timer
   */
  const startWatchdogTimer = (hosp: HospitalCandidate) => {
    let secondsLeft = EMERGENCY_CONFIG.WATCHDOG_TIMEOUT_SECONDS;
    setWatchdogSecondsLeft(secondsLeft);

    watchdogTimerRef.current = setInterval(async () => {
      secondsLeft -= 1;
      setWatchdogSecondsLeft(secondsLeft);

      if (secondsLeft <= 0) {
        clearInterval(watchdogTimerRef.current!);
        console.warn("[SosFlow] 45s watchdog expired without ride acceptance!");

        // Dispatch SMS #3
        await dispatchEmergencySms(contacts, createWatchdogFailedMessage(), "watchdog_failed");

        setErrorMessage(
          `Uber ride was not confirmed within ${EMERGENCY_CONFIG.WATCHDOG_TIMEOUT_SECONDS}s. Uber may still match a driver in the background: check the Uber app and cancel any pending trip.`
        );
        setPhase("ALERT_108_112");
      }
    }, 1000);
  };

  /**
   * Live Ride Polling (every 5 seconds)
   */
  const startStatusPolling = (rideId: string) => {
    if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);

    pollingTimerRef.current = setInterval(async () => {
      const statusRes = await pollUberRideStatus(rideId);
      if (statusRes) {
        setRideLiveStatus(statusRes);

        // If driver accepted/arriving, clear watchdog
        if (["accepted", "arriving", "in_progress"].includes(statusRes.status)) {
          if (watchdogTimerRef.current) {
            clearInterval(watchdogTimerRef.current);
          }
        }
      }
    }, 5000);
  };

  const handleUserCancelRide = async () => {
    Alert.alert(
      "Cancel Emergency Ride?",
      "Are you sure you want to cancel the Uber emergency ride?",
      [
        { text: "No, Keep Ride", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            if (activeRide?.ride_id) {
              await cancelUberRide(activeRide.ride_id);
            }
            clearAllTimers();
            onClose();
          },
        },
      ]
    );
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

          {/* Twilio Trial / SMS Fallback Notice (Never shows phone numbers or SMS bodies) */}
          {smsNotice && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningBannerText}>ℹ️ {smsNotice}</Text>
            </View>
          )}

          {/* ── PHASE 1: LOCATING & ESTIMATING ── */}
          {phase === "LOCATING_AND_ESTIMATING" && (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#d32f2f" />
              <Text style={styles.headline}>Initiating Emergency Dispatch</Text>
              <Text style={styles.subtext}>
                Acquiring GPS location, reverse-geocoding pickup address, and checking hospital distance...
              </Text>
            </View>
          )}

          {/* ── PHASE 2: COUNTDOWN WITH FARE ESTIMATE VISIBLE ── */}
          {phase === "COUNTDOWN" && (
            <View style={styles.centerBox}>
              <View style={styles.countdownBadge}>
                <Text style={styles.countdownNumber}>{countdown}</Text>
              </View>
              <Text style={styles.headline}>EMERGENCY SOS TRIGGERED</Text>

              {/* Ride Summary Card Required by Uber before request */}
              <View style={styles.fareCard}>
                <Text style={styles.fareTitle}>
                  {uberConnection.connected
                    ? "UBER EMERGENCY AUTO-BOOKING"
                    : "UBER RIDE DISPATCH (DEEP LINK FALLBACK)"}
                </Text>
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>📍 Pickup Address:</Text>
                  <Text style={styles.fareValue} numberOfLines={2}>
                    {location?.address || `${location?.latitude.toFixed(4)}, ${location?.longitude.toFixed(4)}`}
                  </Text>
                </View>
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>🏥 Destination:</Text>
                  <Text style={styles.fareValue}>{hospital?.name}</Text>
                </View>
                <View style={styles.fareRowHighlight}>
                  <Text style={styles.fareHighlightLabel}>Estimated Fare:</Text>
                  <Text
                    style={
                      uberConnection.connected && estimate?.fare && !estimate?.isFallbackEstimate
                        ? styles.fareHighlightValue
                        : styles.fareUnavailableValue
                    }
                  >
                    {uberConnection.connected
                      ? estimate?.fare || "Fare unavailable"
                      : "Fare unavailable, connect Uber"}
                  </Text>
                </View>
                <Text style={styles.fareDisclaimer}>
                  {uberConnection.connected
                    ? "Uber will be booked automatically when the countdown ends."
                    : "Uber is not connected: pre-filled Uber deep link + 108/112 options will open when countdown ends."}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelCountdown}
                accessibilityLabel="Cancel SOS false alarm"
              >
                <Text style={styles.cancelButtonText}>CANCEL SOS (FALSE ALARM)</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── PHASE 3: AUTO BOOKING IN PROGRESS ── */}
          {phase === "AUTO_BOOKING" && (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#d32f2f" />
              <Text style={styles.headline}>Requesting Uber Ride...</Text>
              <Text style={styles.subtext}>
                Dispatching ride from {location?.address || "your location"} to {hospital?.name}...
              </Text>
              <View style={styles.watchdogBox}>
                <Text style={styles.watchdogText}>
                  Watchdog timer: {watchdogSecondsLeft}s remaining
                </Text>
              </View>
            </View>
          )}

          {/* ── PHASE 4: LIVE RIDE TRACKING SCREEN ── */}
          {phase === "RIDE_ACTIVE" && (() => {
            const effectiveSource = rideLiveStatus?.source || activeRide?.source;
            const isSim =
              effectiveSource === "local-simulation" ||
              Boolean(rideLiveStatus?.isSimulated ?? activeRide?.isSimulated);
            return (
              <View style={styles.centerBox}>
                <View style={styles.activeRideCard}>
                  {isSim ? (
                    <View style={styles.simulatedBadge} accessibilityLabel="Simulated ride warning badge">
                      <Text style={styles.simulatedBadgeText}>
                        ⚠️ SIMULATED (LOCAL MOCK — NOT A REAL UBER RIDE)
                      </Text>
                    </View>
                  ) : effectiveSource === "uber-sandbox" ? (
                    <View style={styles.sandboxBadge}>
                      <Text style={styles.sandboxBadgeText}>🧪 UBER SANDBOX (TEST MODE)</Text>
                    </View>
                  ) : null}

                  <Text style={styles.activeRideBadge}>
                    🚗 RIDE STATUS: {(rideLiveStatus?.status || activeRide?.status || "ACCEPTED").toUpperCase()}
                  </Text>

                  <View style={styles.trackingSection}>
                    <Text style={styles.trackingHeader}>DRIVER & VEHICLE</Text>
                    <Text style={styles.driverName}>
                      {rideLiveStatus?.driver?.name || activeRide?.driver?.name || "Driver Assigned"}
                    </Text>
                    <Text style={styles.vehicleDetails}>
                      {(rideLiveStatus?.vehicle?.make || activeRide?.vehicle?.make || "")}{" "}
                      {(rideLiveStatus?.vehicle?.model || activeRide?.vehicle?.model || "")} •{" "}
                      {rideLiveStatus?.vehicle?.license_plate || activeRide?.vehicle?.license_plate || "Pending"}
                    </Text>
                    <Text style={styles.etaText}>
                      ⏱️ Estimated Arrival: {rideLiveStatus?.eta || activeRide?.eta || 4} mins
                    </Text>
                  </View>

                  <View style={styles.routeSection}>
                    <Text style={styles.routePoint}>📍 Pickup: {location?.address}</Text>
                    <Text style={styles.routePoint}>🏥 Dropoff: {hospital?.name}</Text>
                    {hospital?.address && <Text style={styles.routeSub}>{hospital.address}</Text>}
                  </View>

                  <TouchableOpacity
                    style={styles.cancelRideBtn}
                    onPress={handleUserCancelRide}
                  >
                    <Text style={styles.cancelRideBtnText}>Cancel Ride</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })()}

          {/* ── PHASE 5: DEEP LINK FALLBACK ── */}
          {phase === "DEEP_LINK_FALLBACK" && (
            <View style={styles.centerBox}>
              {fallbackNotice && (
                <View style={styles.warningBanner}>
                  <Text style={styles.warningBannerText}>⚠️ {fallbackNotice}</Text>
                </View>
              )}

              <View style={styles.hospitalCard}>
                <Text style={styles.hospitalLabel}>DESTINATION HOSPITAL (NEAREST ER):</Text>
                <Text style={styles.hospitalName}>{hospital?.name}</Text>
                {hospital?.address ? (
                  <Text style={styles.hospitalAddress}>{hospital.address}</Text>
                ) : null}
              </View>

              <View style={styles.platformGuideBox}>
                <Text style={styles.platformGuideHeadline}>📱 Uber Deep Link Fallback</Text>
                <Text style={styles.platformGuideBody}>
                  Pickup ({location?.address || "Current Location"}) and hospital drop-off have been pre-filled.
                </Text>
                <Text style={styles.platformGuidePrompt}>
                  👉 Uber opened. Tap Confirm in Uber to book.
                </Text>
              </View>

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

              <View style={styles.watchdogBox}>
                <Text style={styles.watchdogText}>
                  Watchdog timer: {watchdogSecondsLeft}s remaining
                </Text>
              </View>

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

              {Platform.OS === "ios" && (
                <Text style={styles.iosCallNote}>
                  ℹ️ On iOS, phone calls always require your confirmation tap when prompted.
                </Text>
              )}

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
  modalRoot: { flex: 1, backgroundColor: "#121212" },
  scrollContent: { padding: 20, flexGrow: 1, justifyContent: "center" },
  centerBox: { alignItems: "center", justifyContent: "center", paddingVertical: 15 },
  warningBanner: {
    backgroundColor: "rgba(255, 179, 0, 0.2)",
    borderColor: "#ffb300",
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  warningBannerText: { color: "#ffca28", fontSize: 12, textAlign: "center", fontWeight: "bold" },
  countdownBadge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#d32f2f",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    elevation: 8,
  },
  countdownNumber: { fontSize: 48, fontWeight: "900", color: "#ffffff" },
  headline: { fontSize: 20, fontWeight: "900", color: "#ffffff", marginBottom: 8, textAlign: "center" },
  subtext: { fontSize: 13, color: "#e0e0e0", textAlign: "center", marginBottom: 16, paddingHorizontal: 15, lineHeight: 18 },
  fareCard: {
    width: "100%",
    backgroundColor: "#1e1e1e",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#333",
    marginBottom: 20,
  },
  fareTitle: { color: "#90caf9", fontWeight: "bold", fontSize: 13, marginBottom: 12, letterSpacing: 1 },
  fareRow: { marginBottom: 8 },
  fareLabel: { color: "#888", fontSize: 12, fontWeight: "600" },
  fareValue: { color: "#fff", fontSize: 13, fontWeight: "500", marginTop: 2 },
  fareRowHighlight: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#2a2a2a",
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
    marginBottom: 8,
  },
  fareHighlightLabel: { color: "#ffb74d", fontWeight: "bold", fontSize: 13 },
  fareHighlightValue: { color: "#4caf50", fontWeight: "900", fontSize: 16 },
  fareUnavailableValue: { color: "#ffb74d", fontWeight: "700", fontSize: 13, flexShrink: 1, textAlign: "right" },
  fareDisclaimer: { color: "#777", fontSize: 11, fontStyle: "italic", textAlign: "center" },
  cancelButton: {
    backgroundColor: "#ffffff",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    minHeight: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButtonText: { color: "#d32f2f", fontWeight: "bold", fontSize: 14 },
  watchdogBox: { marginVertical: 12 },
  watchdogText: { color: "#ffa726", fontSize: 13, fontWeight: "600" },
  activeRideCard: {
    width: "100%",
    backgroundColor: "#1e1e1e",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#4caf50",
  },
  activeRideBadge: { color: "#4caf50", fontWeight: "900", fontSize: 14, marginBottom: 12, textAlign: "center" },
  simulatedBadge: {
    backgroundColor: "#e65100",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 10,
    alignItems: "center",
  },
  simulatedBadgeText: { color: "#fff", fontWeight: "900", fontSize: 12, textAlign: "center", letterSpacing: 0.5 },
  sandboxBadge: {
    backgroundColor: "#1565c0",
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
    alignItems: "center",
  },
  sandboxBadgeText: { color: "#fff", fontWeight: "800", fontSize: 11, textAlign: "center" },
  trackingSection: { backgroundColor: "#262626", padding: 12, borderRadius: 8, marginBottom: 12 },
  trackingHeader: { color: "#888", fontSize: 11, fontWeight: "bold", marginBottom: 6 },
  driverName: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  vehicleDetails: { color: "#ccc", fontSize: 13, marginTop: 2 },
  etaText: { color: "#81c784", fontSize: 14, fontWeight: "bold", marginTop: 6 },
  routeSection: { marginBottom: 16 },
  routePoint: { color: "#eee", fontSize: 13, marginBottom: 4 },
  routeSub: { color: "#777", fontSize: 11, marginLeft: 20 },
  cancelRideBtn: {
    backgroundColor: "#b71c1c",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelRideBtnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  hospitalCard: {
    width: "100%",
    backgroundColor: "#1e1e1e",
    padding: 16,
    borderRadius: 10,
    marginBottom: 16,
  },
  hospitalLabel: { color: "#90caf9", fontSize: 11, fontWeight: "bold" },
  hospitalName: { color: "#fff", fontSize: 18, fontWeight: "bold", marginTop: 4 },
  hospitalAddress: { color: "#aaa", fontSize: 12, marginTop: 4 },
  platformGuideBox: {
    width: "100%",
    backgroundColor: "#1c2833",
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2e4053",
  },
  platformGuideHeadline: { color: "#5dade2", fontSize: 15, fontWeight: "bold" },
  platformGuideBody: { color: "#ebedef", fontSize: 12, marginTop: 4, lineHeight: 16 },
  platformGuidePrompt: { color: "#f39c12", fontSize: 13, fontWeight: "bold", marginTop: 6 },
  doneButton: {
    backgroundColor: "#333",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 10,
  },
  doneButtonText: { color: "#fff", fontWeight: "bold" },
  alertIcon: { fontSize: 50, marginBottom: 12 },
  alertHeadline: { fontSize: 22, fontWeight: "900", color: "#d32f2f", marginBottom: 8 },
  alertSubtext: { fontSize: 13, color: "#ffcdd2", textAlign: "center", marginBottom: 20, lineHeight: 18 },
  alertCallButtons: { width: "100%", gap: 10, marginBottom: 16 },
  bigAmbulanceButton: {
    backgroundColor: "#2e7d32",
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  bigAmbulanceText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  big112Button: {
    backgroundColor: "#d32f2f",
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  big112Text: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  iosCallNote: { color: "#90caf9", fontSize: 11, textAlign: "center", marginBottom: 12 },
  dismissAlertButton: { padding: 12, alignItems: "center" },
  dismissAlertText: { color: "#aaa", fontWeight: "600", fontSize: 13 },
});
