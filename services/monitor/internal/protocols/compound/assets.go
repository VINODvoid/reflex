package compound

// coinGeckoIDs maps ERC-20 token addresses (lowercase) to their CoinGecko coin IDs.
// Covers collateral assets in the Ethereum and Base USDC Comet markets.
var coinGeckoIDs = map[string]string{
	// Ethereum mainnet
	"0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": "wrapped-bitcoin",       // WBTC
	"0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "ethereum",              // WETH
	"0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": "uniswap",               // UNI
	"0x514910771af9ca656af840dff83e8264ecf986ca": "chainlink",             // LINK
	"0xd533a949740bb3306d119cc777fa900ba034cd52": "curve-dao-token",       // CRV
	// Base
	"0x4200000000000000000000000000000000000006": "ethereum",              // WETH (Base)
	"0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf": "coinbase-wrapped-btc", // cbBTC
	"0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22": "coinbase-wrapped-staked-eth", // cbETH
}
