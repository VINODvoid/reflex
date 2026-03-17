package solend

import (
	"math"
	"math/big"
	"testing"
)

func TestDecodeObligation_HealthFactor(t *testing.T) {
	data := makeObligationData(t, obligationFields{
		depositedValue:     15000.0,
		borrowedValue:      10000.0,
		allowedBorrowValue: 12000.0,
	})

	ob, err := decodeObligation(data)
	if err != nil {
		t.Fatalf("decodeObligation: %v", err)
	}

	wantDeposited := 15000.0
	wantBorrowed := 10000.0
	wantAllowed := 12000.0

	if math.Abs(ob.DepositedValue.float64()-wantDeposited) > 0.01 {
		t.Errorf("deposited_value: got %v, want %v", ob.DepositedValue.float64(), wantDeposited)
	}
	if math.Abs(ob.BorrowedValue.float64()-wantBorrowed) > 0.01 {
		t.Errorf("borrowed_value: got %v, want %v", ob.BorrowedValue.float64(), wantBorrowed)
	}
	if math.Abs(ob.AllowedBorrowValue.float64()-wantAllowed) > 0.01 {
		t.Errorf("allowed_borrow_value: got %v, want %v", ob.AllowedBorrowValue.float64(), wantAllowed)
	}

	hf := ob.AllowedBorrowValue.float64() / ob.BorrowedValue.float64()
	wantHF := 1.2
	if math.Abs(hf-wantHF) > 0.0001 {
		t.Errorf("health factor: got %v, want %v", hf, wantHF)
	}
}

func TestDecodeObligation_WrongVersion(t *testing.T) {
	data := makeObligationData(t, obligationFields{
		depositedValue: 1000.0, borrowedValue: 500.0, allowedBorrowValue: 800.0,
	})
	data[0] = 2 // corrupt version byte

	_, err := decodeObligation(data)
	if err == nil {
		t.Fatal("expected error for wrong version, got nil")
	}
}

func TestDecodeObligation_TooShort(t *testing.T) {
	_, err := decodeObligation(make([]byte, 10))
	if err == nil {
		t.Fatal("expected error for short data, got nil")
	}
}

type obligationFields struct {
	depositedValue     float64
	borrowedValue      float64
	allowedBorrowValue float64
}

// makeObligationData builds a minimal synthetic Obligation byte slice for testing.
func makeObligationData(t *testing.T, f obligationFields) []byte {
	t.Helper()
	data := make([]byte, obligationSize)
	data[0] = 1 // version

	writeDecimal(data[74:90], f.depositedValue)
	writeDecimal(data[90:106], f.borrowedValue)
	writeDecimal(data[106:122], f.allowedBorrowValue)

	return data
}

// writeDecimal encodes a float64 as a little-endian u128 scaled by 1e18.
// Uses big.Float to avoid uint64 overflow for values larger than ~18.
func writeDecimal(dst []byte, f float64) {
	scale := new(big.Float).SetFloat64(1e18)
	rawFloat := new(big.Float).Mul(new(big.Float).SetFloat64(f), scale)
	rawInt, _ := rawFloat.Int(nil)

	be := rawInt.Bytes() // big-endian, no leading zeros
	for i, b := range be {
		dst[len(be)-1-i] = b // reverse into little-endian
	}
}
