-- Add last_price_checked to support change_pct direction for price_change alert rules.
-- Nullable: health_factor rules always have NULL here.
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS last_price_checked NUMERIC;
