package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/sync/errgroup"

	"reflex/services/monitor/internal/protocols"
	"reflex/services/monitor/internal/protocols/aave"
	"reflex/services/monitor/internal/protocols/compound"
	"reflex/services/monitor/internal/protocols/marginfi"
	"reflex/services/monitor/internal/protocols/solend"
	"reflex/services/monitor/internal/storage"
)

const positionFetchTimeout = 10 * time.Second

// PositionsHandler handles requests for on-chain lending positions.
type PositionsHandler struct {
	db       *pgxpool.Pool
	aave     *aave.Client
	compound *compound.Client
	marginfi *marginfi.Client
	solend   *solend.Client
}

// NewPositionsHandler returns a PositionsHandler wired with all protocol clients.
func NewPositionsHandler(
	db *pgxpool.Pool,
	aave *aave.Client,
	compound *compound.Client,
	marginfi *marginfi.Client,
	solend *solend.Client,
) *PositionsHandler {
	return &PositionsHandler{
		db:       db,
		aave:     aave,
		compound: compound,
		marginfi: marginfi,
		solend:   solend,
	}
}

// walletRow holds the minimal wallet fields needed to dispatch protocol fetches.
type walletRow struct {
	id          string
	address     string
	chainFamily string
}

// GetPositions fetches live on-chain positions for a wallet, upserts them to the DB,
// and returns the full position list as JSON.
func (h *PositionsHandler) GetPositions(w http.ResponseWriter, r *http.Request) {
	walletID := chi.URLParam(r, "walletId")

	wallet, err := h.loadWallet(r.Context(), walletID)
	if err != nil {
		log.Printf("GetPositions: load wallet %s: %v", walletID, err)
		http.Error(w, "wallet not found", http.StatusNotFound)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), positionFetchTimeout)
	defer cancel()

	positions, err := h.fetchPositions(ctx, wallet)
	if err != nil {
		log.Printf("GetPositions: fetch positions for wallet %s: %v", walletID, err)
		http.Error(w, "failed to fetch positions", http.StatusInternalServerError)
		return
	}

	if err := storage.UpsertPositions(ctx, h.db, positions); err != nil {
		log.Printf("GetPositions: upsert positions for wallet %s: %v", walletID, err)
		http.Error(w, "failed to persist positions", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"positions": positions})
}

// loadWallet fetches the wallet address and chain family from the database.
func (h *PositionsHandler) loadWallet(ctx context.Context, walletID string) (*walletRow, error) {
	row := h.db.QueryRow(ctx,
		"SELECT id, address, chain_family FROM wallets WHERE id = $1",
		walletID,
	)
	var w walletRow
	if err := row.Scan(&w.id, &w.address, &w.chainFamily); err != nil {
		return nil, err
	}
	return &w, nil
}

// fetchPositions dispatches concurrent protocol fetches based on the wallet's chain family.
func (h *PositionsHandler) fetchPositions(ctx context.Context, wallet *walletRow) ([]protocols.Position, error) {
	g, ctx := errgroup.WithContext(ctx)

	results := make([][]protocols.Position, 2)

	switch wallet.chainFamily {
	case "evm":
		g.Go(func() error {
			pos, err := h.aave.FetchPositions(ctx, wallet.id, wallet.address)
			if err != nil {
				return fmt.Errorf("aave: %w", err)
			}
			results[0] = pos
			return nil
		})
		g.Go(func() error {
			pos, err := h.compound.FetchPositions(ctx, wallet.id, wallet.address)
			if err != nil {
				return fmt.Errorf("compound: %w", err)
			}
			results[1] = pos
			return nil
		})

	case "solana":
		g.Go(func() error {
			pos, err := h.marginfi.FetchPositions(ctx, wallet.id, wallet.address)
			if err != nil {
				return fmt.Errorf("marginfi: %w", err)
			}
			results[0] = pos
			return nil
		})
		g.Go(func() error {
			pos, err := h.solend.FetchPositions(ctx, wallet.id, wallet.address)
			if err != nil {
				return fmt.Errorf("solend: %w", err)
			}
			results[1] = pos
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return nil, err
	}

	var all []protocols.Position
	for _, r := range results {
		all = append(all, r...)
	}
	return all, nil
}
