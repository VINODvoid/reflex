// Package compound provides a client for fetching Compound V3 lending positions.
package compound

import (
	"context"
	"fmt"
	"math/big"
	"strings"

	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"

	"reflex/services/monitor/internal/prices"
	"reflex/services/monitor/internal/protocols"
)

// market represents a single Compound V3 Comet deployment.
type market struct {
	chainID int
	address string
}

// markets lists all supported Compound V3 Comet markets.
var markets = []market{
	{chainID: 1, address: "0xc3d688B66703497DAA19211EEdff47f25384cdc3"},     // Ethereum USDC
	{chainID: 8453, address: "0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf"}, // Base USDC
}

// collateralFactorScale is the fixed-point scale for Compound's liquidateCollateralFactor (1e18).
var collateralFactorScale = new(big.Float).SetInt(new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil))

// cometABI is the minimal Compound V3 Comet ABI.
var cometABI abi.ABI

func init() {
	const raw = `[{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"borrowBalanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"asset","type":"address"}],"name":"collateralBalanceOf","outputs":[{"internalType":"uint128","name":"","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint8","name":"i","type":"uint8"}],"name":"getAssetInfo","outputs":[{"components":[{"internalType":"uint8","name":"offset","type":"uint8"},{"internalType":"address","name":"asset","type":"address"},{"internalType":"address","name":"priceFeed","type":"address"},{"internalType":"uint64","name":"scale","type":"uint64"},{"internalType":"uint64","name":"borrowCollateralFactor","type":"uint64"},{"internalType":"uint64","name":"liquidateCollateralFactor","type":"uint64"},{"internalType":"uint64","name":"liquidationFactor","type":"uint64"},{"internalType":"uint128","name":"supplyCap","type":"uint128"}],"internalType":"struct CometCore.AssetInfo","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"numAssets","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"}]`
	var err error
	cometABI, err = abi.JSON(strings.NewReader(raw))
	if err != nil {
		panic(fmt.Sprintf("compound: parse abi: %v", err))
	}
}

// Client fetches Compound V3 positions across supported Comet markets.
type Client struct {
	rpcURLs     map[int]string
	priceClient *prices.Client
}

// NewClient returns a Compound V3 client.
func NewClient(rpcURLs map[int]string, priceClient *prices.Client) *Client {
	return &Client{rpcURLs: rpcURLs, priceClient: priceClient}
}

// FetchPositions returns Compound V3 positions for the given EVM address across all supported markets.
// Markets where the address has no borrow balance are omitted.
func (c *Client) FetchPositions(ctx context.Context, walletID, address string) ([]protocols.Position, error) {
	var positions []protocols.Position

	for _, m := range markets {
		rpcURL, ok := c.rpcURLs[m.chainID]
		if !ok {
			continue
		}
		pos, err := c.fetchMarket(ctx, walletID, address, m, rpcURL)
		if err != nil {
			return nil, fmt.Errorf("compound: chain %d market %s: %w", m.chainID, m.address, err)
		}
		if pos != nil {
			positions = append(positions, *pos)
		}
	}

	return positions, nil
}

