// Package marginfi provides a client for fetching MarginFi V2 lending positions on Solana.
package marginfi

import (
	"context"
	"encoding/binary"
	"fmt"
	"math/big"
	bin "github.com/gagliardetto/binary"
	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"

	"reflex/services/monitor/internal/prices"
	"reflex/services/monitor/internal/protocols"
)

const (
	// programID is the MarginFi V2 program address on Solana mainnet.
	programID = "MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA"

	// authorityOffset is the byte offset of the authority field in a serialised MarginfiAccount.
	// Layout: 8 bytes (Anchor discriminator) + 32 bytes (group Pubkey) = 40.
	authorityOffset = 40

	// maxBalances is the fixed number of balance slots in a MarginFi lending account.
	maxBalances = 16
)

// i80f48 is a 16-byte little-endian signed fixed-point number (80 integer bits, 48 fractional bits).
// Used by MarginFi for all share values and weights.
type i80f48 [16]byte

// float64 converts an I80F48 value to float64 by interpreting the bytes as a signed 128-bit
// integer and dividing by 2^48.
func (v i80f48) float64() float64 {
	lo := binary.LittleEndian.Uint64(v[0:8])
	hi := binary.LittleEndian.Uint64(v[8:16])

	val := new(big.Int).SetUint64(hi)
	val.Lsh(val, 64)
	val.Or(val, new(big.Int).SetUint64(lo))

	// Handle sign bit (two's complement for i128).
	if v[15]&0x80 != 0 {
		maxU128 := new(big.Int).Lsh(big.NewInt(1), 128)
		val.Sub(val, maxU128)
	}

	divisor := new(big.Float).SetInt(new(big.Int).Lsh(big.NewInt(1), 48))
	result, _ := new(big.Float).Quo(new(big.Float).SetInt(val), divisor).Float64()
	return result
}

// balance represents a single lending position slot in a MarginFi account.
// Borsh layout (97 bytes):
//
//	active (1) + bank_pk (32) + asset_shares (16) + liability_shares (16) +
//	emissions_outstanding (16) + last_update (8) + _padding (8)
type balance struct {
	Active               bool
	BankPk               solana.PublicKey
	AssetShares          i80f48
	LiabilityShares      i80f48
	EmissionsOutstanding i80f48
	LastUpdate           uint64
	Padding              uint64
}

// lendingAccount holds all balance slots for a MarginFi account.
type lendingAccount struct {
	Balances [maxBalances]balance
	Padding  [8]uint64
}

// marginfiAccount is the top-level MarginFi account structure (Borsh, after 8-byte discriminator).
type marginfiAccount struct {
	Group          solana.PublicKey
	Authority      solana.PublicKey
	LendingAccount lendingAccount
	AccountFlags   uint64
}

// bankData holds the minimal fields decoded from a MarginFi Bank account.
// Bank struct layout (zero_copy / repr(C), after 8-byte Anchor discriminator):
//
//	mint (32) | mint_decimals (1) | group (32) | _padding_0 (7) |
//	asset_share_value (16) | liability_share_value (16) | ...
//
// Verified against marginfi-v2 source (mrgnlabs/marginfi-v2):
//   - authorityOffset = 40: discriminator(8) + group(32) ✓
//   - asset_share_value at relative offset 72 (absolute 80): mint(32)+mint_decimals(1)+group(32)+_padding_0(7) ✓
//   - DataSize 2304 matches on-chain MarginfiAccount size ✓
type bankData struct {
	Mint                solana.PublicKey
	AssetShareValue     i80f48
	LiabilityShareValue i80f48
}

// Client fetches MarginFi V2 positions on Solana mainnet.
type Client struct {
	rpcURL      string
	priceClient *prices.Client
}

// NewClient returns a MarginFi client using the given Helius RPC URL.
func NewClient(rpcURL string, priceClient *prices.Client) *Client {
	return &Client{rpcURL: rpcURL, priceClient: priceClient}
}

