import { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getAlertHistory } from "../services/api";
import { useStore } from "../store";
import { AlertEvent } from "../store/types";
import {
  FontFamily,
  FontSize,
  Spacing,
  Radius,
} from "../design-system/tokens";
import { useThemeColors, useIsDark } from "../hooks/useThemeColors";

export default function AlertHistoryScreen() {
  const colors = useThemeColors();
  const isDark = useIsDark();
  const userId = useStore((state) => state.userId);

  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    getAlertHistory(userId)
      .then(setEvents)
      .catch(() => setError("Failed to load history."))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.bgPrimary }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: FontFamily.heading }]}>
          Alert History
        </Text>
        <View style={styles.backBtn} />
      </View>

      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        {loading ? (
          <View style={styles.centeredState}>
            <Text style={[styles.stateText, { color: colors.textTertiary, fontFamily: FontFamily.body }]}>
              Loading…
            </Text>
          </View>
        ) : error ? (
          <View style={styles.centeredState}>
            <Text style={[styles.stateText, { color: colors.danger, fontFamily: FontFamily.body }]}>
              {error}
            </Text>
          </View>
        ) : events.length === 0 ? (
          <View style={styles.centeredState}>
            <Text style={[styles.emptyTitle, { color: colors.textSecondary, fontFamily: FontFamily.semibold }]}>
              No alerts fired yet
            </Text>
            <Text style={[styles.emptyBody, { color: colors.textTertiary, fontFamily: FontFamily.body }]}>
              Triggered alerts will appear here once your health factor crosses a threshold.
            </Text>
          </View>
        ) : (
          <FlatList
            data={events}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <EventCard event={item} />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function EventCard({ event }: { event: AlertEvent }) {
  const colors = useThemeColors();
  const date = new Date(event.sentAt);
  const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const timeStr = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  return (
    <View style={[styles.card, {
      backgroundColor: colors.surface,
      borderColor: colors.borderSubtle,
      borderLeftColor: colors.danger,
    }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.alertDot, { backgroundColor: colors.danger }]} />
        <Text style={[styles.cardMessage, { color: colors.textPrimary, fontFamily: FontFamily.semibold }]}
          numberOfLines={2}>
          {event.message}
        </Text>
      </View>
      <View style={styles.cardFooter}>
        <Text style={[styles.cardValue, { color: colors.danger, fontFamily: FontFamily.monoSemibold }]}>
          HF {event.valueAtTrigger.toFixed(2)}
        </Text>
        <Text style={[styles.cardTime, { color: colors.textTertiary, fontFamily: FontFamily.body }]}>
          {dateStr} · {timeStr}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    height: 56,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  heading: {
    fontSize: FontSize.h4,
    letterSpacing: -0.2,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  centeredState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 80,
    gap: Spacing.sm,
  },
  stateText: {
    fontSize: FontSize.bodySmall,
  },
  emptyTitle: {
    fontSize: FontSize.h4,
    letterSpacing: -0.2,
  },
  emptyBody: {
    fontSize: FontSize.bodySmall,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 260,
  },
  list: {
    gap: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  alertDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginTop: 5,
    flexShrink: 0,
  },
  cardMessage: {
    flex: 1,
    fontSize: FontSize.bodySmall,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardValue: {
    fontSize: FontSize.dataSmall,
    letterSpacing: -0.2,
  },
  cardTime: {
    fontSize: FontSize.caption,
    letterSpacing: 0.1,
  },
});
