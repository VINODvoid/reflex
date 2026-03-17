// Package protocols defines shared types used across all lending protocol clients.
package protocols

// Position represents a single lending position fetched from an on-chain protocol.
// It is an in-memory transfer object — not a DB model.
type Position struct {
	WalletID      string
	Protocol      string
	ChainID       int
	HealthFactor  float64
	CollateralUSD float64
	DebtUSD       float64
}
