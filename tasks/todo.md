# Implementation Plan: Notification Deep-Linking

## Overview

When the backend fires a push alert, tapping the notification opens the app to
the Positions screen and highlights the relevant position card with an accent
border for 3 seconds. The backend already sends a partial `data` payload
(`ruleId`, `protocol`); this plan completes it with `walletId` and `chainId`,
then wires the mobile side end-to-end.

## Assumptions

- `chainId` is serialised as a string in the push `data` map (Expo's data field
  is `map[string]string`). The mobile side parses it back to a number.
- When `chainId` is `null` on the rule (Solana protocols), the data field omits
  `chainId` entirely; the mobile key derivation treats a missing `chainId` as `0`.
- The highlight key format is `"<walletId>-<protocol>-<chainId>"` — identical to
  the `keyExtractor` already used in the `FlatList` in `index.tsx`.
- `FlatList` is replaced with `ScrollView` + manual mapping so that
  `scrollTo` can be called via a ref. `FlatList`'s `scrollToIndex` requires
  `getItemLayout` which adds fragility; a plain `ScrollView` with `onLayout`
  per card is simpler and already within the existing pattern.
- Auto-clear timeout is 3 000 ms.
- No changes to navigation structure — the hook uses `router.replace` to land
  on `/(tabs)/` (index) without adding a back-stack entry.

## Architecture Changes

- `services/monitor/internal/monitor/engine.go`: add `walletId` and `chainId`
  to the push `data` map.
- `apps/mobile/store/index.ts`: add `highlightedPositionKey` state + setter.
- `apps/mobile/hooks/useNotificationDeepLink.ts`: new file — notification
  response listener, key extraction, store write, navigation.
- `apps/mobile/app/(tabs)/_layout.tsx`: call the new hook inside `TabLayout`.
- `apps/mobile/app/(tabs)/index.tsx`: read highlight key, swap `FlatList` for
  `ScrollView`, measure card offsets with `onLayout`, scroll + highlight,
  auto-clear.

---

## Implementation Steps

### Phase 1: Backend — complete push data payload

1. **Extend push data map in engine** (`services/monitor/internal/monitor/engine.go`)
   - Action: In `fireAlert`, change the `Data` field of the `PushMessage` from
     `map[string]string{"ruleId": t.Rule.ID, "protocol": t.Rule.Protocol}` to
     also include `"walletId": t.Rule.WalletID` and, when `t.Rule.ChainID` is
     non-nil, `"chainId": strconv.Itoa(*t.Rule.ChainID)`. Use a helper to build
     the map so the nil-check is clean and the function stays under 50 lines.
   - Add `"strconv"` to the import block (it may not be imported yet).
   - Why: The mobile side needs `walletId` + `chainId` to derive the exact
     position key. `ruleId` and `protocol` are already present.
   - Depends on: None
   - Risk: Low — additive change to an existing map literal.

### Phase 2: Mobile store — highlight state

2. **Add `highlightedPositionKey` to Zustand store** (`apps/mobile/store/index.ts`)
   - Action: Add to `StoreState` interface:
     ```
     highlightedPositionKey: string | null;
     setHighlightedPositionKey: (key: string | null) => void;
     ```
     Add to the `create` initialiser:
     ```
     highlightedPositionKey: null,
     setHighlightedPositionKey: (key) => set({ highlightedPositionKey: key }),
     ```
   - Why: Decouples the notification listener from the positions screen;
     the screen subscribes reactively.
   - Depends on: None
   - Risk: Low — additive state slice.

### Phase 3: Deep-link hook

