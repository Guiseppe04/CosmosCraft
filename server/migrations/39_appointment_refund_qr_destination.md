Appointment refunds support either an account holder and number or an uploaded QR image.
Existing refunds keep the account destination by default.

Before deploying the updated refund API, run from the repository root:

```powershell
node server/migrations/run-migration39.js
```

The runner uses `server/.env` and applies the changes in a transaction. The migration
can be rerun safely. It adds `destination_type` and `qr_code_url`, permits null
account fields for QR destinations, and requires a complete destination.

QR images use the same Cloudinary configuration as appointment payment proofs:
`VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET`.
