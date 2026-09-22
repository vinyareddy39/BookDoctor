import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, SafeAreaView } from "react-native";
import { useStore } from "../store/useStore";
import { EmergencyContact } from "../types";

export default function ContactsScreen() {
  const user = useStore((state) => state.user);
  const addContact = useStore((state) => state.addContact);
  const removeContact = useStore((state) => state.removeContact);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const handleAdd = () => {
    if (!name || !phone) return;
    if (user && user.contacts.length >= 3) {
      alert("Maximum 3 contacts allowed.");
      return;
    }
    const newContact: EmergencyContact = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      phone,
    };
    addContact(newContact);
    setName("");
    setPhone("");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Emergency Contacts</Text>
        <Text style={styles.subtitle}>These contacts will receive an SMS and push notification if you trigger an SOS.</Text>

        <View style={styles.form}>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Contact Name" />
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Phone Number" />
          <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
            <Text style={styles.addButtonText}>Add Contact ({user?.contacts.length || 0}/3)</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={user?.contacts || []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.contactCard}>
              <View>
                <Text style={styles.contactName}>{item.name}</Text>
                <Text style={styles.contactPhone}>{item.phone}</Text>
              </View>
              <TouchableOpacity onPress={() => removeContact(item.id)}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 20, flex: 1 },
  title: { fontSize: 24, fontWeight: "bold", color: "#333", marginBottom: 5 },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 20 },
  form: { marginBottom: 20, backgroundColor: "#f9f9f9", padding: 15, borderRadius: 8 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, marginBottom: 10, backgroundColor: "#fff" },
  addButton: { backgroundColor: "#0288d1", padding: 12, borderRadius: 8, alignItems: "center" },
  addButtonText: { color: "#fff", fontWeight: "bold" },
  contactCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fff", padding: 15, borderRadius: 8, borderWidth: 1, borderColor: "#eee", marginBottom: 10 },
  contactName: { fontSize: 16, fontWeight: "bold" },
  contactPhone: { color: "#666", marginTop: 2 },
  removeText: { color: "#d32f2f", fontWeight: "bold" },
});

