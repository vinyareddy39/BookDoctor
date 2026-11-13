import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as Contacts from "expo-contacts";
import { useStore, MAX_CONTACTS } from "../store/useStore";
import { EmergencyContact } from "../types";
import { normalizeToE164 } from "../utils/phoneUtils";

export default function ContactsScreen() {
  const user = useStore((state) => state.user);
  const addContact = useStore((state) => state.addContact);
  const updateContact = useStore((state) => state.updateContact);
  const removeContact = useStore((state) => state.removeContact);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);

  // Address book picker fallback modal state
  const [pickerModalVisible, setPickerModalVisible] = useState(false);
  const [phoneContacts, setPhoneContacts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(false);

  const contactsList = user?.contacts || [];

  const handleManualAdd = () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert("Required Fields", "Please provide both contact name and phone number.");
      return;
    }

    const res = addContact({ name, phone });
    if (!res.success) {
      Alert.alert("Cannot Add Contact", res.error || "Validation error");
      return;
    }

    setName("");
    setPhone("");
  };

  const handleSaveEdit = () => {
    if (!editingContact) return;
    const res = updateContact(editingContact.id, {
      name: editingContact.name,
      phone: editingContact.phone,
    });
    if (!res.success) {
      Alert.alert("Update Failed", res.error || "Could not update contact.");
      return;
    }
    setEditingContact(null);
  };

  /**
   * System contact picker:
   * Uses Contacts.presentContactPickerAsync() first so the whole address book is never read.
   * Falls back to requestPermissionsAsync + getContactsAsync with a searchable list if unavailable.
   */
  const handleAddFromPhone = async () => {
    if (contactsList.length >= MAX_CONTACTS) {
      Alert.alert("Limit Reached", `You can have at most ${MAX_CONTACTS} emergency contacts.`);
      return;
    }

    try {
      // 1. Try system native contact picker (preserves privacy - zero book reading)
      if (typeof Contacts.presentContactPickerAsync === "function") {
        const picked = await Contacts.presentContactPickerAsync();
        if (picked && picked.name) {
          const rawPhone = picked.phoneNumbers?.[0]?.number;
          if (!rawPhone) {
            Alert.alert("No Phone Number", "The selected contact does not have a phone number.");
            return;
          }

          const res = addContact({
            name: picked.name,
            phone: rawPhone,
          });
          if (!res.success) {
            Alert.alert("Contact Not Added", res.error || "Phone number validation failed.");
          }
          return;
        }
      }
    } catch (pickerErr) {
      console.warn("[Contacts] System contact picker unavailable or cancelled, falling back to permission-based picker:", pickerErr);
    }

    // 2. Fallback: Request permission and open searchable list
    try {
      setLoadingContacts(true);
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Contact permission is needed to select from your address book.");
        setLoadingContacts(false);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
        sort: Contacts.SortTypes.FirstName,
      });

      const validList = (data || []).filter(
        (c) => c.name && c.phoneNumbers && c.phoneNumbers.length > 0
      );

      setPhoneContacts(validList);
      setPickerModalVisible(true);
    } catch (err: any) {
      Alert.alert("Contacts Error", err.message || "Failed to load device contacts.");
    } finally {
      setLoadingContacts(false);
    }
  };

  const selectContactFromList = (contact: any) => {
    const rawPhone = contact.phoneNumbers?.[0]?.number;
    if (!rawPhone) {
      Alert.alert("No Phone Number", "This contact does not have a phone number.");
      return;
    }

    const res = addContact({
      name: contact.name,
      phone: rawPhone,
    });

    if (!res.success) {
      Alert.alert("Contact Not Added", res.error || "Could not validate phone number.");
      return;
    }

    setPickerModalVisible(false);
  };

  const filteredPhoneContacts = phoneContacts.filter((c) =>
    (c.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Emergency Contacts</Text>
        <Text style={styles.subtitle}>
          Add up to {MAX_CONTACTS} emergency contacts. They will receive automated SMS alerts with your live location during an SOS.
        </Text>

        {/* Action Button: Add from Phone Contacts */}
        <TouchableOpacity
          style={styles.phonePickerButton}
          onPress={handleAddFromPhone}
          disabled={loadingContacts}
        >
          {loadingContacts ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.phonePickerButtonText}>📱 Add from Phone Contacts</Text>
          )}
        </TouchableOpacity>

        {/* Manual Input Form */}
        <View style={styles.form}>
          <Text style={styles.sectionHeader}>Or Add Manually</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Full Name"
            placeholderTextColor="#888"
          />
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="Phone Number (e.g. 9876543210 or +91...)"
            placeholderTextColor="#888"
          />
          <TouchableOpacity
            style={[styles.addButton, contactsList.length >= MAX_CONTACTS && styles.disabledButton]}
            onPress={handleManualAdd}
            disabled={contactsList.length >= MAX_CONTACTS}
          >
            <Text style={styles.addButtonText}>
              Add Contact ({contactsList.length}/{MAX_CONTACTS})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Saved Contacts List */}
        <FlatList
          data={contactsList}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No emergency contacts added yet.</Text>
              <Text style={styles.emptySubtext}>
                Warning: SOS ride flow will proceed, but emergency SMS notifications will be skipped.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.contactCard}>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{item.name}</Text>
                <Text style={styles.contactPhone}>{item.phone}</Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => setEditingContact({ ...item })}
                >
                  <Text style={styles.editText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeContact(item.id)}
                >
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />

        {/* Edit Modal */}
        {editingContact && (
          <Modal transparent animationType="fade" visible={Boolean(editingContact)}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Edit Emergency Contact</Text>
                <TextInput
                  style={styles.input}
                  value={editingContact.name}
                  onChangeText={(val) =>
                    setEditingContact({ ...editingContact, name: val })
                  }
                  placeholder="Contact Name"
                />
                <TextInput
                  style={styles.input}
                  value={editingContact.phone}
                  onChangeText={(val) =>
                    setEditingContact({ ...editingContact, phone: val })
                  }
                  keyboardType="phone-pad"
                  placeholder="Phone Number"
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.cancelBtn]}
                    onPress={() => setEditingContact(null)}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.saveBtn]}
                    onPress={handleSaveEdit}
                  >
                    <Text style={styles.saveBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* Fallback Searchable Contacts Modal */}
        <Modal visible={pickerModalVisible} animationType="slide">
          <SafeAreaView style={styles.pickerModalRoot}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Select Contact</Text>
              <TouchableOpacity onPress={() => setPickerModalVisible(false)}>
                <Text style={styles.pickerCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Search contacts..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <FlatList
              data={filteredPhoneContacts}
              keyExtractor={(item, index) => item.id || String(index)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => selectContactFromList(item)}
                >
                  <Text style={styles.pickerItemName}>{item.name}</Text>
                  <Text style={styles.pickerItemPhone}>
                    {item.phoneNumbers?.[0]?.number}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </SafeAreaView>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 20, flex: 1 },
  title: { fontSize: 24, fontWeight: "bold", color: "#212121", marginBottom: 5 },
  subtitle: { fontSize: 13, color: "#666", marginBottom: 15, lineHeight: 18 },
  phonePickerButton: {
    backgroundColor: "#1976d2",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
    elevation: 2,
  },
  phonePickerButtonText: { color: "#fff", fontSize: 15, fontWeight: "bold" },
  form: {
    marginBottom: 20,
    backgroundColor: "#f7f9fa",
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  sectionHeader: { fontSize: 13, fontWeight: "700", color: "#555", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    backgroundColor: "#fff",
    fontSize: 14,
  },
  addButton: {
    backgroundColor: "#0288d1",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  disabledButton: { backgroundColor: "#90caf9" },
  addButtonText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  contactCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginBottom: 10,
  },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 15, fontWeight: "bold", color: "#212121" },
  contactPhone: { color: "#555", marginTop: 2, fontSize: 13 },
  cardActions: { flexDirection: "row", gap: 10 },
  editBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  editText: { color: "#0288d1", fontWeight: "bold", fontSize: 13 },
  removeBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  removeText: { color: "#d32f2f", fontWeight: "bold", fontSize: 13 },
  emptyContainer: {
    padding: 20,
    alignItems: "center",
    backgroundColor: "#fff3e0",
    borderRadius: 8,
    marginTop: 10,
  },
  emptyText: { color: "#e65100", fontWeight: "bold", fontSize: 14 },
  emptySubtext: {
    color: "#bf360c",
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
    lineHeight: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 15, color: "#212121" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 10 },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  cancelBtn: { backgroundColor: "#eee" },
  cancelBtnText: { color: "#333", fontWeight: "600" },
  saveBtn: { backgroundColor: "#0288d1" },
  saveBtnText: { color: "#fff", fontWeight: "bold" },
  pickerModalRoot: { flex: 1, backgroundColor: "#fff", padding: 16 },
  pickerModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  pickerModalTitle: { fontSize: 18, fontWeight: "bold" },
  pickerCloseText: { color: "#0288d1", fontSize: 16, fontWeight: "600" },
  searchInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  pickerItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  pickerItemName: { fontSize: 15, fontWeight: "600" },
  pickerItemPhone: { fontSize: 13, color: "#666", marginTop: 2 },
});
