Apply this migration before deploying category deletion changes:

```sh
node server/migrations/run-migration43.js
```

The runner uses `server/.env` and applies the change in a transaction. It allows products to have no category without deleting or rewriting existing records. The service clears category assignments and deletes the category in one transaction.
