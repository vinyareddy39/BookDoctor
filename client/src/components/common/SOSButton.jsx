import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import API from "../../services/api";
import toast from "react-hot-toast";
import SOSModal from "./SOSModal";
import {
  getMobilePlatform,
  normalizePhoneNumber,
  buildSmsLink,
  buildWhatsAppLink,
} from "../../utils/smsHelper";

export default function SOSButton() {
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();

  // Modal and Flow States
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [smsMessage, setSmsMessage] = useState("");
  const [platform, setPlatform] = useState("desktop");

  // Only show for logged in patients
  if (!isLoggedIn || user?.role !== "patient") return null;

  const buildEmergencyText = (patientName, coords) => {
    const cleanName = patientName || user?.name || "Patient";
    if (coords) {
      return `EMERGENCY! ${cleanName} needs help. Location: https://maps.google.com/?q=${coords.lat},${coords.lng}`;
    }
    return `EMERGENCY! ${cleanName} needs help. Please call immediately.`;
  };

  const handleSosClick = async () => {
    const currentPlatform = getMobilePlatform();
    setPlatform(currentPlatform);

    // Step 1: Fetch profile with Axios & JWT
    try {
      const res = await API.get("/users/profile");
      const fetchedProfile = res.data?.data || res.data;
      const contact = fetchedProfile?.emergencyContact?.trim();

      if (!contact) {
        toast.error("Please add an Emergency Contact number in your profile first!", {
          duration: 5000,
          icon: "⚠️",
        });
        navigate("/profile");
        return;
      }

      setProfile(fetchedProfile);

      // Initialize with non-location text while GPS resolves
      const initialText = buildEmergencyText(fetchedProfile.name, null);
      setSmsMessage(initialText);
      setLocation(null);
      setLocationError(null);
      setIsOpen(true);

      // Step 2: Request High-Accuracy Geolocation with 8s timeout
      if (!navigator.geolocation) {
        setLocationError("Geolocation is not supported by your browser");
        return;
      }

      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setIsLocating(false);
          const coords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          setLocation(coords);
          setLocationError(null);
          setSmsMessage(buildEmergencyText(fetchedProfile.name, coords));
        },
        (err) => {
          setIsLocating(false);
          let reason = "position unavailable";
          if (err.code === err.PERMISSION_DENIED) {
            reason = "permission denied";
          } else if (err.code === err.TIMEOUT) {
            reason = "timed out";
          }
          setLocationError(reason);
          setSmsMessage(buildEmergencyText(fetchedProfile.name, null));
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 0,
        }
      );
    } catch (err) {
      console.error("SOS Profile Fetch Error:", err);
      toast.error(err.response?.data?.message || "Failed to retrieve emergency profile.");
    }
  };

  const contactNumber = profile?.emergencyContact || "";
  const smsLink = buildSmsLink(contactNumber, smsMessage, platform);
  const phoneCallLink = `tel:${normalizePhoneNumber(contactNumber)}`;
  const whatsappLink = buildWhatsAppLink(contactNumber, smsMessage);

  return (
    <>
      {/* 
        Floating SOS Button:
        - Moved to bottom-left to prevent overlapping "Save Profile Details"
        - Styled with min 64x64px for emergency touch compliance
        - Respects safe-area-inset for iPhone and notch devices
      */}
      <button
        onClick={handleSosClick}
        className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-[max(1.5rem,env(safe-area-inset-left))] w-16 h-16 min-w-[64px] min-h-[64px] bg-red-600 rounded-full shadow-[0_0_24px_rgba(220,38,38,0.7)] flex items-center justify-center text-white font-black text-xl hover:bg-red-700 hover:scale-105 active:scale-95 transition-all z-50 animate-pulse touch-target"
        title="Emergency SOS"
        aria-label="Emergency SOS"
      >
        SOS
      </button>

      {/* Direct-Tap SOS Confirmation Modal */}
      <SOSModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        profile={profile}
        location={location}
        locationError={locationError}
        platform={platform}
        smsMessage={smsMessage}
        smsLink={smsLink}
        phoneCallLink={phoneCallLink}
        whatsappLink={whatsappLink}
        isLocating={isLocating}
      />
    </>
  );
}
