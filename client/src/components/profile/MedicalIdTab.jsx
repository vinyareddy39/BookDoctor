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
        emergencyContacts: contacts
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

