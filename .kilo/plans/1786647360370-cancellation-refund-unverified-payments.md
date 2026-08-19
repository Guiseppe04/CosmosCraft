# Cancellation & Refund Flow for Unverified Payments (Customization/Guitar Build)

## Step 0 — Investigation Summary

### 1. Database Schema

**`projects` table** — customization/build orders
- Key columns: `project_id`, `order_id`, `status` (`not_started`, `in_progress`, `completed`, `cancelled`, `on_hold`), `progress`, `claimed_by`, `claimed_at`, `custom_build_id`
- Cancellation columns: `cancel_option`, `cancel_reason`, `cancel_requested_at`, `cancel_approved_by`, `cancel_approved_at`
- Stage snapshot columns (migration 15): `last_completed_stage`, `last_completed_stage_at`, `cancelled_stage_snapshot`, `cancelled_stage_snapshot_at`

**`orders` table**
- Key columns: `order_id`, `user_id`, `status`, `payment_status` (`pending`, `proof_submitted`, `under_review`, `approved`, `rejected`, `failed`), `payment_plan` (`full_payment`, `installment`), `total_amount`, `notes`

**`payments` table**
- Key columns: `payment_id`, `order_id`, `user_id`, `method`, `amount`, `status` (`pending`, `for_verification`, `verified`, `rejected`, `cancelled`, `refunded`), `verified_by`, `verified_at`, `rejection_reason`, `metadata`
- Note: `payments.status` uses `for_verification` while `orders.payment_status` uses `proof_submitted`/`under_review`. The `orderPaymentStatus.js` utility maps `for_verification` → `proof_submitted` for UI display.

**`refund_requests` table** (extended by migration 15)
- Columns: `refund_request_id`, `order_id`, `user_id`, `project_id`, `payment_id`, `reason`, `customer_notes`, `amount_requested`, `build_stage_at_request`, `requested_amount_locked`, `status`
- Current status enum (CHECK constraint): `pending`, `approved`, `processing`, `rejected`, `refunded`
- Needs new value: `pending_payment_verification`

**`project_installment_schedules` table** — installment plans for custom builds

### 2. Payment Verification Flow

- Admin verifies/rejects via `PATCH /api/payments/:id/verify` and `PATCH /api/payments/:id/reject` (`paymentController.js`)
- `paymentService.verifyPayment`: sets `payments.status = 'verified'`, `orders.payment_status = 'approved'`
- `paymentService.rejectPayment`: sets `payments.status = 'rejected'`, `orders.payment_status = 'pending'`
- Admin UI: `PaymentApprovalModal.jsx` updates `orders.payment_status` via dropdown; the actual verify/reject endpoints are called separately
- No existing hook that fires when payment status changes to update refund requests

### 3. Project/Customization Lifecycle & Existing Cancellation Logic

**`projectService.js` key flows:**
- `claimProject`: staff/admin claims `not_started` project → sets `in_progress`, `claimed_by`
- `cancelProject` (line 1211): direct cancel. Currently allows cancel if `progress < 80` and not already cancelled/completed. Sets project+order to `cancelled`. **No refund handling.**
- `requestProjectCancel` (line 3081) + `approveProjectCancel` (line 3137): "Current Build Claim" flow for **started** projects. Customer requests with `cancel_option` (`ship_unfinished`/`pickup_unfinished`). Admin approves → sets `cancelled` + `fulfillment_status` + `cancelled_stage_snapshot`. **No refund handling.**
- `buildProjectTaskTracking`: computes status from task progress. `total > 0 && completed === 0` → `not_started`. `completed > 0` → `in_progress`.

### 4. Existing Refund System

**`projectRefundService.js`:**
- `getProjectRefundEligibility`: requires no build progress, verified payments exist, no existing pending/approved request, payment not already refunded
- `createProjectRefundRequest`: customer submits with reason. Status = `pending`. Amount capped at verified total. Server-side calculation.
- `updateProjectRefundStatus`: admin transitions. `PROJECT_REFUND_TRANSITIONS`: `pending → [approved, rejected]`, `approved → [processing]`, `processing → [refunded]`. On `refunded`, marks all verified payments as refunded.
- `projectRefund.test.js`: service-level mocked tests for eligibility, started-project exclusion, installment refunds, duplicate prevention, admin-only transitions, refunded-payment marking.

