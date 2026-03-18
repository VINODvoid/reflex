package storage

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AlertRule mirrors the alert_rules table.
type AlertRule struct {
	ID              string
	UserID          string
	WalletID        string
	Protocol        string
	ChainID         *int
	AlertType       string
	Threshold       float64
	Direction       string
	TokenAddress      *string
	Active            bool
	LastTriggeredAt   *time.Time
	LastPriceChecked  *float64
	CreatedAt         time.Time
}

// WalletWithRules groups a wallet with its active alert rules.
// Used by the monitor engine to decide what to poll.
type WalletWithRules struct {
	WalletID    string
	UserID      string
	Address     string
	ChainFamily string
	Rules       []AlertRule
}

// AlertEvent mirrors the alert_events table.
type AlertEvent struct {
	ID             string
	RuleID         string
	UserID         string
	Message        string
	ValueAtTrigger float64
	SentAt         time.Time
}

// CreateAlertRule inserts a new alert rule and returns the created record.
func CreateAlertRule(ctx context.Context, db *pgxpool.Pool, rule AlertRule) (AlertRule, error) {
	row := db.QueryRow(ctx,
		`INSERT INTO alert_rules (user_id, wallet_id, protocol, chain_id, alert_type, threshold, direction, token_address)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 RETURNING id, user_id, wallet_id, protocol, chain_id, alert_type, threshold, direction,
		           token_address, active, last_triggered_at, last_price_checked, created_at`,
		rule.UserID, rule.WalletID, rule.Protocol, rule.ChainID,
		rule.AlertType, rule.Threshold, rule.Direction, rule.TokenAddress,
	)
	created, err := scanAlertRule(row)
	if err != nil {
		return AlertRule{}, fmt.Errorf("storage: create alert rule: %w", err)
	}
	return created, nil
}

