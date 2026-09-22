import { useState } from "react";
import toast from "react-hot-toast";
import API from "../../services/api";

export default function MedicalIdTab({ profile, setProfile }) {
  const [loading, setLoading] = useState(false);

  // Form states based on profile
  const [bloodGroup, setBloodGroup] = useState(profile?.medicalId?.bloodGroup || "");
  const [allergies, setAllergies] = useState(profile?.medicalId?.allergies || "");
  const [conditions, setConditions] = useState(profile?.medicalId?.conditions || "");
  const [medications, setMedications] = useState(profile?.medicalId?.medications || "");
  
  // Emergency Contacts
  const [contacts, setContacts] = useState(profile?.emergencyContacts || []);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [uberConnected, setUberConnected] = useState(profile?.uberAccount?.isConnected ?? true);
  const [uberEmail, setUberEmail] = useState(profile?.uberAccount?.uberEmail || profile?.email || "");

  const handleSaveMedicalId = async () => {
    try {
      setLoading(true);
      const res = await API.put("/users/medical-id", {
        medicalId: {
          bloodGroup,
          allergies,
          conditions,
          medications
        },
        emergencyContacts: contacts,
        uberAccount: {
          isConnected: uberConnected,
          uberEmail: uberEmail,
          connectedAt: new Date()
        }
      });
      const updatedUser = res.data?.data || res.data;
      setProfile(updatedUser);
      toast.success("Medical ID updated successfully!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update Medical ID.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = () => {
    if (!newContactName || !newContactPhone) {
      return toast.error("Please provide both name and phone.");
    }
    if (contacts.length >= 3) {
      return toast.error("Maximum 3 emergency contacts allowed.");
    }

    setContacts([...contacts, { name: newContactName, phone: newContactPhone }]);
    setNewContactName("");
    setNewContactPhone("");
  };

  const handleRemoveContact = (indexToRemove) => {
    setContacts(contacts.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <div className="space-y-8">

      {/* Uber Emergency Auto-Dispatch Integration Card */}
      <div className={`p-5 rounded-2xl border transition-all ${
        uberConnected ? "bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200" : "bg-amber-50 border-amber-200"
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center font-black text-sm shadow-sm">
              UBER
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-slate-900 text-sm">Uber Emergency Transit Link</h4>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  uberConnected ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                }`}>
                  {uberConnected ? "Connected Active ✓" : "Action Required"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Zero-Touch Autonomous Dispatch for cardiac arrest and critical trauma when ambulances are unavailable.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const next = !uberConnected;
              setUberConnected(next);
              if (next) {
                toast.success("Uber account linked for Emergency Dispatch! Remember to click Save.");
              } else {
                toast("Uber account unlinked.", { icon: "ℹ️" });
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
              uberConnected 
                ? "bg-white border border-slate-200 text-slate-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                : "bg-black text-white hover:bg-slate-800"
            }`}
          >
            {uberConnected ? "Disconnect" : "🔗 Connect Uber Account"}
          </button>
        </div>

        {uberConnected && (
          <div className="mt-3 pt-3 border-t border-emerald-200/60 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium flex items-center gap-1.5">
              <span>🛡️</span> Linked Account: <strong className="text-slate-800">{uberEmail || "patient@uber.com"}</strong>
            </span>
            <span className="text-emerald-700 font-bold text-[11px]">
              ✓ Pre-authorized for GPS Emergency Pickup
            </span>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">Medical ID (SOS Emergency)</h3>
        <p className="text-slate-500 mb-6 text-sm">
          This information is shared securely with emergency responders and the assigned hospital when you trigger an SOS.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Blood Group</label>
            <select
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none"
            >
              <option value="">Select Blood Group...</option>
              {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map(bg => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Allergies</label>
            <input
              type="text"
              placeholder="e.g. Penicillin, Peanuts"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Medical Conditions</label>
            <input
              type="text"
              placeholder="e.g. Asthma, Type 2 Diabetes"
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Current Medications</label>
            <input
              type="text"
              placeholder="e.g. Albuterol, Metformin"
              value={medications}
              onChange={(e) => setMedications(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none"
            />
          </div>
        </div>
      </div>

      <hr className="border-slate-100 border-2 rounded-full" />

      <div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">Emergency Contacts</h3>
        <p className="text-slate-500 mb-6 text-sm">
          Up to 3 close contacts who should be notified when an emergency occurs.
        </p>

        <div className="space-y-4 mb-6">
          {contacts.map((contact, idx) => (
            <div key={idx} className="flex items-center justify-between bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
              <div>
                <p className="font-bold text-slate-800">{contact.name}</p>
                <p className="text-sm text-slate-500">{contact.phone}</p>
              </div>
              <button 
                type="button"
                onClick={() => handleRemoveContact(idx)}
                className="text-red-500 hover:text-red-700 text-sm font-bold px-3 py-1 bg-red-50 rounded-lg"
              >
                Remove
              </button>
            </div>
          ))}
          {contacts.length === 0 && (
            <p className="text-sm text-slate-400 italic">No emergency contacts added yet.</p>
          )}
        </div>

        {contacts.length < 3 && (
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <h4 className="text-sm font-bold text-slate-700">Add New Contact ({contacts.length}/3)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Name"
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none"
              />
              <input
                type="tel"
                placeholder="Phone Number"
                value={newContactPhone}
                onChange={(e) => setNewContactPhone(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleAddContact}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 rounded-lg transition-colors text-sm"
            >
              + Add Contact
            </button>
          </div>
        )}
      </div>

      <div className="pt-4 flex justify-end">
        <button
          type="button"
          onClick={handleSaveMedicalId}
          disabled={loading}
          className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save Medical ID & Contacts"}
        </button>
      </div>
    </div>
  );
}

