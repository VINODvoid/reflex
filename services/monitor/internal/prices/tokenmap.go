package prices

import "strings"

// tokenAddressToID maps token addresses to CoinGecko coin IDs.
// EVM addresses are lowercase; Solana mints are base58 as-is.
var tokenAddressToID = map[string]string{
	// ── EVM (Ethereum mainnet) ─────────────────────────────────────────────
	"0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": "wrapped-bitcoin",            // WBTC
	"0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "ethereum",                   // WETH
	"0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": "uniswap",                    // UNI
	"0x514910771af9ca656af840dff83e8264ecf986ca": "chainlink",                  // LINK
	"0xd533a949740bb3306d119cc777fa900ba034cd52": "curve-dao-token",             // CRV

	// ── EVM (Base) ────────────────────────────────────────────────────────
	"0x4200000000000000000000000000000000000006": "ethereum",                    // WETH (Base)
	"0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf": "coinbase-wrapped-btc",       // cbBTC
	"0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22": "coinbase-wrapped-staked-eth", // cbETH

	// ── Solana mints ──────────────────────────────────────────────────────
	"So11111111111111111111111111111111111111112":    "solana",                // SOL (wrapped)
	"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "usd-coin",             // USDC
	"Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": "tether",               // USDT
	"7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs": "ethereum",             // ETH (Wormhole)
	"9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E": "bitcoin",              // BTC (Wormhole)
	"mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So":  "msol",                 // mSOL
	"J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn": "jito-staked-sol",      // JitoSOL
	"bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1":  "blazestake-staked-sol", // bSOL
}

// TokenToCoinGeckoID returns the CoinGecko coin ID for the given token address.
// EVM addresses (0x-prefixed) are normalised to lowercase before lookup.
// Solana addresses are case-sensitive base58 and looked up as-is.
// Returns ("", false) for unknown tokens.
func TokenToCoinGeckoID(address string) (string, bool) {
	key := address
	if strings.HasPrefix(address, "0x") || strings.HasPrefix(address, "0X") {
		key = strings.ToLower(address)
	}
	id, ok := tokenAddressToID[key]
	return id, ok
}
