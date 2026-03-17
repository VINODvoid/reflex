// Package protocols defines shared types used across all lending protocol clients.
package protocols

// Position represents a single lending position fetched from an on-chain protocol.
// It is an in-memory transfer object — not a DB model.
type Position struct {
	WalletID      string  `json:"walletId"`
	Protocol      string  `json:"protocol"`
	ChainID       int     `json:"chainId"`
	HealthFactor  float64 `json:"healthFactor"`
	CollateralUSD float64 `json:"collateralUsd"`
	DebtUSD       float64 `json:"debtUsd"`
}
