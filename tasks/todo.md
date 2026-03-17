# Implementation Plan: Phase 4 — Alert Engine

## Overview

Build the full alert lifecycle: CRUD API for rules, a monitor goroutine engine that polls positions
on a 60s tick, a rule evaluator with 30min cooldown, Expo push delivery, alert history endpoint,
and the mobile alerts screen with create/delete UI.

No DB migration needed — `alert_rules` and `alert_events` already exist in `001_init.sql`.

---

## Assumptions

- `alert_rules` and `alert_events` schema in `001_init.sql` is correct as-is.
- `price_change` alert type is stubbed in the evaluator (returns no triggers) — only `health_factor` alerts fire in Phase 4.
- The monitor engine polls all wallets that have at least one active alert rule; wallets with no rules are not polled.
- Cooldown is per-rule (via `last_triggered_at`) — two rules on the same wallet can each trigger independently.
- The monitor engine is wired into `main.go` and runs until process exit.
- Expo push uses fire-and-forget (log errors, never block the poll cycle).

---

## Step 1 — Shared protocol fetcher interface (`internal/protocols/fetch.go`)

**Why**: Both the on-demand `PositionsHandler` and the background engine need to fetch positions.
Extracting a shared `Fetcher` interface avoids duplication and lets the engine be tested with mocks.

**Action**: Create `internal/protocols/fetch.go` in package `protocols`:

```go
type EVMFetcher interface {
    FetchPositions(ctx context.Context, walletID, address string) ([]Position, error)
}
type SolanaFetcher interface {
    FetchPositions(ctx context.Context, walletID, address string) ([]Position, error)
}
```

All four protocol clients already satisfy this shape — no changes to client code.

**File**: `services/monitor/internal/protocols/fetch.go`
**Depends on**: nothing
**Risk**: Low

---

## Step 2 — Alert storage layer (`internal/storage/alerts.go`)

**Action**: New file in package `storage` with these functions:

```go
// CRUD for alert_rules
func CreateAlertRule(ctx, db, rule AlertRule) (AlertRule, error)
func GetAlertRulesByUserID(ctx, db, userID string) ([]AlertRule, error)
func GetAlertRulesByWalletID(ctx, db, walletID string) ([]AlertRule, error)
func DeleteAlertRule(ctx, db, ruleID string) error

// For the engine: fetch all wallets that have active rules
func GetWalletsWithActiveRules(ctx, db) ([]WalletWithRules, error)

// Cooldown update after firing
func MarkRuleTriggered(ctx, db, ruleID string) error

// Alert history
func InsertAlertEvent(ctx, db, event AlertEvent) error
func GetAlertEventsByUserID(ctx, db, userID string, limit int) ([]AlertEvent, error)

// Push token lookup
func GetExpoPushToken(ctx, db, userID string) (string, error)
func MarkPushTokenInactive(ctx, db, token string) error
```

**Types** (define in this file or a new `internal/storage/types.go`):

```go
type AlertRule struct {
    ID              string
    UserID          string
    WalletID        string
    Protocol        string
    ChainID         *int
    AlertType       string  // "health_factor" | "price_change"
    Threshold       float64
    Direction       string  // "below" | "above" | "change_pct"
    TokenAddress    *string
    Active          bool
    LastTriggeredAt *time.Time
    CreatedAt       time.Time
}

type WalletWithRules struct {
    WalletID    string
    Address     string
    ChainFamily string
    Rules       []AlertRule
}

type AlertEvent struct {
    ID             string
    RuleID         string
    UserID         string
    Message        string
    ValueAtTrigger float64
    SentAt         time.Time
}
```

**File**: `services/monitor/internal/storage/alerts.go`
**Depends on**: Step 1 (for WalletWithRules shape awareness)
**Risk**: Low

---

## Step 3 — Alert evaluator (`internal/alerts/evaluator.go`)

**Action**: Create package `alerts` with a pure function (no DB, no I/O):

```go
type TriggeredRule struct {
    Rule    storage.AlertRule
    Message string
    Value   float64
}

func Evaluate(rules []storage.AlertRule, positions []protocols.Position) []TriggeredRule
```

Logic:
- For each rule where `alert_type == "health_factor"`:
  - Find matching position: `position.Protocol == rule.Protocol && (rule.ChainID == nil || position.ChainID == *rule.ChainID)`
  - If no matching position: skip
  - Check direction: `"below"` → trigger if `position.HealthFactor < rule.Threshold`; `"above"` → trigger if `position.HealthFactor > rule.Threshold`
  - Check cooldown: skip if `rule.LastTriggeredAt != nil && time.Since(*rule.LastTriggeredAt) < 30*time.Minute`
  - If triggered: append `TriggeredRule{Rule: rule, Message: fmt.Sprintf(...)`, Value: position.HealthFactor}`
- `price_change`: skip (return nothing) with a TODO comment
- Return all triggered rules

**File**: `services/monitor/internal/alerts/evaluator.go`
**Depends on**: Step 2 (storage.AlertRule type)
**Risk**: Low — pure function, easily unit-tested

---

## Step 4 — Expo push client (`internal/notifications/expo.go`)

**Action**: Create package `notifications`:

```go
type PushClient struct {
    httpClient *http.Client
}

