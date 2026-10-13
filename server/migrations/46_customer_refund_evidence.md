# Customer order refund evidence

Run `node server/migrations/run-migration46.js` from the repository root after migrations 20 and 42. The runner reads `server/.env`, applies the SQL in a transaction, and verifies the private evidence constraint before committing.

The migration reuses `refund_requests` and `refund_private_files`. It preserves underscore-style evidence and return kinds and inspection files while allowing the current evidence and return kinds. Customer evidence routes support both naming formats.

Customer order requests require a valid reason and one to five private JPG/JPEG/PNG/WebP images of up to 5 MB each. Additional Explanation is optional, with a maximum of 1000 characters. The original payment channel and transaction ID are retrieved from verified payments. Requests reserve the remaining paid amount and eligible item quantity and do not change payments or inventory.

The admin phase is implemented in migration 47. See `47_admin_refund_returns.md` for the complete return, inspection and original-channel repayment workflow. Appointment and project refunds retain their specialized flows.
