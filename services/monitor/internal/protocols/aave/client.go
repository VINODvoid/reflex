// Package aave provides a client for fetching Aave V3 lending positions.
package aave

import (
	"context"
	"fmt"
	"math/big"
	"strings"

	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"

	"reflex/services/monitor/internal/protocols"
)

// Pool contract addresses per chain ID.
var poolAddresses = map[int]string{
	1:     "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", // Ethereum mainnet
	8453:  "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", // Base
	42161: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Arbitrum
	137:   "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Polygon
	10:    "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Optimism
}

// healthFactorScale is the fixed-point scale for the healthFactor field (1e18 / ray).
var healthFactorScale = new(big.Float).SetInt(new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil))

// baseCurrencyScale is the scale for USD amounts returned by getUserAccountData (1e8).
var baseCurrencyScale = new(big.Float).SetInt(new(big.Int).Exp(big.NewInt(10), big.NewInt(8), nil))

// poolABI is the minimal Aave V3 Pool ABI for getUserAccountData.
const poolABI = `[{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getUserAccountData","outputs":[{"internalType":"uint256","name":"totalCollateralBase","type":"uint256"},{"internalType":"uint256","name":"totalDebtBase","type":"uint256"},{"internalType":"uint256","name":"availableBorrowsBase","type":"uint256"},{"internalType":"uint256","name":"currentLiquidationThreshold","type":"uint256"},{"internalType":"uint256","name":"ltv","type":"uint256"},{"internalType":"uint256","name":"healthFactor","type":"uint256"}],"stateMutability":"view","type":"function"}]`

// Client fetches Aave V3 positions across Ethereum, Base, and Arbitrum.
type Client struct {
	// rpcURLs maps chain ID to Alchemy RPC endpoint URL.
	rpcURLs map[int]string
}

// NewClient returns an Aave V3 client for the given RPC endpoints.
func NewClient(rpcURLs map[int]string) *Client {
	return &Client{rpcURLs: rpcURLs}
}

// FetchPositions returns Aave V3 positions for the given EVM address across all supported chains.
// Chains where the address has no debt are omitted from the result.
func (c *Client) FetchPositions(ctx context.Context, walletID, address string) ([]protocols.Position, error) {
	parsedABI, err := abi.JSON(strings.NewReader(poolABI))
	if err != nil {
		return nil, fmt.Errorf("aave: parse abi: %w", err)
	}

	var positions []protocols.Position

	for chainID, rpcURL := range c.rpcURLs {
		pos, err := c.fetchChain(ctx, parsedABI, walletID, address, chainID, rpcURL)
		if err != nil {
			return nil, fmt.Errorf("aave: chain %d: %w", chainID, err)
		}
		if pos != nil {
			positions = append(positions, *pos)
		}
	}

	return positions, nil
}

// fetchChain fetches the Aave V3 position for a single chain.
// Returns nil if the address has no debt on this chain.
func (c *Client) fetchChain(ctx context.Context, parsedABI abi.ABI, walletID, address string, chainID int, rpcURL string) (*protocols.Position, error) {
	poolAddr, ok := poolAddresses[chainID]
	if !ok {
		return nil, fmt.Errorf("no pool address configured for chain %d", chainID)
	}

	client, err := ethclient.DialContext(ctx, rpcURL)
	if err != nil {
		return nil, fmt.Errorf("dial rpc: %w", err)
	}
	defer client.Close()

	callData, err := parsedABI.Pack("getUserAccountData", common.HexToAddress(address))
	if err != nil {
		return nil, fmt.Errorf("pack call: %w", err)
	}

	contractAddr := common.HexToAddress(poolAddr)
	result, err := client.CallContract(ctx, ethereum.CallMsg{
		To:   &contractAddr,
		Data: callData,
	}, nil)
	if err != nil {
		return nil, fmt.Errorf("call contract: %w", err)
	}

	unpacked, err := parsedABI.Unpack("getUserAccountData", result)
	if err != nil {
		return nil, fmt.Errorf("unpack result: %w", err)
	}

	// unpacked order: totalCollateralBase, totalDebtBase, availableBorrowsBase,
	// currentLiquidationThreshold, ltv, healthFactor
	totalDebtBase := unpacked[1].(*big.Int)
	if totalDebtBase.Sign() == 0 {
		// No debt — skip this chain.
		return nil, nil
	}

	totalCollateralBase := unpacked[0].(*big.Int)
	liqThresholdRaw := unpacked[3].(*big.Int) // basis points (10000 = 100%)
	ltvRaw := unpacked[4].(*big.Int)           // basis points
	healthFactorRaw := unpacked[5].(*big.Int)

	healthFactor, _ := new(big.Float).Quo(
		new(big.Float).SetInt(healthFactorRaw),
		healthFactorScale,
	).Float64()

	collateralUSD, _ := new(big.Float).Quo(
		new(big.Float).SetInt(totalCollateralBase),
		baseCurrencyScale,
	).Float64()

	debtUSD, _ := new(big.Float).Quo(
		new(big.Float).SetInt(totalDebtBase),
		baseCurrencyScale,
	).Float64()

	liqThreshold, _ := new(big.Float).Quo(
		new(big.Float).SetInt(liqThresholdRaw),
		big.NewFloat(10000),
	).Float64()

	ltv, _ := new(big.Float).Quo(
		new(big.Float).SetInt(ltvRaw),
		big.NewFloat(10000),
	).Float64()

	return &protocols.Position{
		WalletID:             walletID,
		Protocol:             "aave_v3",
		ChainID:              chainID,
		HealthFactor:         healthFactor,
		CollateralUSD:        collateralUSD,
		DebtUSD:              debtUSD,
		LTV:                  ltv,
		LiquidationThreshold: liqThreshold,
	}, nil
}
