// Package monitor implements the background position polling and alert engine.
package monitor

import (
	"context"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	"reflex/services/monitor/internal/alerts"
	"reflex/services/monitor/internal/notifications"
	"reflex/services/monitor/internal/prices"
	"reflex/services/monitor/internal/protocols"
	"reflex/services/monitor/internal/storage"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Engine polls wallets with active alert rules and fires push notifications when
// rules are triggered. Each poll cycle runs all wallets concurrently.
type Engine struct {
	db           *pgxpool.Pool
	aave         protocols.Fetcher
	compound     protocols.Fetcher
	marginfi     protocols.Fetcher
	solend       protocols.Fetcher
	pushClient   *notifications.PushClient
	priceClient  *prices.Client
	pollInterval time.Duration
}

// NewEngine constructs an Engine with the given dependencies.
func NewEngine(
	db *pgxpool.Pool,
	aave, compound, marginfi, solend protocols.Fetcher,
	pushClient *notifications.PushClient,
	priceClient *prices.Client,
	pollInterval time.Duration,
) *Engine {
	return &Engine{
		db:           db,
		aave:         aave,
		compound:     compound,
		marginfi:     marginfi,
		solend:       solend,
		pushClient:   pushClient,
		priceClient:  priceClient,
		pollInterval: pollInterval,
	}
}

// Start runs the engine's poll loop. It polls immediately on start, then on every tick.
// Blocks until ctx is cancelled.
func (e *Engine) Start(ctx context.Context) {
	log.Printf("engine: starting with %s poll interval", e.pollInterval)
	e.pollOnce(ctx)

	ticker := time.NewTicker(e.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("engine: stopping")
			return
		case <-ticker.C:
			e.pollOnce(ctx)
		}
	}
}

// pollOnce fetches positions and evaluates rules for every wallet with an active rule.
func (e *Engine) pollOnce(ctx context.Context) {
	wallets, err := storage.GetWalletsWithActiveRules(ctx, e.db)
	if err != nil {
		log.Printf("engine: get wallets: %v", err)
		return
	}

	if len(wallets) == 0 {
		return
	}

	log.Printf("engine: polling %d wallet(s)", len(wallets))

	var wg sync.WaitGroup
	for _, w := range wallets {
		wg.Add(1)
		go func(w storage.WalletWithRules) {
			defer wg.Done()
			defer func() {
				if rec := recover(); rec != nil {
					log.Printf("engine: panic for wallet %s: %v", w.WalletID, rec)
				}
			}()
			e.pollWallet(ctx, w)
		}(w)
	}
	wg.Wait()
}

// pollWallet fetches positions for one wallet, evaluates its rules, and fires alerts.
func (e *Engine) pollWallet(ctx context.Context, w storage.WalletWithRules) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	positions := e.fetchPositions(ctx, w)

	if err := storage.UpsertPositions(ctx, e.db, positions); err != nil {
		// Log but continue — stale cache is not fatal for alerting.
		log.Printf("engine: upsert positions for wallet %s: %v", w.WalletID, err)
	}

	// Seed price_change rules that have no baseline yet — do not pass to Evaluate.
	currentPrices := e.seedAndFetchPrices(ctx, w.Rules)

	triggered := alerts.Evaluate(w.Rules, positions, currentPrices)
	for _, t := range triggered {
		e.fireAlert(ctx, t, w.UserID)
	}
}

// seedAndFetchPrices handles price_change rules:
//   - Rules with nil LastPriceChecked are seeded with the current price (no alert fires).
//   - Returns a map of lowercase token address → USD price for all remaining price_change rules.
func (e *Engine) seedAndFetchPrices(ctx context.Context, rules []storage.AlertRule) map[string]float64 {
	var toFetch []storage.AlertRule
	for _, r := range rules {
		if r.AlertType != "price_change" || r.TokenAddress == nil {
			continue
		}
		if r.LastPriceChecked == nil {
			// Seed the baseline; don't add to toFetch so Evaluate skips it.
			e.seedPrice(ctx, r)
			continue
		}
		toFetch = append(toFetch, r)
	}
	if len(toFetch) == 0 {
		return map[string]float64{}
	}
	return e.fetchCurrentPrices(ctx, toFetch)
}

// seedPrice fetches the current price for a rule and stores it as the baseline.
func (e *Engine) seedPrice(ctx context.Context, rule storage.AlertRule) {
	coinID, ok := prices.TokenToCoinGeckoID(*rule.TokenAddress)
	if !ok {
		log.Printf("engine: unknown token for seeding rule %s: %s", rule.ID, *rule.TokenAddress)
		return
	}
	priceMap, err := e.priceClient.GetUSDPrices(ctx, []string{coinID})
	if err != nil {
		log.Printf("engine: seed price fetch for rule %s: %v", rule.ID, err)
		return
	}
	p, ok := priceMap[coinID]
	if !ok {
		return
	}
	if err := storage.UpdateLastPriceChecked(ctx, e.db, rule.ID, p); err != nil {
		log.Printf("engine: seed UpdateLastPriceChecked for rule %s: %v", rule.ID, err)
	} else {
		log.Printf("engine: seeded price %.4f for rule %s", p, rule.ID)
	}
}

