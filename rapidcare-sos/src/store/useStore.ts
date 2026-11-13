import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { User, EmergencyContact } from "../types";
import { normalizeToE164 } from "../utils/phoneUtils";

export const MAX_CONTACTS = 5;

function generateDeviceId(): string {
  return `rcdev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

interface UberConnectionState {
  connected: boolean;
  accessToken?: string | null;
  expiresAt?: string | null;
  riderName?: string | null;
}

interface AppState {
  user: User | null;
  deviceId: string;
  serverAuthToken: string | null;
  outboundVoiceCallEnabled: boolean;
  uberConnection: UberConnectionState;
  setUser: (user: User) => void;
  updateMedicalId: (medicalId: User["medicalId"]) => void;
  addContact: (contact: Omit<EmergencyContact, "id"> & { id?: string }) => { success: boolean; error?: string };
  updateContact: (id: string, updates: Partial<Omit<EmergencyContact, "id">>) => { success: boolean; error?: string };
  removeContact: (contactId: string) => void;
  setServerAuthToken: (token: string | null) => void;
  setOutboundVoiceCallEnabled: (enabled: boolean) => void;
  setUberConnection: (connection: Partial<UberConnectionState>) => void;
  disconnectUber: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: {
        id: "local-user-default",
        name: "My Profile",
        phone: "+919876543210",
        medicalId: {
          bloodGroup: "",
          allergies: "",
          conditions: "",
          medications: "",
        },
        contacts: [],
      },
      deviceId: generateDeviceId(),
      serverAuthToken: null,
      outboundVoiceCallEnabled: false,
      uberConnection: {
        connected: false,
        accessToken: null,
        expiresAt: null,
        riderName: null,
      },
      setUser: (user) => set({ user }),
      updateMedicalId: (medicalId) =>
        set((state) => ({
          user: state.user ? { ...state.user, medicalId } : null,
        })),
      addContact: (contact) => {
        const state = get();
        if (!state.user) {
          return { success: false, error: "User session not initialized" };
        }
        if (state.user.contacts.length >= MAX_CONTACTS) {
          return { success: false, error: `Maximum ${MAX_CONTACTS} emergency contacts allowed` };
        }

        let normalizedPhone = "";
        try {
          normalizedPhone = normalizeToE164(contact.phone);
        } catch (e: any) {
          return { success: false, error: e.message || "Invalid phone number" };
        }

        const newContact: EmergencyContact = {
          id: contact.id || `contact_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: contact.name.trim() || "Emergency Contact",
          phone: normalizedPhone,
        };

        set({
          user: {
            ...state.user,
            contacts: [...state.user.contacts, newContact],
          },
        });
        return { success: true };
      },
      updateContact: (id, updates) => {
        const state = get();
        if (!state.user) return { success: false, error: "User not found" };

        let normalizedPhone = undefined;
        if (updates.phone) {
          try {
            normalizedPhone = normalizeToE164(updates.phone);
          } catch (e: any) {
            return { success: false, error: e.message || "Invalid phone number" };
          }
        }

        const updatedContacts = state.user.contacts.map((c) => {
          if (c.id !== id) return c;
          return {
            ...c,
            name: updates.name !== undefined ? updates.name.trim() : c.name,
            phone: normalizedPhone !== undefined ? normalizedPhone : c.phone,
          };
        });

        set({
          user: {
            ...state.user,
            contacts: updatedContacts,
          },
        });
        return { success: true };
      },
      removeContact: (contactId) =>
        set((state) => {
          if (!state.user) return state;
          return {
            user: {
              ...state.user,
              contacts: state.user.contacts.filter((c) => c.id !== contactId),
            },
          };
        }),
      setServerAuthToken: (token) => set({ serverAuthToken: token }),
      setOutboundVoiceCallEnabled: (enabled) => set({ outboundVoiceCallEnabled: enabled }),
      setUberConnection: (connection) =>
        set((state) => ({
          uberConnection: { ...state.uberConnection, ...connection },
        })),
      disconnectUber: () =>
        set({
          uberConnection: {
            connected: false,
            accessToken: null,
            expiresAt: null,
            riderName: null,
          },
        }),
    }),
    {
      name: "rapidcare-sos-store-v2",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
