import { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { createAlert, deleteAlert, getAlerts } from "../../services/api";
import { useStore } from "../../store";
import { AlertRule } from "../../store/types";

type Protocol = AlertRule["protocol"];
type Direction = AlertRule["direction"];

const PROTOCOLS: Protocol[] = ["aave_v3", "compound_v3", "marginfi", "solend"];
const DIRECTIONS: Direction[] = ["below", "above"];

export default function AlertsScreen() {
  const userId = useStore((state) => state.userId);
  const wallets = useStore((state) => state.wallets);
  const alerts = useStore((state) => state.alerts);
  const setAlerts = useStore((state) => state.setAlerts);
  const addAlert = useStore((state) => state.addAlert);
  const removeAlert = useStore((state) => state.removeAlert);

  const [creating, setCreating] = useState(false);
  const [selectedWalletIdx, setSelectedWalletIdx] = useState(0);
  const [protocol, setProtocol] = useState<Protocol>("aave_v3");
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
      // Clamp in case wallets changed while the form was open.
      const walletIdx = Math.min(selectedWalletIdx, wallets.length - 1);
      const wallet = wallets[walletIdx];
      const rule = await createAlert(
        userId,
        wallet.id,
        protocol,
        "health_factor",
        t,
        direction,
      );
      addAlert(rule);
      setCreating(false);
      setThreshold("");
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Alerts</Text>
        {!creating && (
          <Pressable style={styles.addButton} onPress={() => setCreating(true)}>
            <Text style={styles.addButtonText}>+ New</Text>
          </Pressable>
        )}
      </View>

      {creating && (
        <View style={styles.form}>
          <Text style={styles.formLabel}>Wallet</Text>
          {wallets.length === 0 ? (
            <Text style={styles.hint}>Add a wallet first.</Text>
          ) : (
            <View style={styles.chipRow}>
              {wallets.map((w, i) => (
                <Pressable
                  key={w.id}
                  style={[styles.chip, selectedWalletIdx === i && styles.chipActive]}
                  onPress={() => setSelectedWalletIdx(i)}
                >
                  <Text
                    style={[styles.chipText, selectedWalletIdx === i && styles.chipTextActive]}
                    numberOfLines={1}
                  >
                    {w.label || `${w.address.slice(0, 6)}…${w.address.slice(-4)}`}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <Text style={styles.formLabel}>Protocol</Text>
          <View style={styles.chipRow}>
            {PROTOCOLS.map((p) => (
              <Pressable
                key={p}
                style={[styles.chip, protocol === p && styles.chipActive]}
                onPress={() => setProtocol(p)}
              >
                <Text style={[styles.chipText, protocol === p && styles.chipTextActive]}>
                  {p.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.formLabel}>Direction</Text>
          <View style={styles.chipRow}>
            {DIRECTIONS.map((d) => (
              <Pressable
                key={d}
                style={[styles.chip, direction === d && styles.chipActive]}
                onPress={() => setDirection(d)}
              >
                <Text style={[styles.chipText, direction === d && styles.chipTextActive]}>
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.formLabel}>Health Factor Threshold</Text>
          <TextInput
            style={styles.input}
            value={threshold}
            onChangeText={setThreshold}
            placeholder="e.g. 1.5"
            placeholderTextColor="#666666"
            keyboardType="decimal-pad"
          />

          {formError && <Text style={styles.error}>{formError}</Text>}

          <View style={styles.formActions}>
            <Pressable
              style={styles.cancelButton}
              onPress={() => {
                setCreating(false);
                setFormError(null);
                setThreshold("");
                setProtocol("aave_v3");
                setDirection("below");
                setSelectedWalletIdx(0);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.submitButton, (submitting || wallets.length === 0) && styles.submitButtonDisabled]}
              onPress={handleCreate}
              disabled={submitting || wallets.length === 0}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? "Saving..." : "Save Alert"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {alerts.length === 0 && !creating ? (
        <Text style={styles.empty}>No alerts set up yet.</Text>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <AlertRuleCard rule={item} onDelete={() => handleDelete(item.id)} />
          )}
        />
      )}
    </View>
  );
}

function AlertRuleCard({
  rule,
  onDelete,
}: {
  rule: AlertRule;
  onDelete: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardProtocol}>{rule.protocol.toUpperCase()}</Text>
        <Pressable onPress={onDelete} style={styles.deleteButton}>
          <Text style={styles.deleteButtonText}>Delete</Text>
        </Pressable>
      </View>
      <Text style={styles.cardDetail}>
        Alert when HF is{" "}
        <Text style={styles.cardHighlight}>{rule.direction}</Text>{" "}
        <Text style={styles.cardHighlight}>{rule.threshold}</Text>
      </Text>
      {rule.chainId != null && (
        <Text style={styles.cardMeta}>Chain {rule.chainId}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#0f0f0f",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffff",
  },
  addButton: {
    backgroundColor: "#4F46E5",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14,
  },
  empty: {
    color: "#888888",
    fontSize: 14,
  },
  form: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  formLabel: {
    color: "#888888",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#2a2a2a",
    borderWidth: 1,
    borderColor: "#333333",
  },
  chipActive: {
    backgroundColor: "#4F46E5",
    borderColor: "#4F46E5",
  },
  chipText: {
    color: "#aaaaaa",
    fontSize: 12,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#ffffff",
  },
  input: {
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    padding: 12,
    color: "#ffffff",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#333333",
  },
  hint: {
    color: "#666666",
    fontSize: 13,
  },
  error: {
    color: "#f87171",
    fontSize: 13,
    marginTop: 8,
  },
  formActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#2a2a2a",
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#aaaaaa",
    fontWeight: "600",
    fontSize: 14,
  },
  submitButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#4F46E5",
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14,
  },
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardProtocol: {
    fontSize: 13,
    fontWeight: "700",
    color: "#cccccc",
    letterSpacing: 0.5,
  },
  deleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#2a1a1a",
    borderWidth: 1,
    borderColor: "#f87171",
  },
  deleteButtonText: {
    color: "#f87171",
    fontSize: 12,
    fontWeight: "600",
  },
  cardDetail: {
    color: "#aaaaaa",
    fontSize: 14,
  },
  cardHighlight: {
    color: "#ffffff",
    fontWeight: "600",
  },
  cardMeta: {
    color: "#666666",
    fontSize: 12,
    marginTop: 4,
  },
});
