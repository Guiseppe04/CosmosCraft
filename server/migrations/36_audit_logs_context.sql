-- 36: Enriched audit log context
--
-- Audit rows today only carry entity_type/entity_id/status + a free-form
-- `details` blob, which makes it impossible for an administrator to answer
-- "which order/project/appointment is this about?" without raw JSON.
--
-- This migration adds:
--   context     jsonb - normalised business context captured at event time
--   changes     jsonb - field level before/after pairs
--   search_text text  - flattened searchable text (server-side audit search)
--
-- Existing rows are left untouched apart from a search_text backfill, so old
-- records keep working and are never rewritten with invented data.

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS context jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS changes jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS search_text text;

COMMENT ON COLUMN audit_logs.context IS
  'Normalised business context captured when the event occurred (order/project/appointment/payment/customer/stock identifiers).';
COMMENT ON COLUMN audit_logs.changes IS
  'Field level before/after values, e.g. {"status":{"from":"pending","to":"verified"}}.';
COMMENT ON COLUMN audit_logs.search_text IS
  'Flattened text used by server-side audit search.';

-- Best-effort trigram index for fast ILIKE search. pg_trgm may not be
-- available on every deployment, in which case search still works (just with a
-- sequential scan) because the query never depends on the index.
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_trgm not available, audit search will use a sequential scan';
  END;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_logs_search_text ON audit_logs USING GIN (search_text gin_trgm_ops)';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type_created ON audit_logs (entity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs (entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_context_gin ON audit_logs USING GIN (context jsonb_path_ops);

-- One shared flattener for search_text. JSON payloads are reduced to their plain
-- text so operators can search "ORD-2026..." or a customer name, while raw
-- braces/quotes/commas never become searchable tokens (a search for "," or a
-- stray quote must not match every row, and the index stays small).
CREATE OR REPLACE FUNCTION audit_search_text(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_previous_status text,
  p_new_status text,
  p_context jsonb,
  p_changes jsonb,
  p_details jsonb
) RETURNS text AS $$
  SELECT left(
    btrim(
      regexp_replace(
        regexp_replace(
          lower(concat_ws(' ',
            coalesce(p_action, ''),
            coalesce(p_entity_type, ''),
            coalesce(p_entity_id::text, ''),
            coalesce(p_previous_status, ''),
            coalesce(p_new_status, ''),
            coalesce(p_context::text, ''),
            coalesce(p_changes::text, ''),
            coalesce(p_details::text, '')
          )),
          '[{}[\]",:]+', ' ', 'g'
        ),
        '\s+', ' ', 'g'
      )
    ),
    8000
  );
$$ LANGUAGE sql IMMUTABLE;

-- Backfill search_text for historical rows from whatever they already store, and
-- repair any row written before this flattener existed (those still contain raw
-- JSON punctuation). Rows written by auditService are already clean because they
-- carry no JSON punctuation, so this is idempotent.
UPDATE audit_logs
SET search_text = audit_search_text(
  action, entity_type, entity_id, previous_status, new_status, context, changes, details
)
WHERE search_text IS NULL
   OR search_text ~ '[{}[\]",:]+';

-- Keep the invariant at the database level too: a row written by any path that
-- does not go through auditService (a script, a future service, a manual fix)
-- still becomes searchable instead of silently dropping out of audit search.
CREATE OR REPLACE FUNCTION audit_logs_fill_search_text() RETURNS trigger AS $$
BEGIN
  IF NEW.search_text IS NULL THEN
    NEW.search_text := audit_search_text(
      NEW.action, NEW.entity_type, NEW.entity_id,
      NEW.previous_status, NEW.new_status,
      NEW.context, NEW.changes, NEW.details
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_fill_search_text ON audit_logs;
CREATE TRIGGER trg_audit_logs_fill_search_text
  BEFORE INSERT ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION audit_logs_fill_search_text();