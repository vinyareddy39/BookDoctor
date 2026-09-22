import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView } from "react-native";
import { useStore } from "../store/useStore";
import { User } from "../types";

export default function OnboardingScreen({ navigation }: any) {
  const setUser = useStore((state) => state.setUser);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [allergies, setAllergies] = useState("");
  const [conditions, setConditions] = useState("");
  const [medications, setMedications] = useState("");

  const handleSave = () => {
    if (!name || !phone) {
      alert("Name and Phone are required.");
      return;
    }

    const newUser: User = {
      id: "mock-user-123", // Firebase Auth UID mock
      name,
      phone,
      medicalId: {
        bloodGroup,
        allergies,
        conditions,
        medications,
      },
      contacts: [],
    };
    
    // In a real app, write to Firestore here
    setUser(newUser);
    navigation.replace("Home");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Setup Medical ID</Text>
        <Text style={styles.subtitle}>This information will be sent to the hospital in an emergency.</Text>

        <Text style={styles.label}>Full Name *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="John Doe" />

        <Text style={styles.label}>Phone Number *</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+1 234 567 8900" />

        <Text style={styles.label}>Blood Group</Text>
        <TextInput style={styles.input} value={bloodGroup} onChangeText={setBloodGroup} placeholder="O+, A-, etc." />

        <Text style={styles.label}>Allergies</Text>
        <TextInput style={styles.input} value={allergies} onChangeText={setAllergies} placeholder="E.g. Peanuts, Penicillin" />

        <Text style={styles.label}>Medical Conditions</Text>
        <TextInput style={styles.input} value={conditions} onChangeText={setConditions} placeholder="E.g. Asthma, Diabetes" />

        <Text style={styles.label}>Current Medications</Text>
        <TextInput style={styles.input} value={medications} onChangeText={setMedications} placeholder="E.g. Inhaler, Insulin" />

        <TouchableOpacity style={styles.button} onPress={handleSave}>
          <Text style={styles.buttonText}>Save & Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { padding: 20 },
  title: { fontSize: 28, fontWeight: "bold", color: "#d32f2f", marginBottom: 5 },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 20 },
  label: { fontSize: 16, fontWeight: "600", marginBottom: 5, color: "#333" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, marginBottom: 15, fontSize: 16 },
  button: { backgroundColor: "#d32f2f", padding: 15, borderRadius: 8, alignItems: "center", marginTop: 10 },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
});

