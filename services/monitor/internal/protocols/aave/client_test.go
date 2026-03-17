package aave

import (
	"math/big"
	"testing"
)

func TestParseHealthFactor(t *testing.T) {
	tests := []struct {
		name     string
		raw      string // raw uint256 value as decimal string
		wantHF   float64
		wantSkip bool // true if totalDebtBase is zero
	}{
		{
			name:   "healthy position (1.5)",
			raw:    "1500000000000000000",
			wantHF: 1.5,
		},
		{
			name:   "at-risk position (1.05)",
			raw:    "1050000000000000000",
			wantHF: 1.05,
		},
		{
			name:   "safe position (2.0)",
			raw:    "2000000000000000000",
			wantHF: 2.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			raw := new(big.Int)
			raw.SetString(tt.raw, 10)

			got, _ := new(big.Float).Quo(
				new(big.Float).SetInt(raw),
				healthFactorScale,
			).Float64()

			if got != tt.wantHF {
				t.Errorf("health factor: got %v, want %v", got, tt.wantHF)
			}
		})
	}
}