func NewPushClient() *PushClient

type PushMessage struct {
    To    string `json:"to"`
    Title string `json:"title"`
    Body  string `json:"body"`
    Data  map[string]string `json:"data,omitempty"`
}

type PushTicket struct {
    Status  string `json:"status"`   // "ok" | "error"
    Message string `json:"message,omitempty"`
    Details struct {
        Error string `json:"error,omitempty"` // "DeviceNotRegistered"
    } `json:"details,omitempty"`
}

func (c *PushClient) SendPush(ctx context.Context, messages []PushMessage) ([]PushTicket, error)
```

Implementation details:
- Endpoint: `https://exp.host/--/api/v2/push/send`
- Batch size: split into chunks of 100
- Request: `POST` with `Content-Type: application/json`, body is `[]PushMessage`
- Response: `{ "data": []PushTicket }`
- On 5xx: single retry after 1s
- Return tickets to caller — caller checks for `DeviceNotRegistered` and calls `storage.MarkPushTokenInactive`

**File**: `services/monitor/internal/notifications/expo.go`
**Depends on**: nothing
**Risk**: Low

---

## Step 5 — Monitor engine (`internal/monitor/engine.go`)

**Action**: Create package `monitor`:

```go
type Engine struct {
    db           *pgxpool.Pool
    aave         protocols.EVMFetcher
    compound     protocols.EVMFetcher
    marginfi     protocols.SolanaFetcher
    solend       protocols.SolanaFetcher
    pushClient   *notifications.PushClient
    pollInterval time.Duration
    mu           sync.Mutex
    goroutines   map[string]context.CancelFunc
}

func NewEngine(db, aave, compound, marginfi, solend, pushClient, interval) *Engine

// Start launches the engine's main scheduling loop in a background goroutine.
// Call once from main.go. Blocks until ctx is cancelled.
func (e *Engine) Start(ctx context.Context)
```

Poll cycle (run every 60s):
1. `storage.GetWalletsWithActiveRules` — get all wallets that need monitoring
2. For each wallet, launch a goroutine (bounded via semaphore or errgroup):
   a. Fetch positions (dispatch by `chain_family`)
   b. `storage.UpsertPositions` — keep position cache fresh
   c. `alerts.Evaluate(wallet.Rules, positions)` — get triggered rules
   d. For each triggered rule:
      - `storage.GetExpoPushToken(userID)`
      - Build `PushMessage` with HF value in body
      - `pushClient.SendPush`
      - If ticket has `DeviceNotRegistered`: `storage.MarkPushTokenInactive`
      - `storage.MarkRuleTriggered(ruleID)` — update cooldown
      - `storage.InsertAlertEvent` — write history row
3. Goroutine panics are recovered and logged (never crash the engine)

**File**: `services/monitor/internal/monitor/engine.go`
**Depends on**: Steps 2, 3, 4
**Risk**: Medium — concurrent goroutine management, handle errors without crashing

---

## Step 6 — Alerts API handler (`internal/api/alerts.go`)

**Action**: Create `AlertsHandler` struct (separate from `Handler` and `PositionsHandler`):

```go
type AlertsHandler struct {
    db *pgxpool.Pool
}

func NewAlertsHandler(db *pgxpool.Pool) *AlertsHandler
func (h *AlertsHandler) CreateAlert(w http.ResponseWriter, r *http.Request)
func (h *AlertsHandler) GetAlerts(w http.ResponseWriter, r *http.Request)
func (h *AlertsHandler) DeleteAlert(w http.ResponseWriter, r *http.Request)
func (h *AlertsHandler) GetAlertHistory(w http.ResponseWriter, r *http.Request)
```

Endpoints:
- `POST /alerts` — decode body → `storage.CreateAlertRule` → 201 + created rule JSON
- `GET /alerts/{userId}` — `storage.GetAlertRulesByUserID` → 200 + `{ "alerts": [...] }`
- `DELETE /alerts/{alertId}` — `storage.DeleteAlertRule` → 204
- `GET /alerts/{userId}/history` — `storage.GetAlertEventsByUserID(userID, 50)` → 200 + `{ "events": [...] }`

JSON field names: camelCase to match TypeScript types.

**File**: `services/monitor/internal/api/alerts.go`
**Depends on**: Step 2
**Risk**: Low

---

## Step 7 — Wire everything in `main.go`

**Action**: Update `services/monitor/cmd/server/main.go`:

1. Instantiate `notifications.NewPushClient()`
2. Instantiate `monitor.NewEngine(db, aave, compound, marginfi, solend, pushClient, 60*time.Second)`
3. Start engine: `go engine.Start(ctx)` where `ctx` is cancelled on SIGTERM/SIGINT
4. Instantiate `AlertsHandler` and register routes:
   ```go
   ah := api.NewAlertsHandler(db)
   router.Post("/alerts", ah.CreateAlert)
   router.Get("/alerts/{userId}", ah.GetAlerts)
   router.Delete("/alerts/{alertId}", ah.DeleteAlert)
   router.Get("/alerts/{userId}/history", ah.GetAlertHistory)
   ```

