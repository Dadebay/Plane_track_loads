-- Adds the EDP document type: the Loading Instruction / Report as a ramp
-- working form (ONLOAD / REPORT lines per position), distinct from LIR.
--
-- Placed after LS so the enum reads in the order the documents are produced.
-- Postgres cannot add an enum value inside a transaction block on versions
-- before 12; this project targets 16, where it is allowed.
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'EDP' AFTER 'LS';
