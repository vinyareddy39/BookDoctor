import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NavigationContainer } from "@react-navigation/native";
import HomeScreen from "../screens/HomeScreen";
import OnboardingScreen from "../screens/OnboardingScreen";
import ContactsScreen from "../screens/ContactsScreen";
import LiveTrackingScreen from "../screens/LiveTrackingScreen";
import HistoryScreen from "../screens/HistoryScreen";
import HospitalDashboardScreen from "../screens/HospitalDashboardScreen";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: "RapidCare SOS" }} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Contacts" component={ContactsScreen} />
        <Stack.Screen name="LiveTracking" component={LiveTrackingScreen} options={{ title: "Emergency Tracking" }} />
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="HospitalDashboard" component={HospitalDashboardScreen} options={{ title: "Hospital Dashboard" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

