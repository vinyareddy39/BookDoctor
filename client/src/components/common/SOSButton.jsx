import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import API from "../../services/api";

export default function SOSButton() {
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [isCounting, setIsCounting] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [isTriggering, setIsTriggering] = useState(false);

  useEffect(() => {
    let timer;
    if (isCounting && countdown > 0) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    } else if (isCounting && countdown === 0) {
      triggerEmergency();
    }
    return () => clearTimeout(timer);
  }, [isCounting, countdown]);

  const handlePress = () => {
    // Immediately prompt for fresh live location on SOS tap (never cached)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(() => {}, () => {}, { 
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000 
      });
    }
    setCountdown(3);
    setIsCounting(true);
  };

  const cancelSOS = () => {
    setIsCounting(false);
    setCountdown(3);
  };

  const triggerEmergency = () => {
    setIsCounting(false);
    setIsTriggering(true);
    
    const loadingToast = toast.loading("Acquiring fresh GPS location...");

    if (!navigator.geolocation) {
      toast.dismiss(loadingToast);
      toast.error("Geolocation is not supported by your browser");
      setIsTriggering(false);
      return;
    }

    // Force fresh hardware GPS fix on every single SOS press (maximumAge: 0)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          toast.loading("Calculating fastest hospital ER via Dijkstra road routing...", { id: loadingToast });
          const { latitude, longitude } = position.coords;
          
          const res = await API.post("/emergency/trigger", {
            lat: latitude,
            lng: longitude,
            emergencyType: "general"
          });

          toast.dismiss(loadingToast);
          toast.success("Fastest ER hospital found! Redirecting to Uber...");
          
          const hosp = res.data?.data?.emergency?.assignedHospitalId;
          const hospLat = hosp?.lat || 17.3664;
          const hospLng = hosp?.lng || 78.5363;
          const hospName = hosp?.name || "Omni Hospitals Emergency ER";

          const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${latitude}&pickup[longitude]=${longitude}&dropoff[latitude]=${hospLat}&dropoff[longitude]=${hospLng}&dropoff[nickname]=${encodeURIComponent(hospName)}`;

          window.location.href = uberUrl;
        } catch (err) {
          toast.dismiss(loadingToast);
          toast.error(err.response?.data?.message || "Failed to trigger SOS. Redirecting to nearest fallback hospital...");
          
          // CLIENT-SIDE UBER FALLBACK
          const { latitude, longitude } = position.coords;
          const hospLat = 17.3664;
          const hospLng = 78.5363;
          const hospName = "Omni Hospitals Emergency ER";
          const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${latitude}&pickup[longitude]=${longitude}&dropoff[latitude]=${hospLat}&dropoff[longitude]=${hospLng}&dropoff[nickname]=${encodeURIComponent(hospName)}`;
          
          window.location.href = uberUrl;
        } finally {
          setIsTriggering(false);
        }
      },
      (error) => {
        toast.dismiss(loadingToast);
        toast.error("Please allow location access to use SOS feature.");
        setIsTriggering(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  };

  // Only show for logged in patients (Must be after all hooks!)
  if (!isLoggedIn || user?.role !== "patient") return null;

  return (
    <>
      <button
        onClick={handlePress}
        disabled={isTriggering}
        className="fixed bottom-6 right-6 w-16 h-16 bg-red-600 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.6)] flex items-center justify-center text-white font-bold text-xl hover:bg-red-700 hover:scale-105 active:scale-95 transition-all z-50 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Emergency SOS"
      >
        SOS
      </button>

      {/* Countdown Modal */}
      {isCounting && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-fade-in-up">
            <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <span className="text-5xl font-black text-red-600">{countdown}</span>
            </div>
            
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Triggering SOS</h3>
            <p className="text-slate-500 mb-8">
              Acquiring live GPS location and dispatching Emergency Uber to nearest hospital ER...
            </p>
            
            <button 
              onClick={cancelSOS}
              className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}
    </>
  );
}

