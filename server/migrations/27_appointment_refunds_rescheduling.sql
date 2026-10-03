ALTER TYPE appointment_status_enum ADD VALUE IF NOT EXISTS 'rescheduled_by_customer';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS rescheduled_from UUID REFERENCES appointments(appointment_id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS approved_payment_amount NUMERIC(12,2);
CREATE UNIQUE INDEX IF NOT EXISTS appointments_one_successor ON appointments(rescheduled_from) WHERE rescheduled_from IS NOT NULL;
CREATE TABLE IF NOT EXISTS appointment_refunds (
 refund_request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 appointment_id UUID NOT NULL UNIQUE REFERENCES appointments(appointment_id),
 user_id UUID NOT NULL REFERENCES users(user_id),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','refunded','rejected')),
 amount_requested NUMERIC(12,2) NOT NULL CHECK(amount_requested > 0),
 original_payment JSONB NOT NULL,
 refund_method VARCHAR(100) NOT NULL,
 account_holder VARCHAR(200) NOT NULL,
 account_number VARCHAR(100) NOT NULL,
 reason TEXT, refund_reference VARCHAR(255), proof_url TEXT, admin_notes TEXT,
 reviewed_by UUID REFERENCES users(user_id), reviewed_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
