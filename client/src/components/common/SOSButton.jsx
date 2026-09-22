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
    // Immediately prompt for live location on SOS tap
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(() => {}, () => {}, { enableHighAccuracy: true });
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
    
    const loadingToast = toast.loading("Acquiring GPS location...");

    if (!navigator.geolocation) {
      toast.dismiss(loadingToast);
      toast.error("Geolocation is not supported by your browser");
      setIsTriggering(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          toast.loading("Finding nearest emergency hospital...", { id: loadingToast });
          const { latitude, longitude } = position.coords;
          
          const res = await API.post("/emergency/trigger", {
            lat: latitude,
            lng: longitude,
            emergencyType: "general"
          });

          toast.dismiss(loadingToast);
          toast.success("Emergency triggered! Help is on the way.");
          
          // Redirect to live tracking page
          navigate(`/emergency/${res.data.data.emergency._id}`);
        } catch (err) {
          toast.dismiss(loadingToast);
          toast.error(err.response?.data?.message || "Failed to trigger SOS. No responders found.");
          
          // CLIENT-SIDE UBER FALLBACK
          // If the backend completely fails or returns 404, forcefully redirect to Uber
          toast.loading("Redirecting to Uber as a fallback...", { duration: 3000 });
          setTimeout(() => {
            const { latitude, longitude } = position.coords;
            // Fallback destination (AIIMS Bibinagar / nearest demo ER) since backend failed
            const hospLat = 17.4721;
            const hospLng = 78.7993;
            const hospName = "AIIMS Bibinagar Emergency";
            
            const hospAddress = "AIIMS Hospital, Warangal Highway, Bibinagar, Telangana 508126";
            const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${latitude}&pickup[longitude]=${longitude}&pickup[nickname]=My%20Location&dropoff[latitude]=${hospLat}&dropoff[longitude]=${hospLng}&dropoff[nickname]=${encodeURIComponent(hospName)}&dropoff[formatted_address]=${encodeURIComponent(hospAddress)}`;
            
            window.location.href = uberUrl;
          }, 2000);
        } finally {
          setIsTriggering(false);
        }
      },
      (error) => {
        toast.dismiss(loadingToast);
        toast.error("Please allow location access to use SOS feature.");
        setIsTriggering(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
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