// GetAlertRulesByUserID returns all alert rules for a user, newest first.
func GetAlertRulesByUserID(ctx context.Context, db *pgxpool.Pool, userID string) ([]AlertRule, error) {
	rows, err := db.Query(ctx,
		`SELECT id, user_id, wallet_id, protocol, chain_id, alert_type, threshold, direction,
		        token_address, active, last_triggered_at, last_price_checked, created_at
		 FROM alert_rules WHERE user_id = $1 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("storage: get alert rules by user: %w", err)
	}
	defer rows.Close()
	return collectAlertRules(rows)
}

// GetAlertRulesByWalletID returns all alert rules for a wallet, newest first.
func GetAlertRulesByWalletID(ctx context.Context, db *pgxpool.Pool, walletID string) ([]AlertRule, error) {
	rows, err := db.Query(ctx,
		`SELECT id, user_id, wallet_id, protocol, chain_id, alert_type, threshold, direction,
		        token_address, active, last_triggered_at, last_price_checked, created_at
		 FROM alert_rules WHERE wallet_id = $1 ORDER BY created_at DESC`,
		walletID,
	)
	if err != nil {
		return nil, fmt.Errorf("storage: get alert rules by wallet: %w", err)
	}
	defer rows.Close()
	return collectAlertRules(rows)
}

// DeleteAlertRule removes an alert rule by ID, scoped to the owning user.
func DeleteAlertRule(ctx context.Context, db *pgxpool.Pool, ruleID, userID string) error {
	_, err := db.Exec(ctx, "DELETE FROM alert_rules WHERE id = $1 AND user_id = $2", ruleID, userID)
	if err != nil {
		return fmt.Errorf("storage: delete alert rule: %w", err)
	}
	return nil
}

// GetWalletsWithActiveRules returns all wallets that have at least one active rule,
// with their rules populated. Used by the monitor engine on each poll tick.
func GetWalletsWithActiveRules(ctx context.Context, db *pgxpool.Pool) ([]WalletWithRules, error) {
	rows, err := db.Query(ctx,
		`SELECT w.id, w.user_id, w.address, w.chain_family,
		        r.id, r.user_id, r.wallet_id, r.protocol, r.chain_id, r.alert_type,
		        r.threshold, r.direction, r.token_address, r.active, r.last_triggered_at, r.last_price_checked, r.created_at
		 FROM wallets w
		 JOIN alert_rules r ON r.wallet_id = w.id
		 WHERE r.active = TRUE
		 ORDER BY w.id`)
	if err != nil {
		return nil, fmt.Errorf("storage: get wallets with active rules: %w", err)
	}
	defer rows.Close()

	// Aggregate rules per wallet, preserving insertion order.
	walletMap := make(map[string]*WalletWithRules)
	var order []string

	for rows.Next() {
		var (
			walletID, userID, address, chainFamily string
			rule                                    AlertRule
		)
		if err := rows.Scan(
			&walletID, &userID, &address, &chainFamily,
			&rule.ID, &rule.UserID, &rule.WalletID, &rule.Protocol, &rule.ChainID, &rule.AlertType,
			&rule.Threshold, &rule.Direction, &rule.TokenAddress, &rule.Active, &rule.LastTriggeredAt, &rule.LastPriceChecked, &rule.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("storage: scan wallet with rules: %w", err)
		}

		if _, seen := walletMap[walletID]; !seen {
			walletMap[walletID] = &WalletWithRules{
				WalletID:    walletID,
				UserID:      userID,
				Address:     address,
				ChainFamily: chainFamily,
			}
			order = append(order, walletID)
		}
		walletMap[walletID].Rules = append(walletMap[walletID].Rules, rule)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("storage: iterate wallets with rules: %w", err)
	}

	result := make([]WalletWithRules, 0, len(order))
	for _, id := range order {
		result = append(result, *walletMap[id])
	}
	return result, nil
}

// MarkRuleTriggered updates the cooldown timestamp for a rule.
func MarkRuleTriggered(ctx context.Context, db *pgxpool.Pool, ruleID string) error {
	_, err := db.Exec(ctx, "UPDATE alert_rules SET last_triggered_at = NOW() WHERE id = $1", ruleID)
	if err != nil {
		return fmt.Errorf("storage: mark rule triggered: %w", err)
	}
	return nil
}

// InsertAlertEvent records a fired alert in the alert_events table.
func InsertAlertEvent(ctx context.Context, db *pgxpool.Pool, event AlertEvent) error {
	_, err := db.Exec(ctx,
		`INSERT INTO alert_events (rule_id, user_id, message, value_at_trigger)
		 VALUES ($1, $2, $3, $4)`,
		event.RuleID, event.UserID, event.Message, event.ValueAtTrigger,
	)
	if err != nil {
		return fmt.Errorf("storage: insert alert event: %w", err)
	}
	return nil
}

// GetAlertEventsByUserID returns the most recent alert events for a user.
func GetAlertEventsByUserID(ctx context.Context, db *pgxpool.Pool, userID string, limit int) ([]AlertEvent, error) {
	rows, err := db.Query(ctx,
		`SELECT id, rule_id, user_id, message, value_at_trigger, sent_at
		 FROM alert_events WHERE user_id = $1
		 ORDER BY sent_at DESC LIMIT $2`,
		userID, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("storage: get alert events: %w", err)
	}
	defer rows.Close()

	var events []AlertEvent
	for rows.Next() {
		var e AlertEvent
		if err := rows.Scan(&e.ID, &e.RuleID, &e.UserID, &e.Message, &e.ValueAtTrigger, &e.SentAt); err != nil {
			return nil, fmt.Errorf("storage: scan alert event: %w", err)
		}
		events = append(events, e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("storage: iterate alert events: %w", err)
	}
	if events == nil {
		events = []AlertEvent{}
	}
	return events, nil
}

// GetExpoPushToken returns the active Expo push token for a user.
// Returns ("", nil) when the user has no active token — callers should treat this as a no-op.
func GetExpoPushToken(ctx context.Context, db *pgxpool.Pool, userID string) (string, error) {
	var token string
	err := db.QueryRow(ctx,
		"SELECT expo_push_token FROM users WHERE id = $1 AND token_active = TRUE",
		userID,
	).Scan(&token)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil
		}
		return "", fmt.Errorf("storage: get push token: %w", err)
	}
	return token, nil
}

// MarkPushTokenInactive disables future pushes for a device that returned DeviceNotRegistered.
func MarkPushTokenInactive(ctx context.Context, db *pgxpool.Pool, token string) error {
	_, err := db.Exec(ctx,
		"UPDATE users SET token_active = FALSE WHERE expo_push_token = $1",
		token,
	)
	if err != nil {
		return fmt.Errorf("storage: mark push token inactive: %w", err)
	}
	return nil
}

// UpdateLastPriceChecked records the most recent evaluated price for a price_change rule.
// Called by the engine after evaluation to seed and advance the change_pct baseline.
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

// --- internal helpers ---

// rowScanner abstracts pgx.Row and pgx.Rows for scanAlertRule.
type rowScanner interface {
	Scan(dest ...any) error
}

func scanAlertRule(row rowScanner) (AlertRule, error) {
	var r AlertRule
	if err := row.Scan(
		&r.ID, &r.UserID, &r.WalletID, &r.Protocol, &r.ChainID,
		&r.AlertType, &r.Threshold, &r.Direction, &r.TokenAddress,
		&r.Active, &r.LastTriggeredAt, &r.LastPriceChecked, &r.CreatedAt,
	); err != nil {
		return AlertRule{}, err
	}
	return r, nil
}

func collectAlertRules(rows pgx.Rows) ([]AlertRule, error) {
	var rules []AlertRule
	for rows.Next() {
		r, err := scanAlertRule(rows)
		if err != nil {
			return nil, fmt.Errorf("storage: scan alert rule: %w", err)
		}
		rules = append(rules, r)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("storage: iterate alert rules: %w", err)
	}
	if rules == nil {
		rules = []AlertRule{}
	}
	return rules, nil
}
