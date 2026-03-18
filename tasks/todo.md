# Implementation Plan: price_change Alert Type

## Overview

Implement the `price_change` alert type end-to-end: DB migration adds a
`last_price_checked` column for `change_pct` tracking, a unified token map
centralises EVM + Solana address → CoinGecko ID lookups, the evaluator gets
price-aware logic, the engine pre-fetches prices and passes them in, the API
validates the new direction and requires `tokenAddress`, and the mobile form
gains an alert type toggle plus token picker.

## Assumptions

- `change_pct` direction fires when `abs((currentPrice - lastPrice) / lastPrice) * 100 >= threshold`. The alert fires regardless of whether the change is up or down (unsigned percentage). The notification message distinguishes direction ("up X%" or "down X%").
- `below` and `above` directions for `price_change` rules compare current token USD price directly against `threshold` (e.g. "alert when ETH price is below $2000").
- For `change_pct`, a rule with no `last_price_checked` (first evaluation) records the current price without firing. This prevents a false trigger on rule creation.
- `last_price_checked` is updated only when the rule actually evaluates (i.e. token price was successfully fetched). If the price fetch fails for a token, that rule is skipped silently with a log line — same pattern as `health_factor` skipping a missing position.
- The token list in the mobile form is a hardcoded curated set of major assets — no on-chain token search. Solana tokens use their mint address; EVM tokens use their checksummed address (lowercase for storage, consistent with compound/assets.go).
- `protocol` field is still required for `price_change` rules — it serves as context for the user (which protocol's market this relates to) and keeps the schema uniform. For truly cross-protocol price alerts the user picks any protocol; the evaluator ignores `protocol` for `price_change` rules.
- The `prices.Client` is already instantiated somewhere in main. The engine receives it via a new field; `NewEngine` signature gains a `priceClient` parameter.
- The `change_pct` cooldown still uses the existing 30-minute cooldown from `last_triggered_at`. This prevents spam when a volatile token keeps swinging.

## Architecture Changes

- `services/monitor/internal/storage/migrations/004_price_tracking.sql`: Add `last_price_checked NUMERIC` column to `alert_rules`.
- `services/monitor/internal/prices/tokenmap.go`: New file — exported `TokenToCoinGeckoID(address string) (string, bool)` merging both protocol maps. Single source of truth for all address→ID lookups going forward.
- `services/monitor/internal/storage/alerts.go`: Add `LastPriceChecked *float64` to `AlertRule` struct. Update all `Scan` calls that read `alert_rules` columns. Add `UpdateLastPriceChecked(ctx, db, ruleID, price)` storage function.
- `services/monitor/internal/alerts/evaluator.go`: Change `Evaluate` signature to accept `currentPrices map[string]float64` (keyed by lowercase token address). Implement `evaluatePriceChange`. Handle `below`, `above`, and `change_pct` directions.
- `services/monitor/internal/api/alerts.go`: Add `"change_pct"` to `validDirections`. Add validation: when `alertType == "price_change"`, `tokenAddress` must be non-empty.
- `services/monitor/internal/monitor/engine.go`: Add `priceClient *prices.Client` field. Before calling `alerts.Evaluate`, collect unique token addresses from active `price_change` rules, look up their CoinGecko IDs via `prices.TokenToCoinGeckoID`, batch-fetch prices, build `map[string]float64` keyed by token address, pass to `Evaluate`. After evaluation, call `UpdateLastPriceChecked` for triggered `change_pct` rules and for any `price_change` rule that fetched a price for the first time (nil `LastPriceChecked`).
- `apps/mobile/app/(tabs)/alerts.tsx`: Add `alertType` state, alert type segment control, token picker (hardcoded list), conditional direction options, conditional threshold label, and updated `handleCreate` call.

---

## Implementation Steps

### Phase 1: DB Migration — unblocks all storage work

1. **Add `last_price_checked` column** (`services/monitor/internal/storage/migrations/004_price_tracking.sql`)
   - Action: Create the file with a single statement:
     `ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS last_price_checked NUMERIC;`
   - Why: All subsequent phases require this column to exist. Nullable NUMERIC so existing `health_factor` rows are unaffected.
   - Depends on: None
   - Risk: Low — additive DDL with `IF NOT EXISTS` guard.

### Phase 2: Unified token map — unblocks engine price lookup

2. **Create `prices/tokenmap.go`** (`services/monitor/internal/prices/tokenmap.go`)
   - Action: New file in `package prices`. Declare a package-level `var tokenAddressToID = map[string]string{ ... }` merging every entry from `compound/assets.go`'s `coinGeckoIDs` and `marginfi/client.go`'s `mintToCoinGeckoID`. Keys are lowercase for EVM addresses (already lowercase in compound) and base58 for Solana mints. Export a function `TokenToCoinGeckoID(address string) (string, bool)` that does `id, ok := tokenAddressToID[strings.ToLower(address)]; return id, ok`. Use `strings` import.
   - Entries to include from compound/assets.go (8 EVM addresses) and marginfi/client.go (8 Solana mints).
   - Why: Removes duplicated maps scattered across protocol packages. The engine and any future code has one lookup point. The protocol packages keep their own maps unchanged (they still need them internally for position computation); this is a new exported copy in the `prices` package.
   - Depends on: None
   - Risk: Low — pure data, no logic change.

### Phase 3: Storage layer — struct + scan + new write function

3. **Update `AlertRule` struct and all scan sites** (`services/monitor/internal/storage/alerts.go`)
   - Action:
     - Add `LastPriceChecked *float64` field to `AlertRule` struct after `LastTriggeredAt`.
     - In `scanAlertRule`, add `&r.LastPriceChecked` as the last scan target. Update all `SELECT` column lists in `CreateAlertRule` (RETURNING clause), `GetAlertRulesByUserID`, `GetAlertRulesByWalletID`, and `GetWalletsWithActiveRules` to include `last_price_checked` at the end of each column list.
     - In `GetWalletsWithActiveRules`, add `rule.LastPriceChecked` scan target in the manual `rows.Scan` call (the one that doesn't use `scanAlertRule`).
   - Why: All read paths must include the new column or scans will panic at runtime on any row returned after the migration runs.
   - Depends on: Step 1 (column must exist before queries include it)
   - Risk: Medium — touches every SELECT in the file. Must add the column to all 4 column lists consistently. Missing one causes a column-count mismatch scan error.

4. **Add `UpdateLastPriceChecked` storage function** (`services/monitor/internal/storage/alerts.go`)
   - Action: Append a new exported function:
     ```go
     func UpdateLastPriceChecked(ctx context.Context, db *pgxpool.Pool, ruleID string, price float64) error {
         _, err := db.Exec(ctx,
             "UPDATE alert_rules SET last_price_checked = $1 WHERE id = $2",
             price, ruleID,
         )
         if err != nil {
             return fmt.Errorf("storage: update last price checked: %w", err)
         }
         return nil
     }
     ```
   - Why: Clean separation — engine calls this after evaluation, keeping DB writes out of the evaluator.
   - Depends on: Step 1
   - Risk: Low — new function, no existing code touched.

### Phase 4: Evaluator — implement price_change logic

5. **Update `Evaluate` signature and implement `evaluatePriceChange`** (`services/monitor/internal/alerts/evaluator.go`)
   - Action:
     - Change `Evaluate` signature from `Evaluate(rules []storage.AlertRule, positions []protocols.Position) []TriggeredRule` to `Evaluate(rules []storage.AlertRule, positions []protocols.Position, currentPrices map[string]float64) []TriggeredRule`. Update the `price_change` case to call `evaluatePriceChange(rule, currentPrices)`.
     - Update the `health_factor` call site: `evaluateHealthFactor(rule, positions)` — unchanged, just verify it still compiles.
     - Add `evaluatePriceChange(rule storage.AlertRule, currentPrices map[string]float64) (TriggeredRule, bool)`:
       1. If `rule.TokenAddress == nil`, return false.
       2. Look up `price, ok := currentPrices[strings.ToLower(*rule.TokenAddress)]`. If `!ok`, return false.
       3. Switch on `rule.Direction`:
          - `"below"`: fire if `price < rule.Threshold && cooldownExpired(rule.LastTriggeredAt)`. Message: `"<TOKEN> price $%.2f is below threshold $%.2f"`.
          - `"above"`: fire if `price > rule.Threshold && cooldownExpired(rule.LastTriggeredAt)`. Message: `"<TOKEN> price $%.2f is above threshold $%.2f"`.
          - `"change_pct"`: if `rule.LastPriceChecked == nil`, return `(TriggeredRule{Rule: rule, Value: price}, true)` with a sentinel `Message = ""` (empty message signals "record price, don't fire notification" — see engine step). Wait — this leaks sentinel logic into the evaluator. Better: return a dedicated `PriceUpdateOnly bool` field on `TriggeredRule` OR handle the nil case in the engine before calling Evaluate. The cleaner approach is to handle it in the engine (step 7): if `LastPriceChecked == nil`, skip passing the rule to Evaluate entirely, just record the price. So in `evaluatePriceChange`, when `change_pct` and `LastPriceChecked != nil`: compute `changePct = math.Abs((price - *rule.LastPriceChecked) / *rule.LastPriceChecked * 100)`. Fire if `changePct >= rule.Threshold && cooldownExpired(rule.LastTriggeredAt)`. Determine direction word from sign: `upOrDown = "up"` if `price >= *rule.LastPriceChecked`, else `"down"`. Message: `"<TOKEN> price moved %s %.1f%% (was $%.2f, now $%.2f)"`.
       4. All paths that fire return `TriggeredRule{Rule: rule, Message: msg, Value: price}, true`.
     - Add `"math"` and `"strings"` to imports.
   - Why: Keeps evaluator pure — all I/O remains in engine. The `change_pct` nil-first-run case is handled at the engine layer to avoid leaking sentinel values.
   - Depends on: Steps 3 (LastPriceChecked field), Step 2 (tokenmap used only by engine, not evaluator)
   - Risk: Medium — signature change means the single existing call site in engine.go will break until step 7 is done. These two steps must be implemented together before the service compiles.

### Phase 5: API validation

6. **Add `change_pct` direction and `price_change` tokenAddress validation** (`services/monitor/internal/api/alerts.go`)
   - Action:
     - Change `validDirections` map to `map[string]bool{"below": true, "above": true, "change_pct": true}`.
     - Update the error message string to `"direction must be 'below', 'above', or 'change_pct'"`.
     - After the direction check, add:
       ```go
       if req.AlertType == "price_change" && (req.TokenAddress == nil || *req.TokenAddress == "") {
           http.Error(w, "tokenAddress is required for price_change alerts", http.StatusBadRequest)
           return
       }
       ```
   - Why: Prevents malformed `price_change` rules from entering the DB and causing nil-pointer panics in the evaluator.
   - Depends on: None (pure validation logic)
   - Risk: Low — additive validation, no existing valid requests rejected.

### Phase 6: Engine — pre-fetch prices, wire evaluator, persist last price

7. **Wire price client into engine and update `pollWallet`** (`services/monitor/internal/monitor/engine.go`)
   - Action:
     - Add `priceClient *prices.Client` field to `Engine` struct.
     - Add `priceClient *prices.Client` parameter to `NewEngine` and assign it.
     - Add import `"reflex/services/monitor/internal/prices"`.
     - Extract a helper `collectPriceChangeRules(rules []storage.AlertRule) []storage.AlertRule` that filters rules where `AlertType == "price_change" && TokenAddress != nil`.
     - Add a helper `fetchCurrentPrices(ctx context.Context, rules []storage.AlertRule) map[string]float64` that:
       1. Collects unique token addresses from rules.
       2. For each, calls `prices.TokenToCoinGeckoID(addr)`. Skips unknowns with a log line.
       3. Batch-calls `e.priceClient.GetUSDPrices(ctx, coinIDs)`.
       4. Builds and returns a map keyed by token address (lowercase) to USD price.
       5. Returns empty map on error (logs it).
     - In `pollWallet`, before calling `alerts.Evaluate`:
       1. Find `priceRules := collectPriceChangeRules(w.Rules)`.
       2. For rules where `LastPriceChecked == nil`: call `storage.UpdateLastPriceChecked` to seed the price, log "seeding price for rule X". Do NOT include these in the Evaluate call.
       3. For remaining `priceRules` (where `LastPriceChecked != nil`): call `fetchCurrentPrices`.
       4. Call `alerts.Evaluate(w.Rules, positions, currentPrices)` — pass the price map (empty map if no price rules).
     - After evaluating triggered rules: for each triggered rule where `AlertType == "price_change"`, call `storage.UpdateLastPriceChecked(ctx, e.db, t.Rule.ID, t.Value)` after `MarkRuleTriggered`. This keeps the baseline price current so the next `change_pct` cycle measures from the last triggered price, not from the original seed.
   - Why: Pre-fetching prices outside `Evaluate` keeps the evaluator pure and testable. Seeding nil rules prevents false-trigger on rule creation. Updating `last_price_checked` after trigger gives coherent change tracking.
   - Depends on: Steps 2, 4, 5 (tokenmap, storage function, evaluator signature change — all must be done before this compiles)
   - Risk: High — this is the most coupled step. Steps 2, 3, 4, 5, and 7 must all compile together. Plan to implement 2→3→4→5→7 in sequence in a single session.

8. **Update `NewEngine` call site in `cmd/main.go` (or equivalent entry point)** (`services/monitor/cmd/server/main.go` or wherever `NewEngine` is called)
   - Action: Find where `NewEngine` is called. Pass the existing `prices.Client` instance (already created for protocol fetchers) as the new last argument. If no `prices.Client` is instantiated yet at the main level, construct one with `prices.NewClient(os.Getenv("COINGECKO_API_KEY"))` before calling `NewEngine`.
   - Why: Compilation will fail until the call site matches the new signature.
   - Depends on: Step 7
   - Risk: Low — straightforward wiring.

### Phase 7: Mobile UI

9. **Add alert type toggle and token picker to the create form** (`apps/mobile/app/(tabs)/alerts.tsx`)
   - Action:
     - Add state: `const [alertType, setAlertType] = useState<AlertRule["alertType"]>("health_factor")`.
     - Add a `TOKENS` constant (typed array of `{ label: string; symbol: string; address: string; chainFamily: "evm" | "solana" }`) with at least: ETH (WETH EVM), WBTC (EVM), LINK (EVM), UNI (EVM), SOL (Solana wrapped mint), USDC (Solana mint), BTC Wormhole (Solana mint). These addresses match the tokenmap exactly.
     - Add state: `const [selectedTokenIdx, setSelectedTokenIdx] = useState(0)`.
     - Derive the directions available based on `alertType`:
       ```ts
       const DIRECTIONS_FOR_TYPE: Record<AlertRule["alertType"], Direction[]> = {
         health_factor: ["below", "above"],
         price_change: ["below", "above", "change_pct"],
       };
       ```
       When `alertType` switches, reset `direction` to the first value of the new type's list.
     - In the form JSX, add an "Alert Type" chip row above the Protocol row, toggling between `"health_factor"` and `"price_change"` labels ("Health Factor" / "Token Price").
     - When `alertType === "price_change"`, render a "Token" chip row using `TOKENS` instead of the Protocol chip row. Protocol is still sent to the API but auto-derived from the selected token's `chainFamily`: Solana tokens → `"marginfi"`, EVM tokens → `"aave_v3"` (as a default — price alerts don't semantically belong to a protocol but the field is required by the backend).
     - Update the threshold label: when `alertType === "price_change" && direction === "change_pct"` show "Change Threshold (%)", otherwise when `price_change` show "Price (USD)", else "Health Factor Threshold".
     - Update placeholder: `change_pct` → `"e.g. 5"`, price → `"e.g. 2000"`, HF → `"e.g. 1.5"`.
     - In `handleCreate`: when `alertType === "price_change"`, pass `tokenAddress: TOKENS[selectedTokenIdx].address` and derive `protocol` from token. When `"health_factor"`, pass `tokenAddress: null`.
     - In `resetForm`: reset `alertType` to `"health_factor"`, `selectedTokenIdx` to 0.
     - Update `AlertRuleCard` to show different detail text for `price_change` rules: `"Alert when <TOKEN_SYMBOL> is <direction> <threshold>"` or for `change_pct`: `"Alert on <threshold>% price change"`. Derive symbol from `tokenAddress` lookup against the same `TOKENS` list (add a helper `symbolForAddress(addr: string | null)`).
     - Add `StyleSheet` entries for any new layout (reuse existing `chipRow`, `chip`, `chipText`, `formLabel` patterns — no new patterns needed).
   - Why: Users must be able to create `price_change` alerts without manually entering token addresses or knowing internal IDs.
   - Depends on: Step 6 (API must accept the new direction before mobile can successfully submit)
   - Risk: Medium — largest UI change. The form has conditional rendering branches that must be tested for all state combinations.

---

## Test Strategy

- **Unit (Go) — evaluator** (`services/monitor/internal/alerts/evaluator_test.go`, new file or extend existing):
  - `price_change / below`: price 1800, threshold 2000 → fires. price 2100, threshold 2000 → no fire.
  - `price_change / above`: price 2100, threshold 2000 → fires.
  - `price_change / change_pct`: lastPrice 1000, currentPrice 1060, threshold 5 → fires (6%). threshold 7 → no fire.
  - `price_change / change_pct / nil LastPriceChecked`: engine handles this before calling Evaluate — no test case needed in evaluator tests.
  - `price_change / cooldown active` → no fire even if threshold crossed.
  - `price_change / nil TokenAddress` → no fire (evaluator guard).
  - `price_change / token not in currentPrices map` → no fire.
  - All existing `health_factor` tests must still pass after signature change (pass empty map `map[string]float64{}`).

- **Unit (Go) — tokenmap** (`services/monitor/internal/prices/tokenmap_test.go`):
  - Known EVM address → correct CoinGecko ID.
  - Known Solana mint → correct CoinGecko ID.
  - Mixed-case EVM address → same result as lowercase.
  - Unknown address → `ok == false`.

- **Unit (Go) — storage** (`services/monitor/internal/storage/alerts_test.go` or integration test):
  - `UpdateLastPriceChecked` sets the column; re-reading the row reflects the new value.
  - Existing scans of `health_factor` rules return `LastPriceChecked == nil`.

- **Integration (Go) — engine**: mock `priceClient` returning a fixed price map; assert that `UpdateLastPriceChecked` is called when a `change_pct` rule fires, and that seeding (nil `LastPriceChecked`) calls `UpdateLastPriceChecked` without firing `SendPush`.

- **Manual (mobile)**: create a `price_change / change_pct` alert; verify the API accepts it (201); verify `last_price_checked` is populated in DB on the first engine poll; on second poll simulate a price swing by temporarily modifying the tokenmap price or using a mock — observe notification.

---

## Risks & Mitigations

- **Scan column-count mismatch**: If any SELECT is updated with `last_price_checked` but `scanAlertRule` is not updated (or vice versa), the app panics at runtime. Mitigation: grep for every `SELECT ... FROM alert_rules` before calling the implementation done; confirm the count matches the struct field count.
- **Evaluator signature change breaks compilation**: Steps 5 and 7 must land together. Do not merge step 5 without step 7. Implement them in the same commit.
- **`change_pct` never fires if price is stable**: intended behavior. The baseline (`last_price_checked`) is only updated when the alert fires — not on every poll. This means a rule seeds once, then tracks from that seed price until it fires, at which point the baseline resets. This is correct for "notify me if price moves X% from where it was".
- **Duplicate token entries in tokenmap**: WETH appears in both the EVM compound map (Base address and Eth address) and Solana (Wormhole ETH). All three are different addresses mapping to the same CoinGecko ID `"ethereum"` — this is correct and causes no conflicts since keys are different.
- **`protocol` field for `price_change` rules is semantic mismatch**: we're auto-assigning `"aave_v3"` or `"marginfi"` based on chain family. This is a pragmatic workaround for a NOT NULL DB constraint. Flag this as a known limitation; a future migration can make `protocol` nullable for `price_change` rules.
- **CoinGecko rate limiting**: free tier is 10–30 req/min. The existing `prices.Client` has a 60s cache keyed by the joined coin ID string. The engine's price fetch for all price-change rules in one poll cycle will be a single batch call — this is fine. Risk only materialises if there are many wallets with different price-change token sets producing different cache keys. For MVP this is acceptable.

---

## Success Criteria

- [ ] Migration 004 applies cleanly to an existing DB without data loss
- [ ] `GET /alerts/{userId}` returns `lastPriceChecked` field (or null) for each rule
- [ ] `POST /alerts` with `alertType: "price_change"` and no `tokenAddress` returns 400
- [ ] `POST /alerts` with `direction: "change_pct"` is accepted (previously 400)
- [ ] `price_change / below` and `price_change / above` rules fire when price crosses threshold
- [ ] `price_change / change_pct` rule does NOT fire on first engine poll (seeds price instead)
- [ ] `price_change / change_pct` rule fires on subsequent poll when price moves >= threshold %
- [ ] `last_price_checked` is updated in DB after a `change_pct` rule fires
- [ ] 30-minute cooldown applies to `price_change` rules identically to `health_factor`
- [ ] All existing `health_factor` evaluator unit tests still pass
- [ ] Mobile form shows alert type toggle ("Health Factor" / "Token Price")
- [ ] Selecting "Token Price" shows token picker and reveals `change_pct` direction option
- [ ] `AlertRuleCard` renders meaningful text for `price_change` rules (not "Alert when HF is...")
- [ ] No `any` types introduced in TypeScript
- [ ] No new inline styles introduced in mobile (all in `StyleSheet.create`)
- [ ] `go build ./...` passes with zero errors after all backend steps
