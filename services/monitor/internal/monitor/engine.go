// Package monitor implements the background position polling and alert engine.
package monitor

import (
	"context"
	"log"
	"sync"
	"time"

	"reflex/services/monitor/internal/alerts"
	"reflex/services/monitor/internal/notifications"
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
	pollInterval time.Duration
}

// NewEngine constructs an Engine with the given dependencies.
func NewEngine(
	db *pgxpool.Pool,
	aave, compound, marginfi, solend protocols.Fetcher,
	pushClient *notifications.PushClient,
	pollInterval time.Duration,
) *Engine {
	return &Engine{
		db:           db,
		aave:         aave,
		compound:     compound,
		marginfi:     marginfi,
		solend:       solend,
		pushClient:   pushClient,
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

	triggered := alerts.Evaluate(w.Rules, positions)
	for _, t := range triggered {
		e.fireAlert(ctx, t, w.UserID)
	}
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
		Data:  map[string]string{"ruleId": t.Rule.ID, "protocol": t.Rule.Protocol},
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

	if err := storage.InsertAlertEvent(ctx, e.db, storage.AlertEvent{
		RuleID:         t.Rule.ID,
		UserID:         userID,
		Message:        t.Message,
		ValueAtTrigger: t.Value,
	}); err != nil {
		log.Printf("engine: insert alert event for rule %s: %v", t.Rule.ID, err)
	}
}
