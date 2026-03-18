import { useEffect } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { getPositions } from "../../services/api";
import { useStore } from "../../store";
import { Position } from "../../store/types";
import {
  FontFamily,
  FontSize,
  Spacing,
  Radius,
  getHFBgColor,
} from "../../design-system/tokens";
import { HealthBar } from "../../components/HealthBar";
import { useThemeColors, useIsDark } from "../../hooks/useThemeColors";

export default function Dashboard() {
  const wallets = useStore((state) => state.wallets);
  const positions = useStore((state) => state.positions);
  const setPositions = useStore((state) => state.setPositions);
  const colors = useThemeColors();
  const isDark = useIsDark();

  useEffect(() => {
    if (wallets.length === 0) return;
    Promise.all(wallets.map((w) => getPositions(w.id)))
      .then((results) => setPositions(results.flat()))
      .catch((e) => console.error("fetch positions:", e));
  }, [wallets]);

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.bgPrimary }]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: FontFamily.heading }]}>
          Positions
        </Text>
        {positions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.textSecondary, fontFamily: FontFamily.semibold }]}>
              No active positions
            </Text>
            <Text style={[styles.emptyBody, { color: colors.textTertiary, fontFamily: FontFamily.body }]}>
              Add a wallet to start monitoring your DeFi positions.
            </Text>
          </View>
        ) : (
          <FlatList
            data={positions}
            keyExtractor={(item) => `${item.walletId}-${item.protocol}-${item.chainId}`}
            renderItem={({ item }) => <PositionCard position={item} />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function PositionCard({ position }: { position: Position }) {
  const colors = useThemeColors();
  const hfBg = getHFBgColor(position.healthFactor, colors);

  return (
    <View style={[styles.card, {
      backgroundColor: colors.surface,
      borderColor: colors.borderSubtle,
    }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.protocol, { color: colors.textSecondary, fontFamily: FontFamily.semibold }]}>
          {position.protocol.toUpperCase()}
        </Text>
        <View style={[styles.hfBadge, { backgroundColor: hfBg }]}>
          <HealthBar healthFactor={position.healthFactor} showLabel={true} height={4} />
        </View>
      </View>
      <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
      <View style={styles.cardRow}>
        <Text style={[styles.rowLabel, { color: colors.textTertiary, fontFamily: FontFamily.semibold }]}>
          COLLATERAL
        </Text>
        <Text style={[styles.rowValue, { color: colors.textPrimary, fontFamily: FontFamily.monoSemibold }]}>
          ${position.collateralUsd.toLocaleString()}
        </Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={[styles.rowLabel, { color: colors.textTertiary, fontFamily: FontFamily.semibold }]}>
          DEBT
        </Text>
        <Text style={[styles.rowValue, { color: colors.textPrimary, fontFamily: FontFamily.monoSemibold }]}>
          ${position.debtUsd.toLocaleString()}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  heading: {
    fontSize: FontSize.h2,
    letterSpacing: -0.4,
    marginBottom: Spacing.md,
  },
  list: {
    gap: Spacing.sm,
    paddingBottom: 108,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 80,
    gap: Spacing.sm,
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
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: Spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  protocol: {
    fontSize: FontSize.label,
    letterSpacing: 0.8,
  },
  hfBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sharp,
    minWidth: 100,
  },
  divider: {
    height: 1,
    marginBottom: Spacing.sm,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  rowLabel: {
    fontSize: FontSize.caption,
    letterSpacing: 0.5,
  },
  rowValue: {
    fontSize: FontSize.dataSmall,
    letterSpacing: -0.2,
  },
});
