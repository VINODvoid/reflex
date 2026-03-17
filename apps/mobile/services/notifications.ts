import * as Notifications from "expo-notifications";

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return null;
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: "c7e1d52f-4da2-4d55-972b-34f70370657d",
    });
    return token.data;
  } catch (e) {
    return null;
  }
}