**`refund_requests` table** supports both order-scoped (delivered items) and project-scoped (custom builds) refunds via nullable `project_id`/`payment_id`.

### 5. Current Build Claim / Partial-Cancellation Flow

- `requestProjectCancel` + `approveProjectCancel` in `projectService.js`
- Used for **already-started** projects
- Sets `cancel_option`, `cancel_reason`, `cancel_requested_at` on project
- Admin approval sets `status = 'cancelled'`, `fulfillment_status = 'shipped_unfinished'` or `'awaiting_pickup_unfinished'`, snapshots stage, cancels order
- **No refund logic** — this task must not duplicate or modify this flow

### 6. Admin & Customer Components Needing Updates

**Customer:**
- `DashboardPage.jsx`: `openCancelProjectModal` + modal (lines 620-2712). Currently shows generic warning. Needs payment details and refund implications.
- `CustomerProjectTracker.jsx`: shows `refund_status` via `REFUND_STATUS_CONFIG`. Needs new `pending_payment_verification` state.

**Admin:**
- `RefundRequestsTab.jsx`: shows refund requests with `REFUND_STATUS_MAP`. Needs new status mapping.
- `ProjectsTab.jsx`: project cards. Could show refund status badges on cancelled projects.
- `PaymentApprovalModal.jsx`: updates payment status. No structural changes needed; the backend hook will auto-transition refunds.

---

## Plan

### Migration 16 — Add `pending_payment_verification` to refund status enum

**File:** `server/migrations/16_add_refund_pending_payment_verification.sql`

```sql
ALTER TABLE refund_requests
  DROP CONSTRAINT IF EXISTS refund_requests_status_check;

ALTER TABLE refund_requests
  ADD CONSTRAINT refund_requests_status_check
  CHECK (status IN ('pending', 'approved', 'processing', 'rejected', 'refunded', 'pending_payment_verification'));
```

No new columns needed. Existing `project_id`, `payment_id`, `amount_requested` from migration 15 are sufficient.

---

### Backend Changes

#### 1. Validation — `server/utils/validation.js`

- Update `refundStatusEnum` (line ~683) to include `'pending_payment_verification'`
- No other schema changes needed in validation.

#### 2. Refund Service — `server/services/projectRefundService.js`

- Update `PROJECT_REFUND_TRANSITIONS`:
  ```js
  const PROJECT_REFUND_TRANSITIONS = {
    pending: ['approved', 'rejected'],
    'pending_payment_verification': ['pending', 'rejected'],
    approved: ['processing'],
    processing: ['refunded'],
    rejected: [],
    refunded: [],
  };
  ```
- Add helper `transitionRefundStatusesForPayment(client, orderId, newPaymentStatus)` that:
  - Finds all `pending_payment_verification` refunds for the order/project
  - If `newPaymentStatus === 'verified'`: transitions each to `pending`, recomputes `amount_requested` from current verified payment total (see §Amount Naming below), logs audit
  - If `newPaymentStatus === 'rejected'`: transitions each to `rejected`, logs audit
- Update `updateProjectRefundStatus` to allow transitions from `pending_payment_verification`.

#### 3. Payment Service — `server/services/paymentService.js`

- In `verifyPayment` (after payment+order update, before COMMIT):
  - Call `transitionRefundStatusesForPayment(client, payment.order_id, 'verified')`
- In `rejectPayment` (after payment+order update, before COMMIT):
  - Call `transitionRefundStatusesForPayment(client, payment.order_id, 'rejected')`

#### 4. Project Service — `server/services/projectService.js`

- Modify `cancelProject` (line 1211):
  - Add `SELECT ... FOR UPDATE` on the project row at the top of the transaction to prevent concurrent cancel races:
    ```sql
    SELECT * FROM projects WHERE project_id = $1 AND deleted_at IS NULL FOR UPDATE
    ```
  - After ownership check, compute `tracking.status` via `buildProjectTaskTracking`
  - **New rule:** if requester is NOT privileged (`!['staff','admin','super_admin'].includes(userRole)`) AND `tracking.status !== 'not_started'` → throw `AppError('This project has already started. Please use the Current Build Claim flow to request cancellation.', 400)`
  - Proceed with existing cancel logic (project + order → `cancelled`)
  - **After cancel succeeds, inside the transaction:**
    - Query latest payment for `order_id`
    - If payment exists and status is `verified` or unverified (`pending`, `for_verification`):
      - Compute `submitted_amount` = that specific payment's `amount` (NOT summed verified total — see §Amount Naming below)
      - Check for existing pending/approved/pending_payment_verification refund for this project
      - If none exists:
        - `refundStatus = payment.status === 'verified' ? 'pending' : 'pending_payment_verification'`
        - `amount_requested = submitted_amount`
        - Insert `refund_requests` with `project_id`, `payment_id`, `amount_requested = submitted_amount`, `status = refundStatus`, `reason = 'Automatic refund request from project cancellation'`
        - Log audit
    - If payment is `rejected`/`cancelled`/`refunded` or no payment: no refund request created
  - Keep existing audit log for `project_cancelled`

