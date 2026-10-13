# Private per-item dispatch photos

Run `node server/migrations/run-migration51.js` before shipping through the updated application. Existing shipments are preserved without retroactive photo requirements.

Regular order transitions to **Shipped**, custom fulfillment transitions to **Out for Delivery**, and unfinished-build courier transitions to **Out for Delivery** require 1–5 PNG/JPEG/WebP photos per shipped item (5 MB each; 50 MB total per upload). Photos must show all units when quantity exceeds one. The system verifies item membership and file format/size; staff must check what the photos actually depict.

Shipment status and photo inserts commit together or roll back together. Custom fulfillment/claim dispatch includes the order's customized items; whole-order shipping includes all order items. Pickup fulfillment/claims remain exempt. Existing tracking, shipping-fee and payment checks remain in place.

The private `order_dispatch_photos` table stores item identity/name and quantity at dispatch, dispatch key, uploader, upload time, MIME type, and bytes. Originals cannot be updated, deleted or truncated. Supplemental photos append with a mandatory explanation after originals exist and never replace them. The audit trigger records only metadata and runs within the same transaction, supporting the deployed trigger-only audit-history guard. Existing managed order/claim audit triggers receive transaction-local actor context.

Authenticated admins, super admins and staff can list/view dispatch evidence and append supplemental photos. Customers cannot access these endpoints or the private table. Bytes are not added to order/refund/customer/socket payloads. Order details and refund review show protected previews and the existing zoom viewer, alongside customer/return evidence where the viewer's refund permissions allow it.

Endpoints: GET/POST `/api/orders/:orderId/dispatch-photos`, GET `/api/orders/dispatch-photos/:photoId`. Status update bodies carry `itemPhotos:[{order_item_id,images:[dataURL]}]`; the backend derives the required items and never trusts a client-selected shipment scope.

Photos support investigation, not automatic blame or refund decisions. New requirements do not activate unconfirmed refund policies.