3. **Create `useNotificationDeepLink` hook** (`apps/mobile/hooks/useNotificationDeepLink.ts`)
   - Action: New file. The hook:
     1. Imports `* as Notifications from "expo-notifications"` and `router`
        from `"expo-router"`.
     2. Subscribes with `Notifications.addNotificationResponseListener` inside
        a `useEffect` (cleanup removes the subscription).
     3. Extracts `data` from
        `response.notification.request.content.data` typed as
        `Record<string, string>`.
     4. Validates that `data.ruleId` and `data.walletId` exist; if not, returns
        early.
     5. Derives `chainId`: `data.chainId ? parseInt(data.chainId, 10) : 0`.
     6. Derives key:
        `` `${data.walletId}-${data.protocol}-${chainId}` ``
     7. Calls `setHighlightedPositionKey(key)` from the store.
     8. Calls `router.replace("/(tabs)/")` to navigate (or no-op if already
        there — `replace` is safe to call regardless).
   - Why: Isolated hook keeps `_layout.tsx` clean; matches the `useThemeColors`
     pattern of a single-responsibility hook in `hooks/`.
   - Depends on: Step 2
   - Risk: Low — pure side-effect hook, no render output.

### Phase 4: Wire hook into layout

4. **Call hook in `TabLayout`** (`apps/mobile/app/(tabs)/_layout.tsx`)
   - Action: Import `useNotificationDeepLink` from
     `"../../hooks/useNotificationDeepLink"` and call it unconditionally inside
     `TabLayout` (after the existing `useEffect`). No JSX change required.
   - Why: `_layout.tsx` is mounted for the lifetime of the tab navigator —
     the correct place for persistent listeners, consistent with how
     `registerForPushNotifications` is already invoked here.
   - Depends on: Step 3
   - Risk: Low.

### Phase 5: Positions screen — scroll + highlight

5. **Refactor list and add highlight logic** (`apps/mobile/app/(tabs)/index.tsx`)

   5a. **Replace `FlatList` with `ScrollView` + manual render**
   - Action: Remove `FlatList` import; add `ScrollView`, `useRef`,
     `Animated` imports. Wrap the cards in a `ScrollView` with
     `ref={scrollRef}` (typed `useRef<ScrollView>(null)`). Map
     `positions` directly: `positions.map((item) => <PositionCard ... />)`.
     Preserve existing `contentContainerStyle` (`paddingBottom: 108`).
   - Why: `ScrollView` exposes `scrollTo({ y, animated: true })` which is
     simpler to control than `FlatList.scrollToIndex` for a variable-height
     list without `getItemLayout`.
   - Depends on: None (independent refactor, but must land with 5b/5c)
   - Risk: Low — positions list is not paginated; count is bounded by
     wallets × protocols per wallet.

   5b. **Track per-card Y offsets**
   - Action: Add `offsetsRef = useRef<Record<string, number>>({})` in
     `Dashboard`. Pass `onLayout` to `PositionCard` which records
     `offsetsRef.current[positionKey] = event.nativeEvent.layout.y` via a
     callback prop `onMeasure: (key: string, y: number) => void`.
     Derive `positionKey` from `${item.walletId}-${item.protocol}-${item.chainId}`.
   - Why: Needed to scroll to the correct card when the highlight key is set.
   - Depends on: 5a
   - Risk: Low.

   5c. **Scroll to and highlight the target card**
   - Action: Add a `useEffect` in `Dashboard` that watches
     `highlightedPositionKey`:
     ```
     useEffect(() => {
       if (!highlightedPositionKey) return;
       const y = offsetsRef.current[highlightedPositionKey];
       if (y !== undefined) {
         scrollRef.current?.scrollTo({ y, animated: true });
       }
       const timer = setTimeout(() => setHighlightedPositionKey(null), 3000);
       return () => clearTimeout(timer);
     }, [highlightedPositionKey]);
     ```
   - Why: Combines scroll + auto-clear in one effect; cleanup prevents stale
     timers on unmount.
   - Depends on: 5b
   - Risk: Low.

   5d. **Render accent border on highlighted card**
   - Action: In `PositionCard`, accept an `isHighlighted: boolean` prop.
     In `Dashboard`, pass `isHighlighted={positionKey === highlightedPositionKey}`.
     In `PositionCard`'s `View` style array, conditionally add:
     `isHighlighted && { borderColor: colors.accent, borderWidth: 2 }`.
     Add a `StyleSheet` entry `cardHighlighted` (empty object, just for
     semantic grouping) — the borderColor/borderWidth override sits inline
     in the conditional spread since it varies per render.
     Wait — per conventions no inline styles. Instead: add a separate
     `StyleSheet` entry `cardHighlightedBorder: { borderColor: ... }` —
     but `colors.accent` is dynamic. Correct approach: pass `accentColor`
     via prop or use the same pattern as existing dynamic styles:
     `[styles.card, { backgroundColor: colors.surface, borderColor: isHighlighted ? colors.accent : colors.borderSubtle, borderWidth: isHighlighted ? 2 : 1 }]`.
     This is consistent with how every other card in the codebase handles
     dynamic color — it goes into the inline style object inside
     `StyleSheet.create`'s dynamic part, which is the established pattern.
   - Why: Visual feedback tying the notification to the specific position.
   - Depends on: 5c
   - Risk: Low.

