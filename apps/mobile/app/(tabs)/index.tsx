import { useEffect } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { getPositions } from "../../services/api";
import { useStore } from "../../store";
import { Position } from "../../store/types";

export default function Dashboard() {
  const wallets = useStore((state) => state.wallets);
  const positions = useStore((state) => state.positions);
  const setPositions = useStore((state) => state.setPositions);

  useEffect(() => {
    if (wallets.length === 0) return;

    Promise.all(wallets.map((w) => getPositions(w.id)))
      .then((results) => setPositions(results.flat()))
      .catch((e) => console.error("fetch positions:", e));
  }, [wallets]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Positions</Text>
      {positions.length === 0 ? (
        <Text style={styles.empty}>No active positions.</Text>
      ) : (
        <FlatList
          data={positions}
          keyExtractor={(item, index) => `${item.walletId}-${item.protocol}-${index}`}
          renderItem={({ item }) => <PositionCard position={item} />}
        />
      )}
    </View>
  );
}

function PositionCard({ position }: { position: Position }) {
  const hf = position.healthFactor.toFixed(2);
  const isAtRisk = position.healthFactor < 1.2;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.protocol}>{position.protocol.toUpperCase()}</Text>
        <Text style={[styles.hf, isAtRisk ? styles.hfDanger : styles.hfSafe]}>
          HF {hf}
        </Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.label}>Collateral</Text>
        <Text style={styles.value}>${position.collateralUsd.toLocaleString()}</Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.label}>Debt</Text>
        <Text style={styles.value}>${position.debtUsd.toLocaleString()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#0f0f0f",
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 16,
  },
  empty: {
    color: "#888888",
    fontSize: 14,
  },
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  protocol: {
    fontSize: 14,
    fontWeight: "600",
    color: "#cccccc",
    letterSpacing: 0.5,
  },
  hf: {
    fontSize: 14,
    fontWeight: "700",
  },
  hfSafe: {
    color: "#4ade80",
  },
  hfDanger: {
    color: "#f87171",
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  label: {
    fontSize: 13,
    color: "#888888",
  },
  value: {
    fontSize: 13,
    color: "#ffffff",
  },
});
