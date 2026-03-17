// Package solend provides a client for fetching Solend lending positions on Solana.
package solend

import (
	"context"
	"encoding/binary"
	"fmt"
	"math/big"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"

	"reflex/services/monitor/internal/protocols"
)

const (
	// programID is the Solend production program address on Solana mainnet.
	programID = "So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo"

	// ownerOffset is the byte offset of the owner field in a serialised Obligation account.
	// Layout: 1 (version) + 8 (last_update: slot u64) + 1 (last_update: stale bool) +
	//         32 (lending_market) = 42.
	// IMPORTANT: Verify against https://github.com/solendprotocol/solend-program-library
	ownerOffset = 42

	// obligationSize is the expected byte length of a Solend Obligation account.
	obligationSize = 916
)

// decimal is a Solend Decimal value — a u128 scaled to 1e18.
type decimal [16]byte

// float64 converts a Solend Decimal to float64 by interpreting the 16 bytes as a
// little-endian u128 and dividing by 1e18.
func (d decimal) float64() float64 {
	lo := binary.LittleEndian.Uint64(d[0:8])
	hi := binary.LittleEndian.Uint64(d[8:16])

	val := new(big.Int).SetUint64(hi)
	val.Lsh(val, 64)
	val.Or(val, new(big.Int).SetUint64(lo))

	divisor := new(big.Float).SetFloat64(1e18)
	result, _ := new(big.Float).Quo(new(big.Float).SetInt(val), divisor).Float64()
	return result
}

// obligation holds the minimal decoded fields from a Solend Obligation account.
// Obligation binary layout (no Anchor discriminator — custom binary format):
//
//	version (1) | last_update.slot (8) | last_update.stale (1) |
//	lending_market (32) | owner (32) | deposited_value (16) |
//	borrowed_value (16) | allowed_borrow_value (16) | ...
//
// IMPORTANT: Verify field offsets against the Solend program source before relying
// on this in production. Cross-check with a known obligation account on mainnet.
type obligation struct {
	DepositedValue     decimal
	BorrowedValue      decimal
	AllowedBorrowValue decimal
}

// Client fetches Solend lending positions on Solana mainnet.
type Client struct {
	rpcURL string
}

// NewClient returns a Solend client using the given Helius RPC URL.
func NewClient(rpcURL string) *Client {
	return &Client{rpcURL: rpcURL}
}

// FetchPositions returns Solend positions for the given Solana wallet address.
// Returns an empty slice if the wallet has no active borrow positions.
func (c *Client) FetchPositions(ctx context.Context, walletID, address string) ([]protocols.Position, error) {
	client := rpc.New(c.rpcURL)

	pubkey, err := solana.PublicKeyFromBase58(address)
	if err != nil {
		return nil, fmt.Errorf("solend: invalid address %q: %w", address, err)
	}

	program := solana.MustPublicKeyFromBase58(programID)

	// Filter obligations by owner field at ownerOffset.
	memcmpFilter := rpc.RPCFilter{
		Memcmp: &rpc.RPCFilterMemcmp{
			Offset: ownerOffset,
			Bytes:  solana.Base58(pubkey.Bytes()),
		},
	}

	resp, err := client.GetProgramAccountsWithOpts(ctx, program, &rpc.GetProgramAccountsOpts{
		Filters: []rpc.RPCFilter{
			{DataSize: obligationSize},
			memcmpFilter,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("solend: get program accounts: %w", err)
	}

	var positions []protocols.Position

	for _, acc := range resp {
		data := acc.Account.Data.GetBinary()

		ob, err := decodeObligation(data)
		if err != nil {
			return nil, fmt.Errorf("solend: decode obligation %s: %w", acc.Pubkey, err)
		}

		borrowedValue := ob.BorrowedValue.float64()
		if borrowedValue == 0 {
			continue
		}

		depositedValue := ob.DepositedValue.float64()
		allowedBorrowValue := ob.AllowedBorrowValue.float64()

		// Health factor = allowed_borrow_value / borrowed_value.
		// Solend pre-computes USD values in the obligation — no need for CoinGecko.
		hf := allowedBorrowValue / borrowedValue

		positions = append(positions, protocols.Position{
			WalletID:      walletID,
			Protocol:      "solend",
			ChainID:       0, // Solana — no chain ID
			HealthFactor:  hf,
			CollateralUSD: depositedValue,
			DebtUSD:       borrowedValue,
		})
	}

	return positions, nil
}

// decodeObligation reads the minimal fields needed for health factor computation
// from a raw Solend Obligation account data slice.
//
// Byte layout after version byte (offset 0):
//
//	[0]     version       u8
//	[1-8]   last_update.slot  u64
//	[9]     last_update.stale u8
//	[10-41] lending_market    [32]byte
//	[42-73] owner             [32]byte
//	[74-89] deposited_value   Decimal (u128, 1e18 scale)
//	[90-105] borrowed_value   Decimal
//	[106-121] allowed_borrow_value Decimal
func decodeObligation(data []byte) (*obligation, error) {
	const minLen = 122 // offset 106 + 16 bytes for allowed_borrow_value
	if len(data) < minLen {
		return nil, fmt.Errorf("obligation data too short: %d bytes", len(data))
	}

	// Validate version byte — expected to be 1.
	if data[0] != 1 {
		return nil, fmt.Errorf("unexpected obligation version %d (want 1)", data[0])
	}

	var ob obligation
	copy(ob.DepositedValue[:], data[74:90])
	copy(ob.BorrowedValue[:], data[90:106])
	copy(ob.AllowedBorrowValue[:], data[106:122])

	return &ob, nil
}
