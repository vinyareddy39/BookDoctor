import { create } from "zustand";
import { User, EmergencyContact, Hospital, Emergency } from "../types";

interface AppState {
  user: User | null;
  setUser: (user: User) => void;
  updateMedicalId: (medicalId: User["medicalId"]) => void;
  addContact: (contact: EmergencyContact) => void;
  removeContact: (contactId: string) => void;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  updateMedicalId: (medicalId) => set((state) => ({ 
    user: state.user ? { ...state.user, medicalId } : null 
  })),
  addContact: (contact) => set((state) => {
    if (!state.user) return state;
    if (state.user.contacts.length >= 3) return state;
    return { user: { ...state.user, contacts: [...state.user.contacts, contact] } };
  }),
  removeContact: (contactId) => set((state) => {
    if (!state.user) return state;
    return { user: { ...state.user, contacts: state.user.contacts.filter(c => c.id !== contactId) } };
  })
}));

