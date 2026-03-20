import { useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { LayoutChangeEvent } from "react-native";
import { GradientBackground } from "../../components/GradientBackground";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getPositions } from "../../services/api";
import { AppHeader } from "../../components/AppHeader";
import { useStore } from "../../store";
import { Position } from "../../store/types";
import {
  FontFamily,
  FontSize,
  Spacing,
  Radius,
  getHFColor,
} from "../../design-system/tokens";
import { useThemeColors, useIsDark } from "../../hooks/useThemeColors";

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  8453: "Base",
  42161: "Arbitrum",
  137: "Polygon",
  10: "Optimism",
  0: "Solana",
};

export default function Dashboard() {
  const wallets = useStore((state) => state.wallets);
  const positions = useStore((state) => state.positions);
  const setPositions = useStore((state) => state.setPositions);
  const isDemo = useStore((state) => state.isDemo);
  const highlightedPositionKey = useStore((state) => state.highlightedPositionKey);
  const setHighlightedPositionKey = useStore((state) => state.setHighlightedPositionKey);
  const colors = useThemeColors();
  const isDark = useIsDark();

  const scrollRef = useRef<ScrollView>(null);
  const offsetsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (wallets.length === 0 || isDemo) return;
    Promise.all(wallets.map((w) => getPositions(w.id)))
      .then((results) => setPositions(results.flat()))
      .catch((e) => console.error("fetch positions:", e));
  }, [wallets, isDemo]);

  useEffect(() => {
    if (!highlightedPositionKey) return;
    const y = offsetsRef.current[highlightedPositionKey];
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y, animated: true });
    }
    const timer = setTimeout(() => setHighlightedPositionKey(null), 3000);
    return () => clearTimeout(timer);
  }, [highlightedPositionKey]);

  function handleCardMeasure(key: string, y: number): void {
    offsetsRef.current[key] = y;
  }

  return (
    <GradientBackground edges={["top"]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <AppHeader />
      <View style={styles.container}>
        <View style={styles.titleRow}>
          <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: FontFamily.heading }]}>
            Positions
          </Text>
          {positions.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: colors.accentSoft }]}>
              <Text style={[styles.countText, { color: colors.accent, fontFamily: FontFamily.semibold }]}>
                {positions.length}
              </Text>
            </View>
          )}
        </View>

        {positions.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
              <MaterialCommunityIcons name="view-dashboard-outline" size={32} color={colors.textTertiary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textSecondary, fontFamily: FontFamily.semibold }]}>
              No active positions
            </Text>
            <Text style={[styles.emptyBody, { color: colors.textTertiary, fontFamily: FontFamily.body }]}>
              Add a wallet to start monitoring your DeFi positions.
            </Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
          >
            {positions.map((item) => {
              const positionKey = `${item.walletId}-${item.protocol}-${item.chainId}`;
              const detailId = encodeURIComponent(`${item.walletId}|${item.protocol}|${item.chainId}`);
              return (
                <PositionCard
                  key={positionKey}
                  position={item}
                  isHighlighted={positionKey === highlightedPositionKey}
                  onMeasure={(y) => handleCardMeasure(positionKey, y)}
                  onPress={() => router.push(`/position/${detailId}`)}
                />
              );
            })}
          </ScrollView>
        )}
      </View>
    </GradientBackground>
  );
}

interface PositionCardProps {
  position: Position;
  isHighlighted: boolean;
  onMeasure: (y: number) => void;
  onPress: () => void;
}

function PositionCard({ position, isHighlighted, onMeasure, onPress }: PositionCardProps) {
  const colors = useThemeColors();
  const hfColor = getHFColor(position.healthFactor, colors);
  const hfDisplay = position.healthFactor >= 999 ? "∞" : position.healthFactor.toFixed(2);
  const chainName = CHAIN_NAMES[position.chainId] ?? `Chain ${position.chainId}`;

  function handleLayout(event: LayoutChangeEvent): void {
    onMeasure(event.nativeEvent.layout.y);
  }

  return (
    <Pressable
      onLayout={handleLayout}
      onPress={onPress}
      android_ripple={{ color: colors.accentSoft }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: isHighlighted ? colors.accent : colors.borderSubtle,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
      accessibilityRole="button"
    >
      {/* Left semantic line — green/amber/red based on HF */}
      <View style={[styles.accentBar, { backgroundColor: hfColor }]} />

      <View style={styles.cardInner}>
        {/* Protocol · Chain */}
        <View style={styles.cardMeta}>
          <Text style={[styles.metaProtocol, { color: colors.textTertiary, fontFamily: FontFamily.semibold }]}>
            {position.protocol.toUpperCase()}
          </Text>
          <Text style={[styles.metaSep, { color: colors.borderSubtle }]}> · </Text>
          <Text style={[styles.metaChain, { color: colors.textTertiary, fontFamily: FontFamily.body }]}>
            {chainName}
          </Text>
        </View>

        {/* Health Factor — the hero number */}
        <View style={styles.hfRow}>
          <View>
            <Text style={[styles.hfCaption, { color: colors.textTertiary, fontFamily: FontFamily.semibold }]}>
              HEALTH FACTOR
            </Text>
            <Text style={[styles.hfNumber, { color: hfColor, fontFamily: FontFamily.heading }]}>
              {hfDisplay}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={16} color={colors.borderSubtle} />
        </View>

        {/* Divider */}
        <View style={[styles.rowDivider, { backgroundColor: colors.borderSubtle }]} />

        {/* Collateral / Debt */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statCaption, { color: colors.textTertiary, fontFamily: FontFamily.semibold }]}>
              COLLATERAL
            </Text>
            <Text style={[styles.statValue, { color: colors.textPrimary, fontFamily: FontFamily.monoSemibold }]}>
              ${position.collateralUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </Text>
          </View>
          <View style={[styles.statSep, { backgroundColor: colors.borderSubtle }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statCaption, { color: colors.textTertiary, fontFamily: FontFamily.semibold }]}>
              DEBT
            </Text>
            <Text style={[styles.statValue, { color: colors.textPrimary, fontFamily: FontFamily.monoSemibold }]}>
              ${position.debtUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  heading: {
    fontSize: FontSize.h2,
    letterSpacing: -0.4,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.sharp,
  },
  countText: {
    fontSize: FontSize.caption,
    letterSpacing: 0.3,
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
    gap: Spacing.md,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: Radius.card,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
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
  // Card
  card: {
    flexDirection: "row",
    borderRadius: Radius.card,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  accentBar: {
    width: 3,
  },
  cardInner: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaProtocol: {
    fontSize: FontSize.caption,
    letterSpacing: 0.8,
  },
  metaSep: {
    fontSize: FontSize.caption,
  },
  metaChain: {
    fontSize: FontSize.caption,
  },
  hfRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  hfCaption: {
    fontSize: 10,
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  hfNumber: {
    fontSize: FontSize.h2,
    letterSpacing: -0.5,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    gap: 2,
  },
  statSep: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginHorizontal: Spacing.md,
  },
  statCaption: {
    fontSize: 9,
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: FontSize.dataSmall,
    letterSpacing: -0.2,
  },
});
