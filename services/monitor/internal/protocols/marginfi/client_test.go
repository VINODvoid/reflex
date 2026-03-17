package marginfi

import (
	"math"
	"math/big"
	"testing"
)

func TestI80F48ToFloat64(t *testing.T) {
	tests := []struct {
		name string
		val  float64
	}{
		{name: "one",         val: 1.0},
		{name: "one-point-five", val: 1.5},
		{name: "small fraction", val: 0.0001},
		{name: "large value",  val: 1_000_000.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			raw := float64ToI80F48(tt.val)
			got := raw.float64()
			if math.Abs(got-tt.val)/tt.val > 1e-9 {
				t.Errorf("i80f48(%v).float64() = %v, want %v", tt.val, got, tt.val)
			}
		})
	}
}

// float64ToI80F48 converts a float64 to an i80f48 for testing purposes.
// Uses big.Float arithmetic to avoid int64 overflow for large values.
func float64ToI80F48(f float64) i80f48 {
	scale := new(big.Float).SetInt(new(big.Int).Lsh(big.NewInt(1), 48))
	rawFloat := new(big.Float).Mul(new(big.Float).SetFloat64(f), scale)
	rawInt, _ := rawFloat.Int(nil)

	be := rawInt.Bytes() // big-endian, no leading zeros

	var b i80f48
	// Reverse big-endian bytes into little-endian 16-byte representation.
	for i, byt := range be {
		b[len(be)-1-i] = byt
	}
	return b
}

