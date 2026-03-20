# Implementation Plan: Phase 6 Remaining Features

## Overview

Three independent workstreams to complete the REFLEX app: (1) a position detail
screen reachable by tapping any PositionCard on the dashboard, showing the full
account data breakdown; (2) extending the Aave V3 fetcher to cover Polygon and
Optimism alongside the existing three chains; (3) App Store and Play Store
submission prep — EAS build config, eas.json, app.json metadata, and placeholder
privacy policy URL.

## Assumptions

- The position detail screen shows only data already returned by `GET /positions/{walletId}`: health factor, collateral USD, debt USD, protocol, chain name, LTV, and liquidation threshold. The backend `protocols.Position` struct must be extended to include LTV and liquidation threshold since these are already unpacked from the Aave contract call but currently discarded. Compound, MarginFi, and Solend return zeroes for LTV/liqThreshold where the protocol does not expose them — this is acceptable for MVP and displayed as "N/A".
- Navigation uses Expo Router's dynamic segment `app/position/[id].tsx`. The `id` encodes `walletId|protocol|chainId` joined with `|` and URI-encoded, matching the existing `positionKey` pattern in the dashboard.
- No new API endpoint is needed for position detail — the data is already in the Zustand positions store; the detail screen reads from there.
- For multi-chain Aave: Polygon chain ID is 137, Optimism is 10. Alchemy supports both. The fallback LlamaNodes public URLs for these chains are `https://polygon.llamarpc.com` and `https://optimism.llamarpc.com`.
- EAS build config targets `preview` (internal APK/IPA) and `production` profiles. No auto-submit configured — submission will be done manually via EAS CLI.
- Privacy policy URL placeholder: `https://reflexapp.io/privacy` — a real URL must be substituted before actual store submission.
- The `Position` type in `store/types.ts` and the backend `protocols.Position` struct must be kept in sync.

## Architecture Changes

- `services/monitor/internal/protocols/types.go`: Add `LTV float64` and `LiquidationThreshold float64` fields to `Position`.
- `services/monitor/internal/protocols/aave/client.go`: Populate `LTV` and `LiquidationThreshold` from unpacked contract data. Add Polygon (137) and Optimism (10) to `poolAddresses`.
- `services/monitor/cmd/server/main.go`: Add chain 137 and 10 to `evmRPCURLs` map (both Alchemy and LlamaNodes fallback branches).
- `apps/mobile/store/types.ts`: Add `ltv: number` and `liquidationThreshold: number` to `Position` interface.
- `apps/mobile/app/position/[id].tsx`: New file — position detail screen.
- `apps/mobile/app/(tabs)/index.tsx`: Wrap `PositionCard` in `Pressable` that navigates to `/position/[id]`.
- `apps/mobile/app.json`: Add `privacyPolicyUrl`, `android.googleServicesFile`, iOS bundle identifier, build number, version metadata.
- `apps/mobile/eas.json`: New file — EAS build profiles for preview and production.

---

## Implementation Steps

### Phase 1: Backend data model — exposes LTV and liqThreshold, adds Polygon + Optimism

1. **Extend `Position` struct with LTV and liquidation threshold** (`services/monitor/internal/protocols/types.go`)
   - Action: Add two fields after `DebtUSD`:
     ```go
     LTV                  float64 `json:"ltv"`
     LiquidationThreshold float64 `json:"liquidationThreshold"`
     ```
   - Why: These fields are already returned by `getUserAccountData` on all Aave V3 chains but are discarded. Adding them here makes them serialized to JSON and available to the mobile client with no extra RPC calls.
   - Depends on: None
   - Risk: Low — additive change. Existing Compound, MarginFi, Solend clients return the zero value, which the mobile UI will display as "N/A".