**File**: `services/monitor/cmd/server/main.go`
**Depends on**: Steps 4, 5, 6
**Risk**: Low

---

## Step 8 — Mobile: types + API functions

**Action**:

1. **`store/types.ts`** — add `AlertEvent` type:
   ```typescript
   export interface AlertEvent {
     id: string;
     ruleId: string;
     userId: string;
     message: string;
     valueAtTrigger: number;
     sentAt: string;
   }
   ```

2. **`services/api.ts`** — add 4 functions:
   ```typescript
   export async function createAlert(rule: Omit<AlertRule, 'id' | 'createdAt' | 'active'>): Promise<AlertRule>
   export async function getAlerts(userId: string): Promise<AlertRule[]>
   export async function deleteAlert(alertId: string): Promise<void>
   export async function getAlertHistory(userId: string): Promise<AlertEvent[]>
   ```

3. **`store/index.ts`** — add `alerts: AlertRule[]`, `setAlerts`, and `removeAlert` (already exists per current code).

**Files**: `apps/mobile/store/types.ts`, `apps/mobile/services/api.ts`, `apps/mobile/store/index.ts`
**Depends on**: Step 6 (backend must exist)
**Risk**: Low

---

## Step 9 — Mobile: alerts screen (`app/(tabs)/alerts.tsx`)

**Action**: Replace placeholder with full screen:
- On mount: fetch `getAlerts(userId)` → `setAlerts`
- List existing rules: protocol, direction, threshold, delete button
- "Create Alert" button opens an inline form (no modal library):
  - Select wallet (from `wallets` store)
  - Select protocol
  - Select direction (`below` / `above`)
  - Enter threshold (numeric TextInput)
  - Submit → `createAlert(...)` → `addAlert(created)`
- Delete: swipe or trash icon → `deleteAlert(id)` → `removeAlert(id)`
- All styles via `StyleSheet.create()`, no inline styles

**File**: `apps/mobile/app/(tabs)/alerts.tsx`
**Depends on**: Step 8
**Risk**: Low

---

## Testing Strategy

### Evaluator unit tests (`internal/alerts/evaluator_test.go`)
- HF below threshold → triggers
- HF above threshold, direction=below → does not trigger
- HF within cooldown window → does not trigger
- HF after cooldown expired → triggers
- No matching position → skips rule
- Multiple rules, some trigger, some don't
- price_change rule → never triggers (stub)
- Threshold boundary (exactly equal) — define and test
- Multiple positions, only matching protocol fires

### Push client tests (`internal/notifications/expo_test.go`)
- Successful send returns tickets
- Batching: 101 messages → 2 HTTP requests
- 5xx response → retried once
- 5xx on retry → error returned
- DeviceNotRegistered in ticket → returned in ticket slice
- Network error → error propagated

### Storage integration tests (`internal/storage/alerts_test.go`)
- CreateAlertRule round-trips correctly
- GetAlertRulesByUserID returns only that user's rules
- GetAlertRulesByWalletID filters by wallet
- DeleteAlertRule removes row; subsequent get returns nothing
- GetWalletsWithActiveRules: wallet with active rule appears; wallet with inactive rule does not
- MarkRuleTriggered updates last_triggered_at
- InsertAlertEvent + GetAlertEventsByUserID — event appears in history
- GetExpoPushToken — returns token for known user
- MarkPushTokenInactive — token lookup returns error/not found after mark

### Engine integration test (`internal/monitor/engine_test.go`)
- Single poll cycle with mock clients: position fetched, rule triggered, push sent, event recorded, cooldown set

---

## Success Criteria

- [ ] `POST /alerts` creates a rule and returns 201 with valid JSON
- [ ] `GET /alerts/:userId` returns all rules for that user
- [ ] `DELETE /alerts/:alertId` returns 204 and rule is gone
- [ ] `GET /alerts/:userId/history` returns event list (may be empty)
- [ ] Monitor engine starts without error on `make dev`
- [ ] Engine polls wallets with active rules on 60s tick (verify via log output)
- [ ] When HF drops below threshold: push ticket is created (verify with Expo sandbox token)
- [ ] When HF is above threshold after `below` rule: no push fired
- [ ] 30min cooldown: second trigger within window is suppressed (unit test verifies)
- [ ] `DeviceNotRegistered` ticket causes token to be marked inactive in DB
- [ ] `go test ./...` passes
- [ ] Mobile alerts screen loads existing rules on mount
- [ ] Create alert form submits and new rule appears in list
- [ ] Delete alert removes rule from list
- [ ] No `any` types in TypeScript
- [ ] No inline styles in React Native components
- [ ] Alert history API returns events in descending `sent_at` order
- [ ] Engine goroutine panic is recovered and logged (unit test with panic-inducing mock)
- [ ] Engine does not poll wallets with zero active rules
- [ ] `make dev` + `make migrate` works cleanly end to end

---

## Review

_To be filled after implementation._
