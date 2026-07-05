import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../../services/api";
import toast from "react-hot-toast";
import DailyIframe from "@daily-co/daily-js";

export default function VideoConsultation() {
  const { id } = useParams(); // appointmentId
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [roomUrl, setRoomUrl] = useState("");
  const callRef = useRef(null);
  const dailyCallFrame = useRef(null);

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const res = await API.get(`/appointments/${id}/room`);
        setRoomUrl(res.data.data.url);
      } catch (err) {
        toast.error("Failed to generate meeting room. Starting local demo.");
        setRoomUrl("https://bookdoctordemo.daily.co/demo"); // Fallback public room for demo purposes
      } finally {
        setLoading(false);
      }
    };
    fetchRoom();
  }, [id]);

  const leaveCall = useCallback(() => {
    if (dailyCallFrame.current) {
      dailyCallFrame.current.leave();
      dailyCallFrame.current.destroy();
      dailyCallFrame.current = null;
    }
    navigate(-1);
  }, [navigate]);

  useEffect(() => {
    if (!roomUrl || !callRef.current) return;

    if (!dailyCallFrame.current) {
      dailyCallFrame.current = DailyIframe.createFrame(callRef.current, {
        iframeStyle: {
          width: "100%",
          height: "100%",
          border: "none",
          backgroundColor: "#f8fafc",
        },
        showLeaveButton: true,
      });

      dailyCallFrame.current.on("left-meeting", leaveCall);
    }

    dailyCallFrame.current.join({ url: roomUrl });

    return () => {
      if (dailyCallFrame.current) {
        dailyCallFrame.current.leave();
        dailyCallFrame.current.destroy();
        dailyCallFrame.current = null;
      }
    };
  }, [roomUrl, leaveCall]);

  if (loading) {
    return (
      <div className="h-screen bg-slate-900 flex flex-col items-center justify-center">
        <div className="animate-spin w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent mb-4" />
        <p className="text-white font-medium text-sm">Preparing consultation room...</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-900 flex flex-col">
      <div className="p-4 bg-slate-800 flex justify-between items-center text-white shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center font-bold shadow-inner">
            🎥
          </div>
          <h2 className="font-bold tracking-wide">Video Consultation</h2>
        </div>
        <button onClick={leaveCall} className="bg-red-500 hover:bg-red-600 px-4 py-1.5 rounded-lg text-sm font-bold shadow transition-colors">
          End Call
        </button>
      </div>
      
      <div className="flex-1 bg-black relative">
        {/* The Daily.co iframe mounts here */}
        <div ref={callRef} className="absolute inset-0 w-full h-full" />
      </div>
    </div>
  );
}
