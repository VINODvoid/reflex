import { useState } from "react";
import { Text, TextInput, View, Pressable } from "react-native";
import { useStore } from "../../store";
import { createWallet } from "../../services/api";

export default function ConnectWallet() {
  const [wallet, setWallet] = useState<string>("");
  const [chainFamily, setChainFamily] = useState<"evm" | "solana">("evm");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = useStore((state) => state.userId);
  const addWallet = useStore((state) => state.addWallet);

  return (
    <View>
      <Text>connect the wallet</Text>
      <View>
        <Pressable onPress={() => setChainFamily("solana")}>
          <Text>Solana</Text>
        </Pressable>
        <Pressable onPress={() => setChainFamily("evm")}>
          <Text>ethereum</Text>
        </Pressable>
      </View>
      <TextInput
        value={wallet}
        placeholder="wallet address"
        onChangeText={setWallet}
      />
      {error && <Text>{error}</Text>}
      <Pressable
        onPress={async () => {
          if (!userId) {
            setError("Registration not complete. Please restart the app.");
            return;
          }
          if (!wallet.trim()) return;
          setLoading(true);
          setError(null);
          try {
            const created = await createWallet(
              userId,
              wallet.trim(),
              chainFamily,
            );
            addWallet(created);
            setWallet("");
          } catch (e) {
            setError("Failed to add wallet");
          } finally {
            setLoading(false);
          }
        }}
      >
        <Text>{loading ? "Adding..." : "Add"}</Text>
      </Pressable>
    </View>
  );
}
