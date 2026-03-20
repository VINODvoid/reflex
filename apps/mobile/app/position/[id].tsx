import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { GradientBackground } from "../../components/GradientBackground";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useStore } from "../../store";
import { Position } from "../../store/types";
import { HealthBar } from "../../components/HealthBar";
import { useThemeColors, useIsDark } from "../../hooks/useThemeColors";
import {
  FontFamily,
  FontSize,
  Spacing,
  Radius,
  getHFColor,
} from "../../design-system/tokens";

const PROTOCOL_LABELS: Record<Position["protocol"], string> = {
  aave_v3: "Aave V3",
  compound_v3: "Compound V3",
  marginfi: "MarginFi",
  solend: "Solend",
};

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  8453: "Base",
  42161: "Arbitrum",
  137: "Polygon",
  10: "Optimism",
  0: "Solana",
};

export default function PositionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const positions = useStore((state) => state.positions);
  const colors = useThemeColors();
  const isDark = useIsDark();

  const decoded = decodeURIComponent(id ?? "");
  const parts = decoded.split("|");
  const [walletId, protocol, chainIdStr] = parts;
  const chainId = Number(chainIdStr);
  const validId = parts.length === 3 && !isNaN(chainId);

  const position = validId
    ? positions.find(
        (p) =>
          p.walletId === walletId &&
          p.protocol === protocol &&
          p.chainId === chainId,
      )
    : undefined;

  if (!position) {
    return (
      <GradientBackground>
        <StatusBar style={isDark ? "light" : "dark"} />
        <View style={styles.notFound}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <MaterialCommunityIcons name="chevron-left" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={[styles.notFoundText, { color: colors.textSecondary, fontFamily: FontFamily.body }]}>
            Position not found.
          </Text>
        </View>
      </GradientBackground>
    );
  }

  const protocolLabel = PROTOCOL_LABELS[position.protocol] ?? position.protocol;
  const chainName = CHAIN_NAMES[position.chainId] ?? `Chain ${position.chainId}`;
  const hfColor = getHFColor(position.healthFactor, colors);
  const hfDisplay = position.healthFactor >= 999 ? "∞" : position.healthFactor.toFixed(2);
  const ltvDisplay = position.ltv > 0 ? `${(position.ltv * 100).toFixed(1)}%` : "N/A";
  const liqDisplay = position.liquidationThreshold > 0
    ? `${(position.liquidationThreshold * 100).toFixed(1)}%`
    : "N/A";

  return (
    <GradientBackground>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <MaterialCommunityIcons name="chevron-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerProtocol, { color: colors.textPrimary, fontFamily: FontFamily.semibold }]}>
            {protocolLabel}
          </Text>
          <Text style={[styles.headerChain, { color: colors.textTertiary, fontFamily: FontFamily.body }]}>
            {chainName}
          </Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero — Health Factor */}
        <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          {/* Left accent line */}
          <View style={[styles.heroAccent, { backgroundColor: hfColor }]} />
          <View style={styles.heroInner}>
            <Text style={[styles.heroCaption, { color: colors.textTertiary, fontFamily: FontFamily.semibold }]}>
              HEALTH FACTOR
            </Text>
            <Text style={[styles.heroNumber, { color: hfColor, fontFamily: FontFamily.heading }]}>
              {hfDisplay}
            </Text>
            <View style={styles.heroBarWrap}>
              <HealthBar healthFactor={position.healthFactor} showLabel={false} height={6} />
            </View>
          </View>
        </View>

        {/* Stats — full-width rows */}
        <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          <StatRow
            label="COLLATERAL"
            value={`$${position.collateralUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            colors={colors}
            isLast={false}
          />
          <StatRow
            label="DEBT"
            value={`$${position.debtUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            colors={colors}
            isLast={false}
          />
          <StatRow
            label="LOAN TO VALUE"
            value={ltvDisplay}
            colors={colors}
            isLast={false}
          />
          <StatRow
            label="LIQ. THRESHOLD"
            value={liqDisplay}
            colors={colors}
            isLast={true}
          />
        </View>
      </ScrollView>
    </GradientBackground>
  );
}

interface StatRowProps {
  label: string;
  value: string;
  colors: ReturnType<typeof useThemeColors>;
  isLast: boolean;
}

function StatRow({ label, value, colors, isLast }: StatRowProps) {
  return (
    <View style={[
      styles.statRow,
      !isLast && { borderBottomColor: colors.borderSubtle, borderBottomWidth: StyleSheet.hairlineWidth },
    ]}>
      <Text style={[styles.statLabel, { color: colors.textTertiary, fontFamily: FontFamily.semibold }]}>
        {label}
      </Text>
      <Text style={[styles.statValue, { color: colors.textPrimary, fontFamily: FontFamily.monoSemibold }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    height: 56,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    alignItems: "center",
    gap: 1,
  },
  headerProtocol: {
    fontSize: FontSize.bodySmall,
    letterSpacing: 0.2,
  },
  headerChain: {
    fontSize: FontSize.caption,
    letterSpacing: 0.2,
  },

  // Content
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: 48,
  },

  // Hero card
  heroCard: {
    flexDirection: "row",
    borderRadius: Radius.card,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  heroAccent: {
    width: 4,
  },
  heroInner: {
    flex: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  heroCaption: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
  heroNumber: {
    fontSize: FontSize.h1,
    letterSpacing: -0.8,
  },
  heroBarWrap: {
    marginTop: 4,
  },

  // Stats card
  statsCard: {
    borderRadius: Radius.card,
    borderWidth: 1,
    overflow: "hidden",
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 18,
  },
  statLabel: {
    fontSize: FontSize.caption,
    letterSpacing: 0.6,
  },
  statValue: {
    fontSize: FontSize.h4,
    letterSpacing: -0.3,
  },

  // Not found
  notFound: {
    flex: 1,
    padding: Spacing.lg,
  },
  notFoundText: {
    marginTop: Spacing.xl,
    textAlign: "center",
    fontSize: FontSize.body,
  },
});