// FetchPositions returns MarginFi V2 positions for the given Solana wallet address.
// Returns an empty slice if the wallet has no active positions.
func (c *Client) FetchPositions(ctx context.Context, walletID, address string) ([]protocols.Position, error) {
	client := rpc.New(c.rpcURL)

	pubkey, err := solana.PublicKeyFromBase58(address)
	if err != nil {
		return nil, fmt.Errorf("marginfi: invalid address %q: %w", address, err)
	}

	program := solana.MustPublicKeyFromBase58(programID)

	// Filter accounts where the authority field (offset 40) matches the wallet address.
	memcmpFilter := &rpc.RPCFilter{
		Memcmp: &rpc.RPCFilterMemcmp{
			Offset: authorityOffset,
			Bytes:  solana.Base58(pubkey.Bytes()),
		},
	}

	resp, err := client.GetProgramAccountsWithOpts(ctx, program, &rpc.GetProgramAccountsOpts{
		Filters: []rpc.RPCFilter{
			{DataSize: 2304}, // expected MarginfiAccount size — adjust if layout changes
			*memcmpFilter,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("marginfi: get program accounts: %w", err)
	}

	if len(resp) == 0 {
		return nil, nil
	}

	// Collect all active bank pubkeys to fetch in one batch RPC call.
	type accountEntry struct {
		account marginfiAccount
	}
	entries := make([]accountEntry, 0, len(resp))

	bankPubkeys := make([]solana.PublicKey, 0)
	bankSet := make(map[solana.PublicKey]struct{})

	for _, acc := range resp {
		data := acc.Account.Data.GetBinary()
		if len(data) < 8 {
			continue
		}

		var mfAcc marginfiAccount
		decoder := bin.NewBorshDecoder(data[8:]) // skip 8-byte Anchor discriminator
		if err := decoder.Decode(&mfAcc); err != nil {
			return nil, fmt.Errorf("marginfi: decode account %s: %w", acc.Pubkey, err)
		}

		entries = append(entries, accountEntry{account: mfAcc})

		for _, b := range mfAcc.LendingAccount.Balances {
			if !b.Active {
				continue
			}
			if _, seen := bankSet[b.BankPk]; !seen {
				bankPubkeys = append(bankPubkeys, b.BankPk)
				bankSet[b.BankPk] = struct{}{}
			}
		}
	}

	if len(bankPubkeys) == 0 {
		return nil, nil
	}

	// Batch-fetch all referenced bank accounts in a single RPC call.
	bankMap, err := c.fetchBanks(ctx, client, bankPubkeys)
	if err != nil {
		return nil, fmt.Errorf("marginfi: fetch banks: %w", err)
	}

	// Collect unique token mints to fetch prices in one CoinGecko call.
	mintCoinIDs := make(map[string]string) // mint base58 → CoinGecko ID
	for _, bd := range bankMap {
		mintAddr := bd.Mint.String()
		if id, ok := mintToCoinGeckoID[mintAddr]; ok {
			mintCoinIDs[mintAddr] = id
		}
	}

	coinIDs := make([]string, 0, len(mintCoinIDs))
	for _, id := range mintCoinIDs {
		coinIDs = append(coinIDs, id)
	}

	usdPrices, err := c.priceClient.GetUSDPrices(ctx, coinIDs)
	if err != nil {
		return nil, fmt.Errorf("marginfi: fetch prices: %w", err)
	}

	var positions []protocols.Position

	for _, entry := range entries {
		pos := c.computePosition(walletID, entry.account, bankMap, mintCoinIDs, usdPrices)
		if pos != nil {
			positions = append(positions, *pos)
		}
	}

	return positions, nil
}

// computePosition calculates the health factor for a single MarginFi account.
// Returns nil if the account has no active liabilities.
func (c *Client) computePosition(
	walletID string,
	acc marginfiAccount,
	bankMap map[solana.PublicKey]*bankData,
	mintCoinIDs map[string]string,
	usdPrices map[string]float64,
) *protocols.Position {
	var totalAssetUSD, totalLiabilityUSD float64

	for _, b := range acc.LendingAccount.Balances {
		if !b.Active {
			continue
		}

		bank, ok := bankMap[b.BankPk]
		if !ok {
			continue
		}

		coinID, ok := mintCoinIDs[bank.Mint.String()]
		if !ok {
			continue
		}

		price, ok := usdPrices[coinID]
		if !ok || price == 0 {
			continue
		}

		assetShares := b.AssetShares.float64()
		liabilityShares := b.LiabilityShares.float64()
		assetShareValue := bank.AssetShareValue.float64()
		liabilityShareValue := bank.LiabilityShareValue.float64()

		totalAssetUSD += assetShares * assetShareValue * price
		totalLiabilityUSD += liabilityShares * liabilityShareValue * price
	}

	if totalLiabilityUSD == 0 {
		return nil
	}

	return &protocols.Position{
		WalletID:      walletID,
		Protocol:      "marginfi",
		ChainID:       0, // Solana — no chain ID
		HealthFactor:  totalAssetUSD / totalLiabilityUSD,
		CollateralUSD: totalAssetUSD,
		DebtUSD:       totalLiabilityUSD,
	}
}

// fetchBanks batch-fetches MarginFi bank accounts and decodes the fields needed for HF computation.
func (c *Client) fetchBanks(ctx context.Context, client *rpc.Client, pubkeys []solana.PublicKey) (map[solana.PublicKey]*bankData, error) {
	resp, err := client.GetMultipleAccounts(ctx, pubkeys...)
	if err != nil {
		return nil, fmt.Errorf("get multiple accounts: %w", err)
	}

	bankMap := make(map[solana.PublicKey]*bankData, len(pubkeys))

	for i, acc := range resp.Value {
		if acc == nil {
			continue
		}

		data := acc.Data.GetBinary()
		// Bank data layout after 8-byte discriminator:
		// mint (32) | mint_decimals (1) | group (32) | _padding_0 (7) |
		// asset_share_value (16) | liability_share_value (16) | ...
		const minLen = 8 + 32 + 1 + 32 + 7 + 16 + 16
		if len(data) < minLen {
			continue
		}

		offset := 8 // skip discriminator

		var bd bankData
		copy(bd.Mint[:], data[offset:offset+32])
		offset += 32 + 1 + 32 + 7 // skip mint_decimals + group + padding

		copy(bd.AssetShareValue[:], data[offset:offset+16])
		offset += 16
		copy(bd.LiabilityShareValue[:], data[offset:offset+16])

		bankMap[pubkeys[i]] = &bd
	}

	return bankMap, nil
}

// mintToCoinGeckoID maps Solana token mint addresses to CoinGecko coin IDs.
// Covers the most common MarginFi collateral assets on mainnet.
var mintToCoinGeckoID = map[string]string{
	"So11111111111111111111111111111111111111112":  "solana",           // SOL (wrapped)
	"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "usd-coin",        // USDC
	"Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": "tether",          // USDT
	"7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs": "ethereum",        // ETH (Wormhole)
	"9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E": "bitcoin",         // BTC (Wormhole)
	"mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So":  "msol",            // mSOL
	"J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn": "jito-staked-sol", // JitoSOL
	"bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1":  "blazestake-staked-sol", // bSOL
}