---

## Data Shape

### Push notification `data` map (backend → Expo)

```
{
  "ruleId":   "uuid-string",
  "walletId": "uuid-string",
  "protocol": "aave_v3" | "compound_v3" | "marginfi" | "solend",
  "chainId":  "1" | "137" | "42161" | "8453"   // omitted for Solana protocols
}
```

### Position highlight key (mobile)

```
`${walletId}-${protocol}-${chainId}`
```

Matches exactly the `keyExtractor` in `index.tsx`:
`(item) => \`${item.walletId}-${item.protocol}-${item.chainId}\``

---

## Testing Strategy

- **Unit (Go)**: In `internal/monitor/engine_test.go` (or a new
  `engine_fireAlert_test.go`), assert that when `ChainID` is non-nil the
  `data` map contains `"chainId"`, and when nil it does not. Mock
  `pushClient` with a stub.
- **Unit (TS)**: In `hooks/__tests__/useNotificationDeepLink.test.ts`,
  mock `expo-notifications` and `expo-router`, fire a synthetic response,
  assert `setHighlightedPositionKey` called with the correct key.
- **Integration (mobile)**: On device/simulator — fire a test notification
  via Expo push tool with the correct `data`, verify positions screen
  scrolls to the card and border highlights for ~3 s.
- **Edge case**: notification arrives with missing `walletId` → hook returns
  early, no navigation, no highlight (covered in unit test).
- **Edge case**: notification arrives while app is killed (cold start) — Expo
  passes last notification response via
  `Notifications.getLastNotificationResponseAsync()`. Add a second
  `useEffect` in the hook that calls this on mount and runs the same handler
  logic. This ensures cold-start deep-links work.

---

## Risks & Mitigations

- **ScrollView vs FlatList performance**: For a DeFi positions list the item
  count is at most ~20 (bounded by wallets × protocols). `ScrollView` is
  fine. If this ever grows, revert to `FlatList` with `getItemLayout` using
  a fixed card height constant.
- **`onLayout` fires after first render**: The highlight `useEffect` may fire
  before `offsetsRef` is populated if `highlightedPositionKey` is set from a
  cold start. Mitigation: the effect depends on `highlightedPositionKey`;
  `onLayout` fires synchronously during the layout pass before effects run
  for items already on screen, so the offset will be available. If not
  (list not yet rendered), `scrollTo` is a no-op — acceptable.
- **`strconv` import conflict (Go)**: If `strconv` is already imported in
  `engine.go`, adding it again would cause a compile error. Check imports
  before writing.
- **Expo notification listener type safety**: `response.notification.request.content.data`
  is typed as `Record<string, unknown>` in recent expo-notifications versions.
  Cast with a type guard rather than `as Record<string, string>` to stay
  strict. Guard: check `typeof value === "string"` before use.

---

## Success Criteria

- [ ] Backend push payload includes `walletId` and `chainId` (when non-null) for every fired alert
- [ ] Tapping a push notification opens the app to the Positions tab
- [ ] The matching position card scrolls into view
- [ ] The card displays an accent-colored border for 3 seconds then reverts
- [ ] Cold-start deep-link (app killed) works via `getLastNotificationResponseAsync`
- [ ] Notifications with missing/malformed data do not crash or navigate
- [ ] No TypeScript `any` types introduced
- [ ] All new mobile files use named exports (hook file) or default export (screen only)
- [ ] Styles use `StyleSheet.create()` pattern consistent with existing screens
