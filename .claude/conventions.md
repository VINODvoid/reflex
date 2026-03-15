# REFLEX — Code Conventions

## Go (Backend)

### Package Layout
```
cmd/server/main.go          → entry point only: wire deps, start server
internal/api/               → HTTP handlers, request/response types
internal/chains/            → low-level RPC clients (EVM, Solana)
internal/protocols/         → protocol-specific position fetching
internal/monitor/           → polling engine, goroutine management
internal/alerts/            → rule evaluation logic (pure functions)
internal/notifications/     → Expo push API client
internal/storage/           → DB queries, migrations
```

### Naming
- Exported types: `PascalCase` — `HealthFactor`, `AlertRule`, `WalletID`
- Private functions: `camelCase` — `fetchPositions`, `evaluateRule`
- Constants: `ALL_CAPS` only for truly global constants (avoid); prefer typed consts
- Test files: `_test.go` suffix, same package (internal tests) or `_test` suffix package (black-box)
- DB columns use `snake_case` — map with struct tags: `db:"health_factor"`

### Error Handling
```go
// Always wrap errors with context
if err != nil {
    return fmt.Errorf("aave: fetch health factor for %s: %w", address, err)
}

// HTTP handlers: never panic, always respond with JSON error
func (h *Handler) handleGetPositions(w http.ResponseWriter, r *http.Request) {
    positions, err := h.protocols.FetchAll(r.Context(), walletID)
    if err != nil {
        respondError(w, http.StatusInternalServerError, err.Error())
        return
    }
    respondJSON(w, http.StatusOK, positions)
}
```

### Dependency Injection
```go
// Always inject via struct, never use init() or package-level vars
type AaveClient struct {
    rpcClient *ethclient.Client
    chainID   int64
}

func NewAaveClient(rpc *ethclient.Client, chainID int64) *AaveClient {
    return &AaveClient{rpcClient: rpc, chainID: chainID}
}
```

### Context
- Every function doing I/O takes `ctx context.Context` as first parameter
- Pass `ctx` down, never store it in structs
- Set timeouts on RPC calls: `ctx, cancel := context.WithTimeout(ctx, 10*time.Second)`

### Database (pgx/v5)
```go
// Named queries — use pgx NamedArgs or positional $1, $2
row := pool.QueryRow(ctx,
    "SELECT id, address FROM wallets WHERE user_id = $1",
    userID)

// Scanning
var w Wallet
err := row.Scan(&w.ID, &w.Address)

// No ORM. No magic. Just SQL.
```

### HTTP Responses
```go
func respondJSON(w http.ResponseWriter, status int, data any) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, msg string) {
    respondJSON(w, status, map[string]string{"error": msg})
}
```

---

## TypeScript (Mobile)

### File Naming
```
components/PositionCard.tsx     → PascalCase for components
hooks/usePositions.ts           → camelCase, "use" prefix for hooks
services/api.ts                 → camelCase for services/utils
store/index.ts                  → store root
app/(tabs)/index.tsx            → Expo Router screens (default export required)
```

### Exports
```ts
// Named exports everywhere EXCEPT Expo Router screens
export function PositionCard({ ... }: PositionCardProps) { ... }
export function usePositions() { ... }

// Expo Router screens: default export
export default function Dashboard() { ... }
```

### Types — No `any`
```ts
// Always define types. Never use `any`.
interface Position {
  protocol: 'aave_v3' | 'compound_v3' | 'marginfi' | 'solend'
  chainId: number | null
  healthFactor: number
  collateralUsd: number
  debtUsd: number
}

// API responses always typed
interface ApiResponse<T> {
  data: T
  error?: string
}
```

### Styles
```ts
// StyleSheet.create() always — no inline objects
const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
})
```

### API Calls — Only in `services/api.ts`
```ts
// services/api.ts
export async function getPositions(walletId: string): Promise<Position[]> {
  const res = await fetch(`${API_URL}/positions/${walletId}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// Components fetch via hooks, not directly
export function usePositions(walletId: string) {
  const [positions, setPositions] = useState<Position[]>([])
  useEffect(() => {
    getPositions(walletId).then(setPositions).catch(console.error)
  }, [walletId])
  return positions
}
```

### Zustand Store
```ts
// Flat slices — one concern per slice
interface WalletSlice {
  wallets: Wallet[]
  addWallet: (wallet: Wallet) => void
  removeWallet: (id: string) => void
}

// No derived state in store — compute in selectors or hooks
```

---

## Git

- Package manager: **Bun** — use `bun install`, `bun add`, `bunx expo` everywhere. Never use npm or yarn.
- Branch naming: `feat/phase-N-description`, `fix/short-description`
- Commit format: `feat(aave): add health factor polling` (conventional commits)
- Never commit `.env` files — `.gitignore` must cover them
- One concern per commit — don't bundle unrelated changes

---

## Testing

### Go
- Table-driven tests for pure functions (evaluator, parsers)
- Integration tests use real postgres via Docker (no mocks for DB)
- RPC calls: mock the interface, not the concrete type
- File: `internal/alerts/evaluator_test.go`

### TypeScript
- Component tests: React Native Testing Library
- Store tests: test state transitions directly
- No snapshot tests — they break too easily and catch nothing meaningful
