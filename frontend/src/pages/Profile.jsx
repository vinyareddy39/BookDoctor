import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../services/api";

export default function Profile() {
  const { user, persist } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Fetch latest profile info on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await API.get("/auth/profile");
        const profileData = res.data?.data || res.data;
        if (profileData) {
          setName(profileData.name || "");
          setEmail(profileData.email || "");
          setPhone(profileData.phone || "");
        }
      } catch (err) {
        console.error("Failed to fetch profile", err);
      }
    };
    fetchProfile();
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSuccess("");
    setError("");
    setLoading(true);
    try {
      const res = await API.put("/user/profile", { name, phone });
      const updatedUser = res.data?.data || res.data;
      if (updatedUser) {
        setSuccess("Profile updated successfully!");
        // Update auth context state and localStorage
        const token = localStorage.getItem("token");
        const newUserData = {
          _id: updatedUser._id || user._id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role || user.role,
        };
        // Use persist helper from AuthContext
        localStorage.setItem("userData", JSON.stringify(newUserData));
        // We trigger context update by calling the auth persist or updating it
        window.location.reload(); // Quick reload to refresh context values
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-73px)] bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        <div className="bg-primary-600 px-8 py-10 text-white text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 rounded-full mb-4">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold">{name}</h1>
          <p className="text-primary-100 mt-1 capitalize">{user?.role} Profile</p>
        </div>

        <div className="p-8">
          {success && (
            <div className="mb-6 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {success}
            </div>
          )}

          {error && (
            <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleUpdate} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-4 py-3 rounded-lg border border-slate-100 bg-slate-50 text-slate-500 cursor-not-allowed outline-none"
              />
              <p className="text-xs text-slate-400 mt-1">Email cannot be changed after registration.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? "Updating..." : "Save Profile Details"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
