// Package alerts implements alert rule evaluation logic.
package alerts

import (
	"fmt"
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

// Evaluate checks each rule against the current positions and returns all triggered rules.
// It is a pure function — no I/O, no DB access.
//
// A rule triggers when:
//   - The matching position's metric crosses the threshold in the configured direction.
//   - The rule's 30-minute cooldown has expired (or has never been triggered).
//
// price_change alert type is not yet implemented and is always skipped.
func Evaluate(rules []storage.AlertRule, positions []protocols.Position) []TriggeredRule {
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
			// TODO: implement price_change alerts in Phase 5.
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
