import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import axios from "axios";

// Custom Leaflet Icons
const pickupMarkerIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const hospitalMarkerIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const carMarkerIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function PublicTracking() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const fetchTracking = async () => {
    try {
      // Direct call to unauthenticated public tracking endpoint
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
      const res = await axios.get(`${API_URL}/sos/track/${token}`);
      setData(res.data?.data || res.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || "Tracking link is invalid or has expired.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracking();
    const interval = setInterval(fetchTracking, 10000); // 10s poll
    return () => clearInterval(interval);
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center space-y-3 text-white">
          <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-bold text-sm">Loading Emergency Ride Tracking...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-4 shadow-sm">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-lg font-black text-slate-800">Tracking Link Expired or Unavailable</h2>
          <p className="text-xs text-slate-500">{error || "This emergency tracking session is no longer active."}</p>
          <a
            href="tel:108"
            className="inline-block bg-red-600 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm"
          >
            Emergency Helpline: Call 108
          </a>
        </div>
      </div>
    );
  }

  const { patientName, hospital, patientLocation, driver, rideStatus } = data;
  const pLat = patientLocation?.lat || 17.4474;
  const pLng = patientLocation?.lng || 78.3762;
  const hLat = hospital?.lat || pLat + 0.02;
  const hLng = hospital?.lng || pLng + 0.02;
  const cLat = driver?.carLat || pLat + 0.003;
  const cLng = driver?.carLng || pLng + 0.003;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Emergency Banner */}
      <header className="bg-red-600 text-white px-4 py-3 flex items-center justify-between shadow-md z-10">
        <div className="flex items-center gap-2">
          <span className="text-xl animate-pulse">🚨</span>
          <div>
            <h1 className="font-black text-sm uppercase tracking-wide">Live Emergency Ride Tracking</h1>
            <p className="text-[11px] text-red-100">Patient: <strong className="text-white">{patientName}</strong></p>
          </div>
        </div>
        <a
          href="tel:108"
          className="bg-white text-red-700 font-extrabold text-xs px-3 py-1.5 rounded-xl shadow-xs"
        >
          Call 108
        </a>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-4">
        
        {/* Status Card */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Destination Hospital:</span>
                <span className="bg-red-50 text-red-700 text-[10px] font-black px-2 py-0.5 rounded">24/7 ER</span>
              </div>
              <h2 className="text-xl font-black text-slate-800 mt-0.5">{hospital?.name || "Emergency Hospital"}</h2>
              <p className="text-xs text-slate-500">{hospital?.address || "Emergency Department"}</p>
            </div>

            <div className="text-right shrink-0">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-black capitalize ${
                rideStatus === "arriving" ? "bg-amber-100 text-amber-800" :
                rideStatus === "in_progress" ? "bg-emerald-100 text-emerald-800" :
                "bg-blue-100 text-blue-800"
              }`}>
                Uber: {rideStatus?.replace("_", " ") || "En Route"}
              </span>
              <p className="text-xs font-bold text-slate-700 mt-1">ETA: ~{driver?.etaMinutes || 4} mins</p>
            </div>
          </div>

          {/* Driver & Vehicle */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <div>
              <p className="font-bold text-slate-800">{driver?.name || "Uber Partner Driver"}</p>
              <p className="text-slate-500">{driver?.vehicle || "Maruti Suzuki Dzire"}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold bg-white border border-slate-200 px-2 py-1 rounded-lg">
                {driver?.plate || "TS 08 UB 2026"}
              </span>
              {driver?.phone && (
                <a
                  href={`tel:${driver.phone}`}
                  className="bg-primary-600 hover:bg-primary-700 text-white font-bold px-3 py-1 rounded-lg transition-colors"
                >
                  Call Driver
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Leaflet OSM Map */}
        <div className="h-80 sm:h-96 rounded-3xl overflow-hidden border border-slate-200 shadow-md">
          <MapContainer
            center={[cLat, cLng]}
            zoom={13}
            scrollWheelZoom={false}
            className="w-full h-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* Pickup Marker */}
            <Marker position={[pLat, pLng]} icon={pickupMarkerIcon}>
              <Popup>Patient Pickup Location</Popup>
            </Marker>

            {/* Destination Hospital Marker */}
            <Marker position={[hLat, hLng]} icon={hospitalMarkerIcon}>
              <Popup>{hospital?.name}</Popup>
            </Marker>

            {/* Live Car Position */}
            <Marker position={[cLat, cLng]} icon={carMarkerIcon}>
              <Popup>Uber Car ({driver?.name})</Popup>
            </Marker>

            {/* Route */}
            <Polyline
              positions={[
                [pLat, pLng],
                [cLat, cLng],
                [hLat, hLng],
              ]}
              color="#2563eb"
              weight={4}
              opacity={0.8}
            />
          </MapContainer>
        </div>

        {/* Call Hospital button */}
        {hospital?.phone && (
          <div className="text-center pt-2">
            <a
              href={`tel:${hospital.phone}`}
              className="inline-block bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition-colors"
            >
              📞 Call {hospital.name} ({hospital.phone})
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
