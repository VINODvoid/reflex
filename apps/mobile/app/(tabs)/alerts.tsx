import { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { GradientBackground } from "../../components/GradientBackground";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { createAlert, deleteAlert, getAlerts } from "../../services/api";
import { useStore } from "../../store";
import { AlertRule } from "../../store/types";
import {
  FontFamily,
  FontSize,
  Spacing,
  Radius,
} from "../../design-system/tokens";
import { useThemeColors, useIsDark } from "../../hooks/useThemeColors";
import { AppHeader, HeaderIconButton } from "../../components/AppHeader";

type Protocol = AlertRule["protocol"];
type Direction = AlertRule["direction"];
type AlertType = AlertRule["alertType"];

interface TokenOption {
  label: string;
  symbol: string;
  address: string;
  chainFamily: "evm" | "solana";
}

const PROTOCOLS: Protocol[] = ["aave_v3", "compound_v3", "marginfi", "solend"];

const TOKENS: TokenOption[] = [
  { label: "ETH",  symbol: "ETH",  address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", chainFamily: "evm" },
  { label: "WBTC", symbol: "WBTC", address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", chainFamily: "evm" },
  { label: "LINK", symbol: "LINK", address: "0x514910771af9ca656af840dff83e8264ecf986ca", chainFamily: "evm" },
  { label: "UNI",  symbol: "UNI",  address: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", chainFamily: "evm" },
  { label: "SOL",  symbol: "SOL",  address: "So11111111111111111111111111111111111111112",    chainFamily: "solana" },
  { label: "USDC", symbol: "USDC", address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", chainFamily: "solana" },
  { label: "BTC",  symbol: "BTC",  address: "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E", chainFamily: "solana" },
];

const DIRECTIONS_BY_TYPE: Record<AlertType, Direction[]> = {
  health_factor: ["below", "above"],
  price_change:  ["below", "above", "change_pct"],
};

const DIRECTION_LABELS: Record<Direction, string> = {
  below:      "Below",
  above:      "Above",
  change_pct: "Change %",
};

function symbolForAddress(address: string | null): string {
  if (!address) return "";
  const token = TOKENS.find((t) => t.address.toLowerCase() === address.toLowerCase());
  return token ? token.symbol : address.slice(0, 6) + "…";
}

export default function AlertsScreen() {
  const userId = useStore((state) => state.userId);
  const isDemo = useStore((state) => state.isDemo);
  const wallets = useStore((state) => state.wallets);
  const alerts = useStore((state) => state.alerts);
  const setAlerts = useStore((state) => state.setAlerts);
  const addAlert = useStore((state) => state.addAlert);
  const removeAlert = useStore((state) => state.removeAlert);

  const colors = useThemeColors();
  const isDark = useIsDark();

  const [creating, setCreating] = useState(false);
  const [selectedWalletIdx, setSelectedWalletIdx] = useState(0);
  const [alertType, setAlertType] = useState<AlertType>("health_factor");
  const [protocol, setProtocol] = useState<Protocol>("aave_v3");
  const [selectedTokenIdx, setSelectedTokenIdx] = useState(0);
  const [direction, setDirection] = useState<Direction>("below");
  const [threshold, setThreshold] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || isDemo) return;
    getAlerts(userId)
      .then(setAlerts)
      .catch((e) => console.error("fetch alerts:", e));
  }, [userId, isDemo]);

  function handleAlertTypeChange(type: AlertType) {
    setAlertType(type);
    setDirection(DIRECTIONS_BY_TYPE[type][0]);
  }

  async function handleCreate() {
    if (!userId || wallets.length === 0) return;
    const t = parseFloat(threshold);
    if (isNaN(t) || t <= 0) {
      setFormError("Enter a valid threshold greater than 0.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const walletIdx = Math.min(selectedWalletIdx, wallets.length - 1);
      const wallet = wallets[walletIdx];

      let ruleProtocol: Protocol = protocol;
      let tokenAddress: string | null = null;

      if (alertType === "price_change") {
        const token = TOKENS[selectedTokenIdx];
        tokenAddress = token.address;
        ruleProtocol = token.chainFamily === "solana" ? "marginfi" : "aave_v3";
      }

      const rule = await createAlert(
        userId, wallet.id, ruleProtocol, alertType, t, direction,
        null, tokenAddress,
      );
      addAlert(rule);
      resetForm();
    } catch {
      setFormError("Failed to create alert. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(alertId: string) {
    if (!userId) return;
    try {
      await deleteAlert(alertId, userId);
      removeAlert(alertId);
    } catch (e) {
      console.error("delete alert:", e);
    }
  }

  function resetForm() {
    setCreating(false);
    setFormError(null);
    setThreshold("");
    setAlertType("health_factor");
    setProtocol("aave_v3");
    setSelectedTokenIdx(0);
    setDirection("below");
    setSelectedWalletIdx(0);
  }

  function thresholdLabel(): string {
    if (alertType === "price_change") {
      return direction === "change_pct" ? "Change Threshold (%)" : "Price (USD)";
    }
    return "Health Factor Threshold";
  }

  function thresholdPlaceholder(): string {
    if (alertType === "price_change") {
      return direction === "change_pct" ? "e.g. 5" : "e.g. 2000";
    }
    return "e.g. 1.5";
  }

  return (
    <GradientBackground edges={["top"]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <AppHeader
        right={
          <View style={styles.headerActions}>
            <HeaderIconButton icon="history" onPress={() => router.push("/alert-history")} />
            {!creating && (
              <Pressable
                style={[styles.newBtn, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}
                onPress={() => setCreating(true)}
                hitSlop={4}
              >
                <MaterialCommunityIcons name="plus" size={14} color={colors.accent} />
                <Text style={[styles.newBtnText, { color: colors.accent, fontFamily: FontFamily.semibold }]}>
                  New
                </Text>
              </Pressable>
            )}
          </View>
        }
      />

      <View style={styles.container}>
        {/* Title row */}
        <View style={styles.titleRow}>
          <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: FontFamily.heading }]}>
            Alerts
          </Text>
          {alerts.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: colors.accentSoft }]}>
              <Text style={[styles.countText, { color: colors.accent, fontFamily: FontFamily.semibold }]}>
                {alerts.length}
              </Text>
            </View>
          )}
        </View>

        {/* Create form */}
        {creating && (
          <ScrollView showsVerticalScrollIndicator={false} style={styles.formScroll}>
            <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
              {/* Alert Type */}
              <Text style={[styles.formLabel, { color: colors.accent, fontFamily: FontFamily.semibold }]}>
                ALERT TYPE
              </Text>
              <View style={styles.chipRow}>
                {(["health_factor", "price_change"] as AlertType[]).map((type) => {
                  const active = alertType === type;
                  const label = type === "health_factor" ? "Health Factor" : "Token Price";
                  return (
                    <Pressable
                      key={type}
                      style={[styles.chip, {
                        backgroundColor: active ? colors.accent : colors.bgSecondary,
                        borderColor: active ? colors.accent : colors.border,
                      }]}
                      onPress={() => handleAlertTypeChange(type)}
                    >
                      <Text style={[styles.chipText, {
                        color: active ? "#0B0A08" : colors.textSecondary,
                        fontFamily: FontFamily.semibold,
                      }]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Wallet */}
              <Text style={[styles.formLabel, { color: colors.accent, fontFamily: FontFamily.semibold }]}>
                WALLET
              </Text>
              {wallets.length === 0 ? (
                <Text style={[styles.hint, { color: colors.textTertiary, fontFamily: FontFamily.body }]}>
                  Add a wallet first.
                </Text>
              ) : (
                <View style={styles.chipRow}>
                  {wallets.map((w, i) => {
                    const active = selectedWalletIdx === i;
                    return (
                      <Pressable
                        key={w.id}
                        style={[styles.chip, {
                          backgroundColor: active ? colors.accent : colors.bgSecondary,
                          borderColor: active ? colors.accent : colors.border,
                        }]}
                        onPress={() => setSelectedWalletIdx(i)}
                      >
                        <Text style={[styles.chipText, {
                          color: active ? "#0B0A08" : colors.textSecondary,
                          fontFamily: FontFamily.semibold,
                        }]} numberOfLines={1}>
                          {w.label || `${w.address.slice(0, 6)}…${w.address.slice(-4)}`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Protocol (health_factor) or Token (price_change) */}
              {alertType === "health_factor" ? (
                <>
                  <Text style={[styles.formLabel, { color: colors.accent, fontFamily: FontFamily.semibold }]}>
                    PROTOCOL
                  </Text>
                  <View style={styles.chipRow}>
                    {PROTOCOLS.map((p) => {
                      const active = protocol === p;
                      return (
                        <Pressable
                          key={p}
                          style={[styles.chip, {
                            backgroundColor: active ? colors.accent : colors.bgSecondary,
                            borderColor: active ? colors.accent : colors.border,
                          }]}
                          onPress={() => setProtocol(p)}
                        >
                          <Text style={[styles.chipText, {
                            color: active ? "#0B0A08" : colors.textSecondary,
                            fontFamily: FontFamily.semibold,
                          }]}>
                            {p.toUpperCase()}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.formLabel, { color: colors.accent, fontFamily: FontFamily.semibold }]}>
                    TOKEN
                  </Text>
                  <View style={styles.chipRow}>
                    {TOKENS.map((token, i) => {
                      const active = selectedTokenIdx === i;
                      return (
                        <Pressable
                          key={token.address}
                          style={[styles.chip, {
                            backgroundColor: active ? colors.accent : colors.bgSecondary,
                            borderColor: active ? colors.accent : colors.border,
                          }]}
                          onPress={() => setSelectedTokenIdx(i)}
                        >
                          <Text style={[styles.chipText, {
                            color: active ? "#0B0A08" : colors.textSecondary,
                            fontFamily: FontFamily.semibold,
                          }]}>
                            {token.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}

              {/* Direction */}
              <Text style={[styles.formLabel, { color: colors.accent, fontFamily: FontFamily.semibold }]}>
                DIRECTION
              </Text>
              <View style={styles.chipRow}>
                {DIRECTIONS_BY_TYPE[alertType].map((d) => {
                  const active = direction === d;
                  return (
                    <Pressable
                      key={d}
                      style={[styles.chip, {
                        backgroundColor: active ? colors.accent : colors.bgSecondary,
                        borderColor: active ? colors.accent : colors.border,
                      }]}
                      onPress={() => setDirection(d)}
                    >
                      <Text style={[styles.chipText, {
                        color: active ? "#0B0A08" : colors.textSecondary,
                        fontFamily: FontFamily.semibold,
                      }]}>
                        {DIRECTION_LABELS[d]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Threshold */}
              <Text style={[styles.formLabel, { color: colors.accent, fontFamily: FontFamily.semibold }]}>
                {thresholdLabel().toUpperCase()}
              </Text>
              <TextInput
                style={[styles.input, {
                  backgroundColor: colors.bgSecondary,
                  borderColor: colors.border,
                  color: colors.textPrimary,
                  fontFamily: FontFamily.mono,
                }]}
                value={threshold}
                onChangeText={setThreshold}
                placeholder={thresholdPlaceholder()}
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
              />

              {formError && (
                <Text style={[styles.error, { color: colors.danger, fontFamily: FontFamily.body }]}>
                  {formError}
                </Text>
              )}

              <View style={styles.formActions}>
                <Pressable
                  style={[styles.cancelBtn, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}
                  onPress={resetForm}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.textSecondary, fontFamily: FontFamily.semibold }]}>
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.submitBtn, {
                    backgroundColor: colors.accent,
                    opacity: (submitting || wallets.length === 0) ? 0.5 : 1,
                  }]}
                  onPress={handleCreate}
                  disabled={submitting || wallets.length === 0}
                >
                  <Text style={[styles.submitBtnText, { fontFamily: FontFamily.semibold }]}>
                    {submitting ? "Saving…" : "Save Alert"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        )}

        {/* Alert list / empty state */}
        {alerts.length === 0 && !creating ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
              <MaterialCommunityIcons name="bell-outline" size={32} color={colors.textTertiary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textSecondary, fontFamily: FontFamily.semibold }]}>
              No alerts yet
            </Text>
            <Text style={[styles.emptyBody, { color: colors.textTertiary, fontFamily: FontFamily.body }]}>
              Create an alert to get notified before your health factor hits a critical level.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.emptyBtn,
                { backgroundColor: colors.accentSoft, borderColor: colors.accent, opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={() => setCreating(true)}
            >
              <MaterialCommunityIcons name="plus" size={14} color={colors.accent} />
              <Text style={[styles.emptyBtnText, { color: colors.accent, fontFamily: FontFamily.semibold }]}>
                Create Alert
              </Text>
            </Pressable>
          </View>
        ) : !creating ? (
          <FlatList
            data={alerts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <AlertRuleCard rule={item} onDelete={() => handleDelete(item.id)} />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
          />
        ) : null}
      </View>
    </GradientBackground>
  );
}

// ── Alert rule card ───────────────────────────────────────────────────────────

function AlertRuleCard({ rule, onDelete }: { rule: AlertRule; onDelete: () => void }) {
  const colors = useThemeColors();
  const isPrice = rule.alertType === "price_change";
  const accentColor = isPrice ? colors.accent : colors.warning;

  function cardDetail(): React.ReactNode {
    if (rule.alertType === "price_change") {
      const symbol = symbolForAddress(rule.tokenAddress);
      if (rule.direction === "change_pct") {
        return (
          <Text style={[styles.cardDetail, { color: colors.textSecondary, fontFamily: FontFamily.body }]}>
            Alert on{" "}
            <Text style={[styles.cardHighlight, { color: colors.accent, fontFamily: FontFamily.monoSemibold }]}>
              {rule.threshold}%
            </Text>
            {" "}price change for{" "}
            <Text style={[styles.cardHighlight, { color: colors.textPrimary, fontFamily: FontFamily.semibold }]}>
              {symbol}
            </Text>
          </Text>
        );
      }
      return (
        <Text style={[styles.cardDetail, { color: colors.textSecondary, fontFamily: FontFamily.body }]}>
          Alert when{" "}
          <Text style={[styles.cardHighlight, { color: colors.textPrimary, fontFamily: FontFamily.semibold }]}>
            {symbol}
          </Text>{" "}
          is{" "}
          <Text style={[styles.cardHighlight, { color: colors.textPrimary, fontFamily: FontFamily.semibold }]}>
            {rule.direction}
          </Text>{" "}
          <Text style={[styles.cardHighlight, { color: colors.accent, fontFamily: FontFamily.monoSemibold }]}>
            ${rule.threshold}
          </Text>
        </Text>
      );
    }
    return (
      <Text style={[styles.cardDetail, { color: colors.textSecondary, fontFamily: FontFamily.body }]}>
        Alert when HF is{" "}
        <Text style={[styles.cardHighlight, { color: colors.textPrimary, fontFamily: FontFamily.semibold }]}>
          {rule.direction}
        </Text>{" "}
        <Text style={[styles.cardHighlight, { color: colors.warning, fontFamily: FontFamily.monoSemibold }]}>
          {rule.threshold}
        </Text>
      </Text>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
      {/* Left accent line — gold for price, amber for HF */}
      <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTypeLabel, { color: accentColor, fontFamily: FontFamily.semibold }]}>
            {isPrice ? "TOKEN PRICE" : "HEALTH FACTOR"}
          </Text>
          <Pressable
            onPress={onDelete}
            hitSlop={8}
            style={({ pressed }) => [
              styles.deleteBtn,
              { backgroundColor: colors.dangerSoft, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={14} color={colors.danger} />
          </Pressable>
        </View>
        {cardDetail()}
        {rule.chainId != null && rule.chainId !== 0 && (
          <Text style={[styles.cardMeta, { color: colors.textTertiary, fontFamily: FontFamily.body }]}>
            Chain {rule.chainId}
          </Text>
        )}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fill: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  // Header
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sharp,
    borderWidth: 1,
  },
  newBtnText: {
    fontSize: FontSize.label,
  },
  // Title row
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
  // Empty state
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
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radius.card,
    borderWidth: 1,
    marginTop: Spacing.xs,
  },
  emptyBtnText: {
    fontSize: FontSize.bodySmall,
  },
  // List
  list: {
    gap: Spacing.sm,
    paddingBottom: 108,
  },
  // Form
  formScroll: {
    flex: 1,
  },
  form: {
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  formLabel: {
    fontSize: FontSize.label,
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.sharp,
    borderWidth: 1,
  },
  chipText: {
    fontSize: FontSize.label,
  },
  input: {
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: FontSize.bodySmall,
    borderWidth: 1,
  },
  hint: {
    fontSize: FontSize.bodySmall,
  },
  error: {
    fontSize: FontSize.bodySmall,
    marginTop: Spacing.sm,
  },
  formActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.card,
    alignItems: "center",
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: FontSize.bodySmall,
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.card,
    alignItems: "center",
  },
  submitBtnText: {
    color: "#0B0A08",
    fontSize: FontSize.bodySmall,
  },
  // Alert card
  card: {
    flexDirection: "row",
    borderRadius: Radius.card,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  cardAccent: {
    width: 3,
  },
  cardContent: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardTypeLabel: {
    fontSize: FontSize.caption,
    letterSpacing: 0.8,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: Radius.sharp,
    alignItems: "center",
    justifyContent: "center",
  },
  cardDetail: {
    fontSize: FontSize.bodySmall,
    lineHeight: 20,
  },
  cardHighlight: {},
  cardMeta: {
    fontSize: FontSize.caption,
    marginTop: 2,
  },
});
