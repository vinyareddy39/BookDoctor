import React, { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from "react-native";
import { useStore } from "../store/useStore";

export default function HomeScreen({ navigation }: any) {
  const user = useStore((state) => state.user);

  useEffect(() => {
    // If no user profile exists, force them to onboard
    if (!user) {
      navigation.replace("Onboarding");
    }
  }, [user]);

  if (!user) return <View style={styles.container} />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcome}>Hi, {user.name}</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Contacts")}>
          <Text style={styles.link}>Manage Contacts</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.center}>
        <Text style={styles.placeholder}>SOS Button Will Go Here (Phase 3)</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", justifyContent: "space-between", padding: 20, alignItems: "center" },
  welcome: { fontSize: 20, fontWeight: "bold" },
  link: { color: "#0288d1", fontWeight: "bold" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  placeholder: { color: "#999" },
});

