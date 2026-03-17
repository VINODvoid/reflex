package protocols

import "context"

// Fetcher is the common interface implemented by all lending protocol clients.
// Both EVM and Solana clients satisfy this interface.
type Fetcher interface {
	FetchPositions(ctx context.Context, walletID, address string) ([]Position, error)
}
