CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users (anonymous, identified by push token)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expo_push_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wallets linked to a user
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  chain_family TEXT NOT NULL CHECK (chain_family IN ('evm', 'solana')),
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, address)
);

-- Alert rules
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
  protocol TEXT NOT NULL CHECK (protocol IN ('aave_v3', 'compound_v3', 'marginfi', 'solend')),
  chain_id INT,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('health_factor', 'price_change')),
  threshold NUMERIC NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('below', 'above', 'change_pct')),
  token_address TEXT,
  active BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert history
CREATE TABLE IF NOT EXISTS alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES alert_rules(id),
  user_id UUID REFERENCES users(id),
  message TEXT NOT NULL,
  value_at_trigger NUMERIC,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);
