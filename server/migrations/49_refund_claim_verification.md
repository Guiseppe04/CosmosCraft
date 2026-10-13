Adds a nullable `claim_verified` inspection outcome independently of resale suitability.
Run `node server/migrations/run-migration49.js` before using the updated admin workflow.
New inspection decisions require Yes/No. Approval requires Yes; rejection records either outcome alongside its reason and inspection notes. Historical decisions remain unchanged.
