-- Cached position snapshots fetched from on-chain lending protocols
CREATE TABLE IF NOT EXISTS positions (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id     UUID         NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  protocol      TEXT         NOT NULL CHECK (protocol IN ('aave_v3', 'compound_v3', 'marginfi', 'solend')),
  chain_id      INT,
  health_factor NUMERIC,
  collateral_usd NUMERIC,
  debt_usd      NUMERIC,
  fetched_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (wallet_id, protocol, chain_id)
);
