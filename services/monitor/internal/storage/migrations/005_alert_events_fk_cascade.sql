-- Fix alert_events.rule_id FK to allow deleting alert rules.
-- Drops and recreates the constraint with ON DELETE SET NULL so history is preserved.
ALTER TABLE alert_events
  DROP CONSTRAINT IF EXISTS alert_events_rule_id_fkey;

ALTER TABLE alert_events
  ADD CONSTRAINT alert_events_rule_id_fkey
  FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE SET NULL;
