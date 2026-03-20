import { StyleSheet } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useIsDark } from "../hooks/useThemeColors";
import { Gradients } from "../design-system/tokens";

interface GradientBackgroundProps {
  children: React.ReactNode;
  edges?: Edge[];
}

/**
 * Drop-in replacement for SafeAreaView on screen roots.
 * Applies a premium gradient background (warm champagne light / deep noir dark).
 * SafeAreaView backgroundColor is set to the top gradient stop so the notch
 * area matches seamlessly.
 */
export function GradientBackground({ children, edges }: GradientBackgroundProps) {
  const isDark = useIsDark();
  const grad = isDark ? Gradients.dark.page : Gradients.light.page;

  return (
    <SafeAreaView
      style={[styles.fill, { backgroundColor: grad[0] }]}
      edges={edges}
    >
      <LinearGradient colors={grad as [string, string, ...string[]]} style={styles.fill}>
        {children}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
