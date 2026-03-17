package compound

import (
	"math/big"
	"testing"
)

func TestHealthFactorCalculation(t *testing.T) {
	tests := []struct {
		name            string
		collateralUSD   float64
		debtUSD         float64
		wantHealthy     bool // HF > 1.0
	}{
		{
			name:          "healthy position",
			collateralUSD: 15000.0,
			debtUSD:       10000.0,
			wantHealthy:   true,
		},
		{
			name:          "undercollateralised",
			collateralUSD: 8000.0,
			debtUSD:       10000.0,
			wantHealthy:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hf := tt.collateralUSD / tt.debtUSD
			isHealthy := hf > 1.0
			if isHealthy != tt.wantHealthy {
				t.Errorf("HF=%v, wantHealthy=%v", hf, tt.wantHealthy)
			}
		})
	}
}

func TestCollateralFactorScaling(t *testing.T) {
	// liquidateCollateralFactor of 0.9 is stored as 900000000000000000 (1e18 scale).
	raw := new(big.Int)
	raw.SetString("900000000000000000", 10)

	got, _ := new(big.Float).Quo(
		new(big.Float).SetInt(raw),
		collateralFactorScale,
	).Float64()

	want := 0.9
	if got != want {
		t.Errorf("collateral factor: got %v, want %v", got, want)
	}
}