#### 5. Controller & Routes

- No new routes needed. `POST /api/projects/:id/cancel` already exists and uses `cancelProject`.
- `projectController.js` `cancelProject` doesn't need changes — it delegates to service.

---

### Frontend Changes

#### 1. Customer Cancel Modal — `DashboardPage.jsx` (lines 2635-2712)

Enhance the cancel modal to show:
- Project name/ID
- Payment method, payment type (full/down), amount submitted
- Payment status (with color-coded badge)
- Project progress + started/not-started indicator
- Conditional messaging (literal copy locked below)
- Keep the explicit confirmation checkbox

#### 2. Cancel Button Behavior — `DashboardPage.jsx` (line 1676)

Change the cancel button condition:
- Currently: `project.progress < 80`
- New: `String(project.status || '').toLowerCase() === 'not_started'`
- For started projects, show a different button or message directing to Current Build Claim (`requestProjectCancel` flow)

#### 3. Customer Project Tracker — `CustomerProjectTracker.jsx`

- Add `pending_payment_verification` to `REFUND_STATUS_CONFIG` (line 56):
  ```js
  pending_payment_verification: { label: 'Refund Awaiting Payment Verification', className: 'border-violet-500/30 text-violet-400' },
  ```
- No other structural changes needed; the component already reads `hierarchy.refund_status`.

#### 4. Admin Refund Requests Tab — `RefundRequestsTab.jsx`

- Add `pending_payment_verification` to `REFUND_STATUS_MAP` (line 14):
  ```js
  pending_payment_verification: { label: 'Awaiting Payment Verification', color: '#8b5cf6', bgColor: 'bg-violet-500/20', textColor: 'text-violet-400', borderColor: 'border-violet-500/30' },
  ```
- **Button gating:** Approve/Reject buttons render only when `selectedRequest.status === 'pending'`. For `pending_payment_verification`, the buttons are hidden/disabled (only a note is shown: "Refund is pending payment verification. Verify or reject the payment first."). This matches the transition table which only allows `pending_payment_verification → [pending, rejected]`, not `approved`.

---

### Exact Customer-Facing Copy

**Cancel modal — not started + payment verified:**
> "Cancellation submitted successfully. Your payment has been verified. Your refund request is now waiting for admin approval."

**Cancel modal — not started + payment unverified (proof_submitted / for_verification):**
> "Cancellation submitted successfully. Your payment is still being verified by the admin. Once your payment is verified, your refund request can proceed."

**Cancel modal — not started + payment rejected/cancelled/refunded:**
> "Cancellation submitted successfully. No refund is available for this payment status."

**CustomerProjectTracker — refund status label for `pending_payment_verification`:**
> "Refund Awaiting Payment Verification — Your payment proof is being reviewed by the admin. Once verified, your refund request will be submitted for approval."

**CustomerProjectTracker — refund status label for `rejected` (after payment was rejected):**
> "Refund Unavailable — Your submitted payment proof was not verified by the admin."

**Admin RefundRequestsTab — tooltip/note for `pending_payment_verification`:**
> "Refund is pending payment verification. Verify or reject the associated payment first."

---

### Amount Naming Convention (addresses §2 ambiguity)

Use two distinct names to avoid confusion:

| Variable | Meaning | Used When |
|---|---|---|
| `submitted_amount` | The specific payment record's `amount` at cancellation time | Setting initial `amount_requested` during `cancelProject` |
| `verified_payment_total` | `SUM(payments.amount) WHERE status = 'verified'` for the order | Recomputing `amount_requested` in `transitionRefundStatusesForPayment` when payment is verified |

