import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#4F46E5", // Modern Indigo
        tabBarInactiveTintColor: "#94A3B8",
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: "#F1F5F9",
          height: 88, // Increased height for modern spacing (iPhone safe area)
          paddingBottom: 30,
          paddingTop: 12,
          backgroundColor: "#FFFFFF",
          elevation: 0, // Remove shadow on Android
          shadowOpacity: 0, // Remove shadow on iOS
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Portfolio", // "Portfolio" is more standard than "Home" in crypto
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "wallet" : "wallet-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts" // Changed from 'alerts' to 'market' or 'prices'
        options={{
          title: "Market",
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "chart-line-variant" : "chart-line"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "account-circle" : "account-circle-outline"}
              size={24} // Using 'account' is more modern for settings/profile combos
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
