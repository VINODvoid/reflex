import * as Notifications from "expo-notifications";
import { EXPO_PROJECT_ID } from "../constants/config";

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return null;
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: EXPO_PROJECT_ID,
    });
    return token.data;
  } catch (e) {
    return null;
  }
}
