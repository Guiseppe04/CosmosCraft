Audit creation now belongs to PostgreSQL. Migration 46 installs INSERT, UPDATE,
DELETE and TRUNCATE triggers on every application table in the current schema.
The backend supplies authenticated actor/IP/user-agent metadata through
transaction-local settings, reads history, and returns readable display labels.
Direct SQL and background jobs are recorded with no application actor and a
database source. Failed login requests that make no database change cannot be
recorded by a row trigger; this is a database change history.

Run `node server/migrations/run-migration46.js` with the server stopped, then
deploy/restart the changed backend. Do not run the old backend after applying
this migration: its manual audit inserts will be rejected. New backend startup
checks that migration 46 exists. Existing history is preserved.

Project parts receipts are backfilled into `project_part_receipts`, preserving
received and actually-deducted quantities. Procurement requests now have their
own table. Business state no longer depends on reconstructing audit events.

Events contain the source table, original record identifier (including non-UUID
IDs), related business references, redacted snapshots, field changes, and actor
identity captured at event time. No-op/timestamp-only updates are skipped.
Credential values, private refund destinations, file bytes, OTPs and embedded
image data are redacted in PostgreSQL. Only the trigger writes audit rows;
manual inserts, updates, deletes and truncates are rejected. Table owners and
superusers can still disable triggers, so production application credentials
should not own the schema or have superuser privileges.

Every database mutation produces its own record, including related rows and
counter updates. These are distinct database changes, so volume will exceed the
old business-event-only logs. Adding a new application table requires adding it
to migration 46's mapping and installing its triggers before deploying writes.

Trigger errors abort the business transaction instead of allowing an unlogged
change. Keep audit storage available and include this table in database backups.

Validate with:

```powershell
node --test server/tests/databaseAuditTriggers.test.js
node --test --test-concurrency=2 "server/tests/*.test.js"
cd client
node --test tests/buildSnapshotAndAudit.test.js
npm.cmd run build
```
