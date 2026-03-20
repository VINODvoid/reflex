import * as Notifications from "expo-notifications";
import { EXPO_PROJECT_ID } from "../constants/config";

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") {
      console.warn("[notifications] permission not granted:", status);
      return null;
    }
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: EXPO_PROJECT_ID,
    });
    console.log("[notifications] push token registered:", token.data);
    return token.data;
  } catch (e) {
    console.error("[notifications] getExpoPushTokenAsync failed:", e);
    return null;
  }
}
