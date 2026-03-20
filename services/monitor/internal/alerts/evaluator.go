// Package alerts implements alert rule evaluation logic.
package alerts

import (
	"fmt"
	"math"
	"time"

	"reflex/services/monitor/internal/protocols"
	"reflex/services/monitor/internal/storage"
)

const cooldownDuration = 30 * time.Minute

// TriggeredRule pairs a fired alert rule with its notification content.
type TriggeredRule struct {
	Rule    storage.AlertRule
	Message string
	Value   float64
}

// Evaluate checks each rule against the current positions and prices, returning all triggered rules.
// It is a pure function — no I/O, no DB access.
//
// currentPrices maps token address (original case) → current USD price.
// Pass an empty map when there are no price_change rules to evaluate.
//
// A rule triggers when:
//   - The matching position's metric crosses the threshold in the configured direction.
//   - The rule's 30-minute cooldown has expired (or has never been triggered).
//
// price_change / change_pct rules with nil LastPriceChecked are skipped here;
// the engine seeds the price before calling Evaluate.
func Evaluate(rules []storage.AlertRule, positions []protocols.Position, currentPrices map[string]float64) []TriggeredRule {
	var triggered []TriggeredRule

	for _, rule := range rules {
		if !rule.Active {
			continue
		}

		switch rule.AlertType {
		case "health_factor":
			if t, ok := evaluateHealthFactor(rule, positions); ok {
				triggered = append(triggered, t)
			}
		case "price_change":
			if t, ok := evaluatePriceChange(rule, currentPrices); ok {
				triggered = append(triggered, t)
			}
		}
	}

	return triggered
}

func evaluateHealthFactor(rule storage.AlertRule, positions []protocols.Position) (TriggeredRule, bool) {
	pos := findPosition(rule, positions)
	if pos == nil {
		return TriggeredRule{}, false
	}

	if !thresholdCrossed(rule.Direction, pos.HealthFactor, rule.Threshold) {
		return TriggeredRule{}, false
	}

	if !cooldownExpired(rule.LastTriggeredAt) {
		return TriggeredRule{}, false
	}

	msg := fmt.Sprintf(
		"%s health factor is %.2f (threshold: %s %.2f)",
		rule.Protocol, pos.HealthFactor, rule.Direction, rule.Threshold,
	)

	return TriggeredRule{
		Rule:    rule,
		Message: msg,
		Value:   pos.HealthFactor,
	}, true
}

func evaluatePriceChange(rule storage.AlertRule, currentPrices map[string]float64) (TriggeredRule, bool) {
	if rule.TokenAddress == nil {
		return TriggeredRule{}, false
	}

	price, ok := currentPrices[*rule.TokenAddress]
	if !ok {
		return TriggeredRule{}, false
	}

	if !cooldownExpired(rule.LastTriggeredAt) {
		return TriggeredRule{}, false
	}

	switch rule.Direction {
	case "below":
		if price >= rule.Threshold {
			return TriggeredRule{}, false
		}
		msg := fmt.Sprintf("token price $%.2f is below threshold $%.2f", price, rule.Threshold)
		return TriggeredRule{Rule: rule, Message: msg, Value: price}, true

	case "above":
		if price <= rule.Threshold {
			return TriggeredRule{}, false
		}
		msg := fmt.Sprintf("token price $%.2f is above threshold $%.2f", price, rule.Threshold)
		return TriggeredRule{Rule: rule, Message: msg, Value: price}, true

	case "change_pct":
		// Nil LastPriceChecked means the engine hasn't seeded a baseline yet.
		// The engine skips these rules before calling Evaluate.
		if rule.LastPriceChecked == nil {
			return TriggeredRule{}, false
		}
		changePct := math.Abs((price-*rule.LastPriceChecked) / *rule.LastPriceChecked * 100)
		if changePct < rule.Threshold {
			return TriggeredRule{}, false
		}
		upOrDown := "up"
		if price < *rule.LastPriceChecked {
			upOrDown = "down"
		}
		msg := fmt.Sprintf(
			"token price moved %s %.1f%% (was $%.2f, now $%.2f)",
			upOrDown, changePct, *rule.LastPriceChecked, price,
		)
		return TriggeredRule{Rule: rule, Message: msg, Value: price}, true
	}

	return TriggeredRule{}, false
}

// findPosition returns the first position matching the rule's protocol and optional chain ID.
func findPosition(rule storage.AlertRule, positions []protocols.Position) *protocols.Position {
	for i := range positions {
		p := &positions[i]
		if p.Protocol != rule.Protocol {
			continue
		}
		if rule.ChainID != nil && p.ChainID != *rule.ChainID {
			continue
		}
		return p
	}
	return nil
}

// thresholdCrossed returns true when the value has crossed the threshold in the given direction.
func thresholdCrossed(direction string, value, threshold float64) bool {
	switch direction {
	case "below":
		return value < threshold
	case "above":
		return value > threshold
	}
	return false
}

// cooldownExpired returns true when enough time has passed since the rule last fired.
func cooldownExpired(lastTriggeredAt *time.Time) bool {
	if lastTriggeredAt == nil {
		return true
	}
	return time.Since(*lastTriggeredAt) >= cooldownDuration
}
