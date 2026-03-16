import { Stack } from "expo-router";
import { useEffect } from "react";
import { registerForPushNotifications } from "../services/notifications";
import { registerUser } from "../services/api";

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
