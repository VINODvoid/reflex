-- Add LTV and liquidation threshold columns to positions.
-- Existing rows default to 0 (protocols that don't expose these fields).
ALTER TABLE positions
  ADD COLUMN IF NOT EXISTS ltv NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS liquidation_threshold NUMERIC NOT NULL DEFAULT 0;
