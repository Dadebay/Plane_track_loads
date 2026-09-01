-- CLAUDE.md rule #5 hardening: `TRUNCATE` does not fire row-level
-- `BEFORE UPDATE OR DELETE ... FOR EACH ROW` triggers in Postgres — only
-- the row-level trigger added in the initial migration was in place, so
-- `TRUNCATE TABLE wnb_calculations` (or `documents`) would have silently
-- bypassed immutability entirely. This adds the missing statement-level
-- `BEFORE TRUNCATE` trigger, closing that gap. Found while cleaning up
-- test data in Faz 5 — the same `reject_mutation()` function already
-- covers TRUNCATE via TG_OP, no new function needed.

CREATE TRIGGER wnb_calculations_immutable_truncate
  BEFORE TRUNCATE ON "wnb_calculations"
  FOR EACH STATEMENT EXECUTE FUNCTION reject_mutation();

CREATE TRIGGER documents_immutable_truncate
  BEFORE TRUNCATE ON "documents"
  FOR EACH STATEMENT EXECUTE FUNCTION reject_mutation();