2. **Populate LTV and liqThreshold in Aave client; add Polygon and Optimism** (`services/monitor/internal/protocols/aave/client.go`)
   - Action:
     - In `poolAddresses`, add:
       ```go
       137: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Polygon
       10:  "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Optimism
       ```
       Note: The Aave V3 Pool address is the same across all chains (the canonical Aave V3 deployment uses the same deterministic address). Verify at https://docs.aave.com/developers/deployed-contracts/v3-mainnet/ before implementing — if the addresses differ use the actual values.
     - In `fetchChain`, after computing `debtUSD`, unpack the remaining two fields:
       ```go
       liqThresholdRaw := unpacked[3].(*big.Int)   // currentLiquidationThreshold, basis points (10000 = 100%)
       ltvRaw          := unpacked[4].(*big.Int)   // ltv, basis points
       liqThreshold, _ := new(big.Float).Quo(new(big.Float).SetInt(liqThresholdRaw), big.NewFloat(10000)).Float64()
       ltv, _          := new(big.Float).Quo(new(big.Float).SetInt(ltvRaw), big.NewFloat(10000)).Float64()
       ```
     - Add `LTV: ltv` and `LiquidationThreshold: liqThreshold` to the returned `protocols.Position`.
   - Why: The ABI already returns these; unpacking them costs nothing. Polygon and Optimism are major Aave V3 deployments; many users hold positions there.
   - Depends on: Step 1
   - Risk: Low for data fields. Medium for new chains — if the Aave Pool address on Polygon or Optimism differs from the value used, `fetchChain` returns a contract-call error. Mitigate by confirming the exact addresses from Aave docs before writing the code.

3. **Add Polygon and Optimism RPC URLs to main.go** (`services/monitor/cmd/server/main.go`)
   - Action:
     - In the Alchemy branch, add:
       ```go
       137: fmt.Sprintf("https://polygon-mainnet.g.alchemy.com/v2/%s", alchemyKey),
       10:  fmt.Sprintf("https://opt-mainnet.g.alchemy.com/v2/%s", alchemyKey),
       ```
     - In the LlamaNodes fallback branch, add:
       ```go
       137: "https://polygon.llamarpc.com",
       10:  "https://optimism.llamarpc.com",
       ```
   - Why: The Aave client iterates `c.rpcURLs`; if a chain ID is in `poolAddresses` but not in `rpcURLs`, `fetchChain` will never be called for it — the map iteration skips it silently. Both must be present for the new chains to be fetched.
   - Depends on: Step 2
   - Risk: Low — additive map entries.

### Phase 2: Position detail screen — tapping a card opens full breakdown

4. **Extend `Position` type in mobile store** (`apps/mobile/store/types.ts`)
   - Action: Add `ltv: number` and `liquidationThreshold: number` to the `Position` interface after `debtUsd`.
   - Why: Must match the updated backend JSON response from Step 1. Without these fields the detail screen has no typed access to them.
   - Depends on: Step 1 (backend must emit them in the response)
   - Risk: Low — TypeScript will surface any access to the new fields at compile time.

