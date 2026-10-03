Apply 27_appointment_refunds_rescheduling.sql before deploying the appointment changes. The migration extends appointment_status_enum and adds dedicated appointment_refunds storage, independent of product/project refunds.

Run the enum ALTER as its own committed statement if the migration runner wraps SQL files in transactions. No existing appointments are deleted or rewritten.

Older approved payments have no immutable approved_payment_amount. An admin must review and approve those payments again to capture the amount before a no-show refund can be requested. Do not populate this amount from current service prices without checking the original payment proof.

Refunds are manual transfers. Admins enter a transaction reference and may attach an HTTPS proof link. No payment provider API is invoked.