At cancel time:
- `amount_requested = submitted_amount` (the amount the customer actually submitted)
- If payment is already verified → status = `pending` (ready for admin approval)
- If payment is unverified → status = `pending_payment_verification`

When admin verifies the payment:
- `transitionRefundStatusesForPayment` recomputes `amount_requested = verified_payment_total`
- This handles installments correctly: if only some installments are verified, `verified_payment_total` reflects only those verified amounts
- If later more installments are verified, a subsequent payment verification triggers another recompute (see §5 below)

---

### Installment Plan Behavior (addresses §5)

- `amount_requested` at cancel time = the submitted payment's `amount` (single payment record)
- When admin verifies an installment payment, `transitionRefundStatusesForPayment` recomputes `amount_requested` from **all currently verified payments** for the order
- Partial installment verification does NOT auto-approve the refund — it only advances status from `pending_payment_verification` to `pending` and updates the amount
- If more installments are verified later, each `verifyPayment` call recomputes `amount_requested` again
- Refund is only approved/disbursed when an admin explicitly approves it
- A rejected installment payment transitions the refund to `rejected` — no refund issued

---

### Race Condition Prevention (addresses §3)

In `cancelProject`, after entering the transaction:
1. `SELECT ... FOR UPDATE` on the project row (and optionally the order row) to lock them for the duration of the transaction
2. The existing "check for existing pending/approved/pending_payment_verification refund" + atomic insert provides defense-in-depth
3. Optionally add a unique partial index on `refund_requests(project_id)` where `status IN ('pending', 'approved', 'pending_payment_verification')` — but this requires a migration and may conflict with the order-scoped refunds that also use `project_id`. Instead, rely on the FOR UPDATE lock + pre-check inside the transaction.

```sql
-- In the cancel transaction, after BEGIN:
SELECT * FROM projects WHERE project_id = $1 AND deleted_at IS NULL FOR UPDATE;
SELECT * FROM orders WHERE order_id = $1 FOR UPDATE;
```

---

### Tests

**File:** `server/tests/projectRefund.test.js` (extend existing)

Add test cases for:
1. Customer cancels not-started project with `proof_submitted` payment → refund created with `pending_payment_verification`, `amount_requested = submitted_amount`
2. Customer cancels not-started project with `verified` payment → refund created with `pending`, `amount_requested = submitted_amount`
3. Customer cancels started project → error directing to Current Build Claim flow
4. Admin verifies payment while refund is `pending_payment_verification` → refund auto-transitions to `pending`, `amount_requested` recomputed to `verified_payment_total`
5. Admin rejects payment while refund is `pending_payment_verification` → refund auto-transitions to `rejected`
6. Duplicate refund prevention — second cancel attempt on same project returns error or existing refund
7. Rejected payment at cancel time → no refund request created
8. Concurrent cancel — FOR UPDATE lock prevents race condition
9. Installment: partial verification advances to `pending` with proportional amount, not full contract amount
10. Transaction rollback on failure — project not cancelled if refund insert fails

---

### Out of Scope (explicitly excluded per task)

- Any change to the Current Build Claim / partial-refund flow for already-started projects (`requestProjectCancel` + `approveProjectCancel`)
- Payment gateway integration for actually moving money
- Changing existing payment verification UI beyond backend auto-transition hook

---

## Risks & Mitigations

- **Risk:** Existing admins using `cancelProject` for started projects may be blocked.
  - **Mitigation:** Only restrict for non-privileged users. Admins/staff keep existing `< 80% progress` behavior. If admins need to cancel started projects, they can use `requestProjectCancel` + `approveProjectCancel`.
- **Risk:** Race condition between concurrent cancel requests.
  - **Mitigation:** `SELECT ... FOR UPDATE` locks project and order rows within the transaction. Pre-check for existing refund + atomic insert provides defense-in-depth.
- **Risk:** Multiple payments on one order could create ambiguous refund state.
  - **Mitigation:** Snapshot refund status based on latest payment at cancellation time. Amount always derives from payment records server-side, with clear naming (`submitted_amount` vs `verified_payment_total`).
- **Risk:** Installment plans with partial verification could lead to incorrect refund amounts.
  - **Mitigation:** Each payment verification recomputes `amount_requested` from currently-verified payments. Refund is never auto-approved — admin must explicitly approve.