5. **Create position detail screen** (`apps/mobile/app/position/[id].tsx`)
   - Action: Create a new Expo Router screen at this path. The `id` param is `walletId|protocol|chainId` URI-encoded.
     - Import `useLocalSearchParams` from `expo-router` to read `id`. Decode and split on `|` to get `walletId`, `protocol`, `chainId`.
     - Read `positions` from Zustand store, find the matching position by those three keys.
     - If not found, render a "Position not found" fallback with a back button.
     - UI layout (all using existing design system tokens, `StyleSheet.create`, no inline styles):
       - `SafeAreaView` with `bgPrimary` background.
       - Header row: back chevron (`MaterialCommunityIcons`, `chevron-left`, `onPress: router.back()`), title showing `{PROTOCOL_LABELS[position.protocol]} · {CHAIN_NAMES[position.chainId]}`.
       - Large `HealthBar` component (`height={8}`, `showLabel={true}`) centered with extra vertical spacing.
       - Four stat cards in a 2×2 grid:
         - Collateral: `$${position.collateralUsd.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
         - Debt: same format
         - LTV: `position.ltv > 0 ? (position.ltv * 100).toFixed(1) + '%' : 'N/A'`
         - Liq. Threshold: `position.liquidationThreshold > 0 ? (position.liquidationThreshold * 100).toFixed(1) + '%' : 'N/A'`
       - Each stat card uses `colors.surface` background, `Radius.card`, `Spacing.md` padding, label in `FontFamily.semibold` / `FontSize.caption` / `textTertiary`, value in `FontFamily.monoSemibold` / `FontSize.h3`.
     - Add `PROTOCOL_LABELS` map: `{ aave_v3: 'Aave V3', compound_v3: 'Compound V3', marginfi: 'MarginFi', solend: 'Solend' }`.
     - Add `CHAIN_NAMES` map: `{ 1: 'Ethereum', 8453: 'Base', 42161: 'Arbitrum', 137: 'Polygon', 10: 'Optimism', 0: 'Solana' }` (Solana protocol clients use chainId 0).
     - Export default function `PositionDetailScreen`.
   - Depends on: Step 4 (Position type fields), None for routing (Expo Router picks it up automatically)
   - Risk: Low — read-only screen, no writes. The only failure mode is a missing position in the store (handled with fallback).

6. **Make PositionCard tappable and wire navigation** (`apps/mobile/app/(tabs)/index.tsx`)
   - Action:
     - Add `import { Pressable } from "react-native"` (already imported alongside `View` — just add `Pressable` to the destructure).
     - Add `import { router } from "expo-router"`.
     - In `PositionCard`, accept an `onPress` prop of type `() => void`.
     - Wrap the outermost `View` in `Pressable`. Move `onLayout` to the `Pressable`. Pass `onPress` to the `Pressable`. Use `android_ripple={{ color: colors.accentSoft }}` and `style={({ pressed }) => [styles.card, { opacity: pressed ? 0.92 : 1, ... }]}` for press feedback.
     - At the call site in `Dashboard`, compute `positionKey`, then pass:
       ```tsx
       onPress={() => router.push(`/position/${encodeURIComponent(`${item.walletId}|${item.protocol}|${item.chainId}`)}`)}
       ```
   - Why: Expo Router resolves `/position/[id]` automatically once the file exists. The `|`-delimited encoding is compact, URL-safe after `encodeURIComponent`, and fully reversible via `decodeURIComponent` + `split('|')`.
   - Depends on: Step 5 (the target route must exist before navigation is wired)
   - Risk: Low — minimal change to an existing component. The `Pressable` wrapping approach preserves all existing layout and highlight behavior.

### Phase 3: App Store / Play Store submission prep

7. **Create `eas.json`** (`apps/mobile/eas.json`)
   - Action: Create the file with the following structure:
     ```json
     {
       "cli": {
         "version": ">= 14.0.0"
       },
       "build": {
         "development": {
           "developmentClient": true,
           "distribution": "internal"
         },
         "preview": {
           "distribution": "internal",
           "android": {
             "buildType": "apk"
           }
         },
         "production": {
           "autoIncrement": true
         }
       },
       "submit": {
         "production": {}
       }
     }
     ```
   - Why: Without `eas.json`, `eas build` cannot determine build profiles. `preview` produces an installable APK for internal testing. `production` targets signed AAB (Android) and IPA (iOS).
   - Depends on: None
   - Risk: Low — config file only, no code execution.

8. **Update `app.json` with store submission metadata** (`apps/mobile/app.json`)
   - Action: Add the following fields:
     - Under `expo`:
       - `"version": "1.0.0"` (already present — confirm it is correct)
       - `"runtimeVersion": { "policy": "appVersion" }` — pins OTA update compatibility to the app version
       - `"privacy": "unlisted"` — keeps the EAS project unlisted until ready for public release
     - Under `expo.ios`:
       - `"bundleIdentifier": "com.kalkikal.reflex"` — matching the Android package name pattern
       - `"buildNumber": "1"`
       - `"supportsTablet": true` (already present — verify)
     - Under `expo.android`:
       - `"versionCode": 1`
       - `"package": "com.kalkikal.reflex"` (already present — verify)
     - Under `expo.extra`:
       - `"privacyPolicyUrl": "https://reflexapp.io/privacy"` — required by both stores; replace with real URL before submission
     - Under `expo.plugins` (array — append, don't replace):
       - `"expo-notifications"` — if not already listed (required for FCM config on Android build)
     - Under `expo`:
       - `"notification": { "icon": "./assets/icon.png", "color": "#A07218" }` — Android notification icon and accent color (matches the accent token from design system)
   - Why: The App Store and Play Store reject submissions missing `bundleIdentifier`, `buildNumber`/`versionCode`, and a privacy policy URL for apps that request push notification permissions.
   - Depends on: None
   - Risk: Low — metadata only. `runtimeVersion` policy change will invalidate any existing OTA updates but there are no production users yet.

---

## Testing Strategy

- **Unit (Go) — Aave client** (`services/monitor/internal/protocols/aave/client_test.go`):
  - Extend the existing test to assert that `LTV` and `LiquidationThreshold` are non-zero on a known Ethereum mainnet address with an active position.
  - Add a table-driven test asserting Polygon (137) and Optimism (10) chain IDs are present in `poolAddresses`.

- **Build check (Go)**: `cd services/monitor && go build ./...` must pass after Steps 1-3.

- **TypeScript**: `cd apps/mobile && bunx tsc --noEmit` must pass after Steps 4-6.

- **Manual (mobile)**:
  - Tap a PositionCard on the dashboard — confirm navigation to `/position/[id]` with correct data.
  - Confirm back button returns to dashboard with highlight state intact.
  - Confirm LTV and liqThreshold show real values for Aave positions, "N/A" for Compound/MarginFi/Solend.
  - Run `eas build --platform android --profile preview` locally in dry-run mode (`--non-interactive`) to confirm `eas.json` is valid.

---

## Risks & Mitigations

- **Aave V3 Pool addresses on Polygon/Optimism**: The same address `0x794a61358D6845594F94dc1DB02A252b5b4814aD` is used for Arbitrum in the current code. Aave V3 uses CREATE2 deterministic deployment but the addresses are NOT always identical across chains. Mitigation: verify each chain's pool address at https://docs.aave.com/developers/deployed-contracts/v3-mainnet/ before writing them into the code. The plan uses placeholder values — the implementer must substitute the real addresses.

- **LTV/LiquidationThreshold basis point scaling**: Aave returns these as basis points (e.g. 8000 = 80%). The plan divides by 10000. If the values look wrong (> 1.0 after conversion), check whether a different scaling is used for a specific chain.

- **Solana chainId = 0 assumption**: The MarginFi and Solend clients set `ChainID` in their returned `Position`. Read those clients to confirm the value used; update `CHAIN_NAMES` map in the detail screen accordingly.

- **`encodeURIComponent` on `|`**: The pipe character is not a reserved URI character but `encodeURIComponent` encodes it to `%7C`. Expo Router passes the raw segment to `useLocalSearchParams` after decoding. Verify that `decodeURIComponent` in the detail screen correctly reconstructs the original string before splitting.

- **`eas.json` cli version**: The minimum EAS CLI version `>= 14.0.0` must match the installed version (`eas --version`). If the installed version is older, the build command fails with a version error. Update the `cli.version` field to match or raise the local CLI.

---

## Success Criteria

- [ ] `protocols.Position` struct has `LTV` and `LiquidationThreshold` fields emitted in JSON response
- [ ] Aave fetcher returns non-zero LTV and liqThreshold for positions on Ethereum, Base, Arbitrum, Polygon, Optimism
- [ ] `go build ./...` passes with zero errors in `services/monitor`
- [ ] Tapping a PositionCard navigates to `/position/[id]`
- [ ] Position detail screen shows: health factor bar, collateral USD, debt USD, LTV %, liq threshold %, protocol label, chain name
- [ ] Back button on detail screen returns to dashboard; highlighted card state is preserved
- [ ] LTV and liqThreshold show "N/A" for Compound V3, MarginFi, and Solend positions
- [ ] `bunx tsc --noEmit` in `apps/mobile` passes with zero errors after all mobile changes
- [ ] `eas.json` exists with development, preview, and production profiles
- [ ] `app.json` contains `bundleIdentifier` (iOS), `versionCode` (Android), `privacyPolicyUrl`, and `notification` config
- [ ] No `any` types introduced in TypeScript
- [ ] No inline styles introduced in mobile (all in `StyleSheet.create`)
