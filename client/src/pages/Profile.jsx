import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../services/api";

const PRESET_AVATARS = [
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Aneka",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Jack",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Buster",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Luna",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Milo",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Coco",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Loki"
];

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const GENDERS = ["male", "female", "other"];

export default function Profile() {
  const { user } = useAuth();
  
  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [profilePicture, setProfilePicture] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [customAvatarUrl, setCustomAvatarUrl] = useState("");

  // Fetch latest profile info on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await API.get("/users/profile");
        const profileData = res.data?.data || res.data;
        if (profileData) {
          setName(profileData.name || "");
          setEmail(profileData.email || "");
          setPhone(profileData.phone || "");
          setProfilePicture(profileData.profilePicture || "");
          
          if (profileData.dob) {
            // format Date to YYYY-MM-DD for date input
            const d = new Date(profileData.dob);
            const formatted = d.toISOString().split("T")[0];
            setDob(formatted);
          } else {
            setDob("");
          }
          setGender(profileData.gender || "");
          setBloodGroup(profileData.bloodGroup || "");
          setEmergencyContact(profileData.emergencyContact || "");
          
          if (profileData.profilePicture && !PRESET_AVATARS.includes(profileData.profilePicture)) {
            setCustomAvatarUrl(profileData.profilePicture);
          }
        }
      } catch (err) {
        console.error("Failed to fetch profile", err);
        setError("Could not retrieve profile information.");
      } finally {
        setFetching(false);
      }
    };
    fetchProfile();
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSuccess("");
    setError("");
    setLoading(true);

    const payload = {
      name,
      phone,
      profilePicture: profilePicture || customAvatarUrl || "",
      dob: dob || null,
      gender,
      bloodGroup,
      emergencyContact,
    };

    try {
      const res = await API.put("/users/profile", payload);
      const updatedUser = res.data?.data || res.data;
      if (updatedUser) {
        setSuccess("Profile saved successfully!");
        
        // Update user storage
        const currentData = JSON.parse(localStorage.getItem("userData") || "{}");
        const newUserData = {
          ...currentData,
          name: updatedUser.name,
          email: updatedUser.email,
        };
        localStorage.setItem("userData", JSON.stringify(newUserData));
        
        // Short timeout to reload so header/context reflects name update
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center py-12 px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium text-sm">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleUpdate} className="space-y-8">
          
          {/* Header Card */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
            <div className="relative group">
              <img
                src={profilePicture || customAvatarUrl || "https://api.dicebear.com/7.x/initials/svg?seed=" + name}
                alt="Profile Avatar"
                className="w-24 h-24 rounded-2xl object-cover bg-slate-100 border border-slate-200 shadow-inner group-hover:opacity-90 transition-opacity"
              />
              <div className="absolute inset-0 rounded-2xl bg-black/10 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold cursor-default transition-all">
                Active
              </div>
            </div>
            <div className="text-center sm:text-left flex-grow">
              <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">{name || "Patient Profile"}</h1>
              <p className="text-slate-500 text-sm font-medium mt-0.5">{email}</p>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-100 mt-2 capitalize">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse"></span>
                Patient Account
              </span>
            </div>
          </div>

          {/* Form Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left: Avatar Picker */}
            <div className="lg:col-span-1 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Choose Avatar</h3>
                <p className="text-xs text-slate-400 mt-1">Select one of our preset templates or paste a custom link.</p>
              </div>

              <div className="grid grid-cols-4 gap-3">
                {PRESET_AVATARS.map((avatar) => {
                  const isSelected = profilePicture === avatar;
                  return (
                    <button
                      key={avatar}
                      type="button"
                      onClick={() => {
                        setProfilePicture(avatar);
                        setCustomAvatarUrl("");
                      }}
                      className={`p-1 rounded-xl border-2 transition-all hover:scale-105 bg-slate-50 ${
                        isSelected ? "border-primary-500 bg-primary-50/20 scale-105" : "border-transparent"
                      }`}
                    >
                      <img src={avatar} alt="Avatar option" className="w-full h-auto rounded-lg" />
                    </button>
                  );
                })}
              </div>

              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Custom Image URL</label>
                <input
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  value={customAvatarUrl}
                  onChange={(e) => {
                    setCustomAvatarUrl(e.target.value);
                    setProfilePicture("");
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-slate-50 focus:bg-white text-xs font-medium transition-all"
                />
              </div>
            </div>

            {/* Right: Profile Information */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8 space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-800 tracking-tight">Personal Information</h3>
                <p className="text-xs text-slate-400 mt-0.5">Keep your personal and emergency details up to date.</p>
              </div>

              {success && (
                <div className="px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm font-semibold flex items-center gap-2">
                  <span className="text-base">✓</span> {success}
                </div>
              )}

              {error && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold flex items-center gap-2">
                  <span className="text-base">✗</span> {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-slate-50 focus:bg-white transition-all text-sm font-medium"
                    placeholder="E.g. John Doe"
                  />
                </div>

                {/* Email (Disabled) */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 outline-none cursor-not-allowed text-sm font-medium"
                  />
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-slate-50 focus:bg-white transition-all text-sm font-medium"
                    placeholder="E.g. +91 99999 88888"
                  />
                </div>

                {/* Date of Birth */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date of Birth</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-slate-50 focus:bg-white transition-all text-sm font-medium"
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-slate-50 focus:bg-white transition-all text-sm font-medium"
                  >
                    <option value="">Select Gender</option>
                    {GENDERS.map((g) => (
                      <option key={g} value={g} className="capitalize">{g}</option>
                    ))}
                  </select>
                </div>

                {/* Blood Group */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Blood Group</label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-slate-50 focus:bg-white transition-all text-sm font-medium"
                  >
                    <option value="">Select Blood Group</option>
                    {BLOOD_GROUPS.map((bg) => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>

                {/* Emergency Contact */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Emergency Contact Details</label>
                  <input
                    type="text"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-slate-50 focus:bg-white transition-all text-sm font-medium"
                    placeholder="Name & contact number of family member/friend"
                  />
                </div>

              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    "Save Profile Details"
                  )}
                </button>
              </div>

            </div>

          </div>
        </form>
      </div>
    </div>
  );
}
