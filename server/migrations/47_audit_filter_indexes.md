# Audit filter pagination indexes

Run `node server/migrations/run-migration47.js` from the repository root after
migration 46. `schema.sql` includes both migrations for new databases.

This migration adds timestamp/ID and actor/timestamp/ID indexes. It changes no
audit records, triggers, or retention rules. The existing module/date,
action/date, entity, and trigram search indexes remain available.

Index creation can block writes while building. Apply during a maintenance
window for large databases; PostgreSQL installations needing online rollout can
run each CREATE INDEX CONCURRENTLY statement separately outside a transaction.

The list API validates query parameters, limits pages to 50 records, and queries
matching counts in SQL without joining users. List rows omit full before/after
snapshots and replace object/array changes with previews; the authorized details
endpoint retrieves the full record on demand.

Broad searches, exact matching counts over long date ranges, and large OFFSETs
can still be expensive. The actor search fallback for older records can also
limit use of the trigram index. No production timing improvement is claimed:
the automated PostgreSQL query-plan check uses a 20,060-row test dataset.
