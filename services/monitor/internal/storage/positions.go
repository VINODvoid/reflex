// Package storage provides database helpers for persisting application data.
package storage

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"reflex/services/monitor/internal/protocols"
)

// UpsertPositions inserts or updates a batch of positions in the database.
// On conflict (wallet_id, protocol, chain_id), the existing row is updated with
// the latest health factor, collateral, debt, and fetch timestamp.
func UpsertPositions(ctx context.Context, db *pgxpool.Pool, positions []protocols.Position) error {
	if len(positions) == 0 {
		return nil
	}

	batch := &pgx.Batch{}
	for _, p := range positions {
		batch.Queue(
			`INSERT INTO positions (wallet_id, protocol, chain_id, health_factor, collateral_usd, debt_usd)
			 VALUES ($1, $2, $3, $4, $5, $6)
			 ON CONFLICT (wallet_id, protocol, chain_id)
			 DO UPDATE SET
			   health_factor  = EXCLUDED.health_factor,
			   collateral_usd = EXCLUDED.collateral_usd,
			   debt_usd       = EXCLUDED.debt_usd,
			   fetched_at     = NOW()`,
			p.WalletID,
			p.Protocol,
			p.ChainID,
			p.HealthFactor,
			p.CollateralUSD,
			p.DebtUSD,
		)
	}

	br := db.SendBatch(ctx, batch)
	defer br.Close()

	for i := range positions {
		if _, err := br.Exec(); err != nil {
			return fmt.Errorf("storage: upsert position %d (%s/%s): %w", i, positions[i].WalletID, positions[i].Protocol, err)
		}
	}

	return nil
}
