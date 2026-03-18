import { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
  { label: "ETH",     symbol: "ETH",  address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", chainFamily: "evm" },
  { label: "WBTC",    symbol: "WBTC", address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", chainFamily: "evm" },
  { label: "LINK",    symbol: "LINK", address: "0x514910771af9ca656af840dff83e8264ecf986ca", chainFamily: "evm" },
  { label: "UNI",     symbol: "UNI",  address: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", chainFamily: "evm" },
  { label: "SOL",     symbol: "SOL",  address: "So11111111111111111111111111111111111111112",    chainFamily: "solana" },
  { label: "USDC",    symbol: "USDC", address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", chainFamily: "solana" },
  { label: "BTC",     symbol: "BTC",  address: "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E", chainFamily: "solana" },
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
  const token = TOKENS.find(
    (t) => t.address.toLowerCase() === address.toLowerCase(),
  );
  return token ? token.symbol : address.slice(0, 6) + "…";
}

export default function AlertsScreen() {
  const userId = useStore((state) => state.userId);
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
    if (!userId) return;
    getAlerts(userId)
      .then(setAlerts)
      .catch((e) => console.error("fetch alerts:", e));
  }, [userId]);

  function handleAlertTypeChange(type: AlertType) {
    setAlertType(type);
    // Reset direction to first valid option for the new type
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
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.bgPrimary }]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: FontFamily.heading }]}>
            Alerts
          </Text>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push("/alert-history")}
              hitSlop={8}
              style={[styles.historyBtn, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}
            >
              <MaterialCommunityIcons name="history" size={16} color={colors.textSecondary} />
            </Pressable>
            {!creating && (
              <Pressable
                style={[styles.addButton, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}
                onPress={() => setCreating(true)}
              >
                <Text style={[styles.addButtonText, { color: colors.accent, fontFamily: FontFamily.semibold }]}>
                  + New
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Create Form */}
        {creating && (
          <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>

            {/* Alert Type */}
            <Text style={[styles.formLabel, { color: colors.textTertiary, fontFamily: FontFamily.semibold }]}>
              Alert Type
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
                      color: active ? "#FFFFFF" : colors.textSecondary,
                      fontFamily: FontFamily.semibold,
                    }]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Wallet */}
            <Text style={[styles.formLabel, { color: colors.textTertiary, fontFamily: FontFamily.semibold }]}>
              Wallet
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
                        color: active ? "#FFFFFF" : colors.textSecondary,
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
                <Text style={[styles.formLabel, { color: colors.textTertiary, fontFamily: FontFamily.semibold }]}>
                  Protocol
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
                          color: active ? "#FFFFFF" : colors.textSecondary,
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
                <Text style={[styles.formLabel, { color: colors.textTertiary, fontFamily: FontFamily.semibold }]}>
                  Token
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
                          color: active ? "#FFFFFF" : colors.textSecondary,
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
            <Text style={[styles.formLabel, { color: colors.textTertiary, fontFamily: FontFamily.semibold }]}>
              Direction
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
                      color: active ? "#FFFFFF" : colors.textSecondary,
                      fontFamily: FontFamily.semibold,
                    }]}>
                      {DIRECTION_LABELS[d]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Threshold */}
            <Text style={[styles.formLabel, { color: colors.textTertiary, fontFamily: FontFamily.semibold }]}>
              {thresholdLabel()}
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
                style={[styles.cancelButton, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}
                onPress={resetForm}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary, fontFamily: FontFamily.semibold }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[styles.submitButton, {
                  backgroundColor: colors.accent,
                  opacity: (submitting || wallets.length === 0) ? 0.5 : 1,
                }]}
                onPress={handleCreate}
                disabled={submitting || wallets.length === 0}
              >
                <Text style={[styles.submitButtonText, { fontFamily: FontFamily.semibold }]}>
                  {submitting ? "Saving…" : "Save Alert"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* List */}
        {alerts.length === 0 && !creating ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.textSecondary, fontFamily: FontFamily.semibold }]}>
              No alerts yet
            </Text>
            <Text style={[styles.emptyBody, { color: colors.textTertiary, fontFamily: FontFamily.body }]}>
              Create an alert to get notified before your health factor hits a critical level.
            </Text>
          </View>
        ) : (
          <FlatList
            data={alerts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <AlertRuleCard rule={item} onDelete={() => handleDelete(item.id)} />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function AlertRuleCard({ rule, onDelete }: { rule: AlertRule; onDelete: () => void }) {
  const colors = useThemeColors();

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
        <Text style={[styles.cardHighlight, { color: colors.accent, fontFamily: FontFamily.monoSemibold }]}>
          {rule.threshold}
        </Text>
      </Text>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardProtocol, { color: colors.textSecondary, fontFamily: FontFamily.semibold }]}>
          {rule.alertType === "price_change" ? "PRICE" : rule.protocol.toUpperCase()}
        </Text>
        <Pressable
          onPress={onDelete}
          style={[styles.deleteButton, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}
        >
          <Text style={[styles.deleteButtonText, { color: colors.danger, fontFamily: FontFamily.semibold }]}>
            Delete
          </Text>
        </Pressable>
      </View>
      {cardDetail()}
      {rule.chainId != null && (
        <Text style={[styles.cardMeta, { color: colors.textTertiary, fontFamily: FontFamily.body }]}>
          Chain {rule.chainId}
        </Text>
      )}
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  heading: {
    fontSize: FontSize.h2,
    letterSpacing: -0.4,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  historyBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.sharp,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  addButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.sharp,
    borderWidth: 1,
  },
  addButtonText: {
    fontSize: FontSize.bodySmall,
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
  list: {
    gap: Spacing.sm,
    paddingBottom: 108,
  },
  form: {
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  formLabel: {
    fontSize: FontSize.label,
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
    textTransform: "uppercase",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.sharp,
    borderWidth: 1,
  },
  chipText: {
    fontSize: FontSize.label,
  },
  input: {
    borderRadius: Radius.card,
    padding: 12,
    fontSize: FontSize.body,
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
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: Radius.card,
    alignItems: "center",
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: FontSize.bodySmall,
  },
  submitButton: {
    flex: 1,
    padding: 12,
    borderRadius: Radius.card,
    alignItems: "center",
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: FontSize.bodySmall,
  },
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  cardProtocol: {
    fontSize: FontSize.label,
    letterSpacing: 0.8,
  },
  deleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sharp,
    borderWidth: 1,
  },
  deleteButtonText: {
    fontSize: FontSize.label,
  },
  cardDetail: {
    fontSize: FontSize.bodySmall,
    lineHeight: 20,
  },
  cardHighlight: {},
  cardMeta: {
    fontSize: FontSize.caption,
    marginTop: 4,
  },
});
