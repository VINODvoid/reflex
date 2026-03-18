import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import type { NotificationResponse } from "expo-notifications";
import { router } from "expo-router";
import { useStore } from "../store";

function handleNotificationData(
  data: unknown,
  setHighlightedPositionKey: (key: string | null) => void,
): void {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return;
  const d = data as Record<string, unknown>;
  if (typeof d.walletId !== "string" || typeof d.protocol !== "string") return;

  const chainId = typeof d.chainId === "string" ? parseInt(d.chainId, 10) : 0;
  const key = `${d.walletId}-${d.protocol}-${chainId}`;

  setHighlightedPositionKey(key);
  router.replace("/(tabs)/");
}

function processResponse(
  response: NotificationResponse,
  setHighlightedPositionKey: (key: string | null) => void,
): void {
  handleNotificationData(
    response.notification.request.content.data,
    setHighlightedPositionKey,
  );
}

export function useNotificationDeepLink(): void {
  const setHighlightedPositionKey = useStore((state) => state.setHighlightedPositionKey);

  // Handle cold-start: app was killed when notification arrived
  useEffect(() => {
    const response = Notifications.getLastNotificationResponse();
    if (response) {
      processResponse(response, setHighlightedPositionKey);
    }
  }, []);

  // Handle foreground / background tap
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      processResponse(response, setHighlightedPositionKey);
    });
    return () => subscription.remove();
  }, [setHighlightedPositionKey]);
}
