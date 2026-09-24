import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import SOSFlow from "../emergency/SOSFlow";

export default function SOSButton() {
  const { user, isLoggedIn } = useAuth();
  const [showSOSFlow, setShowSOSFlow] = useState(false);

  // Only show for logged in patients
  if (!isLoggedIn || user?.role !== "patient") return null;

  return (
    <>
      <button
        onClick={() => setShowSOSFlow(true)}
        className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-[max(1.5rem,env(safe-area-inset-right))] w-16 h-16 bg-red-600 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.6)] flex items-center justify-center text-white font-bold text-xl hover:bg-red-700 hover:scale-105 active:scale-95 transition-all z-50 animate-pulse min-w-[56px] min-h-[56px] touch-target"
        title="Emergency SOS"
      >
        SOS
      </button>

      {/* Structured SOS Emergency Workflow Modal */}
      <SOSFlow
        isOpen={showSOSFlow}
        onClose={() => setShowSOSFlow(false)}
      />
    </>
  );
}


