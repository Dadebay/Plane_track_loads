-- The operator signs their sheets the way their own system does: the CHECKED
-- box carries the account that worked the flight, and the APPROVED box is a
-- name typed by hand — often someone with no account here at all.
--
-- `checkedById` therefore becomes optional, and CLAUDE.md rule #7 moves from
-- "always two accounts" to "never the same account twice": where a checker is
-- recorded, the database still refuses prepared_by = checked_by.
ALTER TABLE "documents" ADD COLUMN "approvedByName" TEXT;

ALTER TABLE "documents" ALTER COLUMN "checkedById" DROP NOT NULL;

ALTER TABLE "documents" DROP CONSTRAINT "documents_prepared_checked_distinct";

ALTER TABLE "documents" ADD CONSTRAINT "documents_prepared_checked_distinct"
  CHECK ("checkedById" IS NULL OR "preparedById" <> "checkedById");