// fetchMarket fetches the Compound V3 position for a single Comet market.
// Returns nil if the address has no borrow balance in this market.
func (c *Client) fetchMarket(ctx context.Context, walletID, address string, m market, rpcURL string) (*protocols.Position, error) {
	client, err := ethclient.DialContext(ctx, rpcURL)
	if err != nil {
		return nil, fmt.Errorf("dial rpc: %w", err)
	}
	defer client.Close()

	comet := common.HexToAddress(m.address)
	user := common.HexToAddress(address)

	// Check borrow balance — skip if zero.
	borrowBalance, err := callUint(ctx, client, comet, cometABI, "borrowBalanceOf", user)
	if err != nil {
		return nil, fmt.Errorf("borrowBalanceOf: %w", err)
	}
	if borrowBalance.Sign() == 0 {
		return nil, nil
	}

	// Get number of collateral assets.
	numAssetsRaw, err := callUint(ctx, client, comet, cometABI, "numAssets")
	if err != nil {
		return nil, fmt.Errorf("numAssets: %w", err)
	}
	numAssets := int(numAssetsRaw.Int64())

	// Collect all asset addresses and their liquidation factors.
	type assetInfo struct {
		address               common.Address
		liquidateCollFactor   *big.Int
		scale                 *big.Int
	}

	assetInfos := make([]assetInfo, 0, numAssets)
	coinIDs := make([]string, 0, numAssets)

	for i := 0; i < numAssets; i++ {
		info, err := getAssetInfo(ctx, client, comet, uint8(i))
		if err != nil {
			return nil, fmt.Errorf("getAssetInfo(%d): %w", i, err)
		}
		addrLower := strings.ToLower(info.asset.Hex())
		if id, ok := coinGeckoIDs[addrLower]; ok {
			coinIDs = append(coinIDs, id)
			assetInfos = append(assetInfos, assetInfo{
				address:             info.asset,
				liquidateCollFactor: new(big.Int).SetUint64(info.liquidateCollateralFactor),
				scale:               new(big.Int).SetUint64(info.scale),
			})
		}
	}

	// Fetch USD prices for all collateral assets in one batch.
	usdPrices, err := c.priceClient.GetUSDPrices(ctx, coinIDs)
	if err != nil {
		return nil, fmt.Errorf("fetch prices: %w", err)
	}

	// Compute weighted collateral USD value.
	totalCollateralUSD := 0.0
	for idx, ai := range assetInfos {
		addrLower := strings.ToLower(ai.address.Hex())
		coinID := coinGeckoIDs[addrLower]
		price, ok := usdPrices[coinID]
		if !ok || price == 0 {
			continue
		}

		balanceRaw, err := callUint(ctx, client, comet, cometABI, "collateralBalanceOf", user, ai.address)
		if err != nil {
			return nil, fmt.Errorf("collateralBalanceOf asset %d: %w", idx, err)
		}
		if balanceRaw.Sign() == 0 {
			continue
		}

		// balance in human units = balanceRaw / scale
		balanceFloat, _ := new(big.Float).Quo(
			new(big.Float).SetInt(balanceRaw),
			new(big.Float).SetInt(ai.scale),
		).Float64()

		// liquidation factor in human units = liquidateCollFactor / 1e18
		liqFactor, _ := new(big.Float).Quo(
			new(big.Float).SetInt(ai.liquidateCollFactor),
			collateralFactorScale,
		).Float64()

		totalCollateralUSD += balanceFloat * price * liqFactor
	}

	// USDC debt is $1:1 — borrowBalance is in USDC with 6 decimals.
	debtUSD, _ := new(big.Float).Quo(
		new(big.Float).SetInt(borrowBalance),
		new(big.Float).SetInt(big.NewInt(1_000_000)),
	).Float64()

	if debtUSD == 0 {
		return nil, nil
	}

	return &protocols.Position{
		WalletID:      walletID,
		Protocol:      "compound_v3",
		ChainID:       m.chainID,
		HealthFactor:  totalCollateralUSD / debtUSD,
		CollateralUSD: totalCollateralUSD,
		DebtUSD:       debtUSD,
	}, nil
}

// assetInfoResult holds the decoded fields from Comet.getAssetInfo.
type assetInfoResult struct {
	asset                   common.Address
	scale                   uint64
	liquidateCollateralFactor uint64
}

// getAssetInfo calls Comet.getAssetInfo and decodes the AssetInfo tuple.
func getAssetInfo(ctx context.Context, client *ethclient.Client, comet common.Address, i uint8) (*assetInfoResult, error) {
	callData, err := cometABI.Pack("getAssetInfo", i)
	if err != nil {
		return nil, fmt.Errorf("pack: %w", err)
	}

	raw, err := client.CallContract(ctx, ethereum.CallMsg{To: &comet, Data: callData}, nil)
	if err != nil {
		return nil, fmt.Errorf("call: %w", err)
	}

	unpacked, err := cometABI.Unpack("getAssetInfo", raw)
	if err != nil {
		return nil, fmt.Errorf("unpack: %w", err)
	}

	// The tuple unpacks as a struct with exported fields matching ABI component names.
	type abiAssetInfo struct {
		Offset                   uint8
		Asset                    common.Address
		PriceFeed                common.Address
		Scale                    uint64
		BorrowCollateralFactor   uint64
		LiquidateCollateralFactor uint64
		LiquidationFactor        uint64
		SupplyCap                *big.Int
	}

	info := abi.ConvertType(unpacked[0], new(abiAssetInfo)).(*abiAssetInfo)

	return &assetInfoResult{
		asset:                     info.Asset,
		scale:                     info.Scale,
		liquidateCollateralFactor: info.LiquidateCollateralFactor,
	}, nil
}

// callUint is a helper that packs, calls, and unpacks a view function returning a single uint.
func callUint(ctx context.Context, client *ethclient.Client, contract common.Address, parsedABI abi.ABI, method string, args ...interface{}) (*big.Int, error) {
	callData, err := parsedABI.Pack(method, args...)
	if err != nil {
		return nil, fmt.Errorf("pack %s: %w", method, err)
	}

	raw, err := client.CallContract(ctx, ethereum.CallMsg{To: &contract, Data: callData}, nil)
	if err != nil {
		return nil, fmt.Errorf("call %s: %w", method, err)
	}

	unpacked, err := parsedABI.Unpack(method, raw)
	if err != nil {
		return nil, fmt.Errorf("unpack %s: %w", method, err)
	}

	switch v := unpacked[0].(type) {
	case *big.Int:
		return v, nil
	case uint8:
		return big.NewInt(int64(v)), nil
	default:
		return nil, fmt.Errorf("callUint: unexpected type %T", unpacked[0])
	}
}