// fetchCurrentPrices batch-fetches USD prices for a set of price_change rules.
// Returns a map keyed by lowercase token address.
func (e *Engine) fetchCurrentPrices(ctx context.Context, rules []storage.AlertRule) map[string]float64 {
	// Collect unique token address → coinGecko ID pairs.
	addrToID := make(map[string]string)
	for _, r := range rules {
		addr := strings.ToLower(*r.TokenAddress)
		if _, alreadyMapped := addrToID[addr]; alreadyMapped {
			continue
		}
		coinID, ok := prices.TokenToCoinGeckoID(addr)
		if !ok {
			log.Printf("engine: unknown token address %s for rule %s", addr, r.ID)
			continue
		}
		addrToID[addr] = coinID
	}

	if len(addrToID) == 0 {
		return map[string]float64{}
	}

	coinIDs := make([]string, 0, len(addrToID))
	for _, id := range addrToID {
		coinIDs = append(coinIDs, id)
	}

	idToPrice, err := e.priceClient.GetUSDPrices(ctx, coinIDs)
	if err != nil {
		log.Printf("engine: fetchCurrentPrices: %v", err)
		return map[string]float64{}
	}

	// Build address-keyed map for evaluator.
	result := make(map[string]float64, len(addrToID))
	for addr, id := range addrToID {
		if p, ok := idToPrice[id]; ok {
			result[addr] = p
		}
	}
	return result
}

// fetchPositions dispatches to EVM or Solana protocol clients based on chain family.
// Fetchers run concurrently. A failure in one fetcher is logged but does not cancel
// the others — partial results are returned so rules on healthy protocols still evaluate.
func (e *Engine) fetchPositions(ctx context.Context, w storage.WalletWithRules) []protocols.Position {
	var fetchers []protocols.Fetcher

	switch w.ChainFamily {
	case "evm":
		fetchers = []protocols.Fetcher{e.aave, e.compound}
	case "solana":
		fetchers = []protocols.Fetcher{e.marginfi, e.solend}
	default:
		return nil
	}

	var (
		mu  sync.Mutex
		all []protocols.Position
		wg  sync.WaitGroup
	)

	for _, f := range fetchers {
		f := f
		wg.Add(1)
		go func() {
			defer wg.Done()
			pos, err := f.FetchPositions(ctx, w.WalletID, w.Address)
			if err != nil {
				log.Printf("engine: fetcher error for wallet %s: %v", w.WalletID, err)
				return
			}
			mu.Lock()
			all = append(all, pos...)
			mu.Unlock()
		}()
	}

	wg.Wait()
	return all
}

// buildPushData constructs the notification data map for a triggered alert rule.
// chainId is omitted when nil (Solana protocols have no chain ID).
func buildPushData(rule storage.AlertRule) map[string]string {
	data := map[string]string{
		"ruleId":   rule.ID,
		"walletId": rule.WalletID,
		"protocol": rule.Protocol,
	}
	if rule.ChainID != nil {
		data["chainId"] = strconv.Itoa(*rule.ChainID)
	}
	return data
}

// fireAlert sends a push notification for a triggered rule, records the event,
// and updates the rule's cooldown timestamp.
func (e *Engine) fireAlert(ctx context.Context, t alerts.TriggeredRule, userID string) {
	token, err := storage.GetExpoPushToken(ctx, e.db, userID)
	if err != nil {
		log.Printf("engine: get push token for user %s: %v", userID, err)
		return
	}
	if token == "" {
		return
	}

	tickets, err := e.pushClient.SendPush(ctx, []notifications.PushMessage{{
		To:    token,
		Title: "REFLEX Alert",
		Body:  t.Message,
		Data:  buildPushData(t.Rule),
	}})
	if err != nil {
		log.Printf("engine: send push for rule %s: %v", t.Rule.ID, err)
		// Do not mark triggered or record an event — the notification was never delivered.
		return
	}

	for _, ticket := range tickets {
		if ticket.Status == "error" && ticket.Details.Error == "DeviceNotRegistered" {
			if err := storage.MarkPushTokenInactive(ctx, e.db, token); err != nil {
				log.Printf("engine: mark push token inactive: %v", err)
			}
		}
	}

	if err := storage.MarkRuleTriggered(ctx, e.db, t.Rule.ID); err != nil {
		log.Printf("engine: mark rule triggered %s: %v", t.Rule.ID, err)
	}

	// Advance the price baseline for change_pct rules so the next cycle measures
	// from the price at which this alert fired, not from the original seed.
	if t.Rule.AlertType == "price_change" {
		if err := storage.UpdateLastPriceChecked(ctx, e.db, t.Rule.ID, t.Value); err != nil {
			log.Printf("engine: update last price checked for rule %s: %v", t.Rule.ID, err)
		}
	}

	if err := storage.InsertAlertEvent(ctx, e.db, storage.AlertEvent{
		RuleID:         t.Rule.ID,
		UserID:         userID,
		Message:        t.Message,
		ValueAtTrigger: t.Value,
	}); err != nil {
		log.Printf("engine: insert alert event for rule %s: %v", t.Rule.ID, err)
	}
}
