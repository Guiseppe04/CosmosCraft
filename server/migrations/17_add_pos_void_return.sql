-- =============================================
-- MIGRATION 17: POS Void/Return Feature
-- =============================================

-- 1. Extend pos_sale_status_enum to support voided and returned statuses.
--    PostgreSQL cannot ALTER an enum in place, so we create a new type,
--    alter the column, drop the old type, and rename the new one.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'pos_sale_status_enum_new'
    ) THEN
        CREATE TYPE pos_sale_status_enum_new AS ENUM (
            'pending', 'completed', 'cancelled', 'refunded', 'voided', 'returned'
        );
    END IF;
END $$;

ALTER TABLE pos_sales
    ALTER COLUMN status DROP DEFAULT;

ALTER TABLE pos_sales
    ALTER COLUMN status TYPE pos_sale_status_enum_new
    USING status::text::pos_sale_status_enum_new;

ALTER TABLE pos_sales
    ALTER COLUMN status SET DEFAULT 'pending';

DROP TYPE IF EXISTS pos_sale_status_enum;

ALTER TYPE pos_sale_status_enum_new RENAME TO pos_sale_status_enum;

-- 2. Add void/return tracking columns to pos_sales.
ALTER TABLE pos_sales
    ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS void_reason TEXT,
    ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS returned_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS return_reason TEXT,
    ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (refund_amount >= 0);

-- 3. Create pos_returns table for detailed return tracking.
CREATE TABLE IF NOT EXISTS pos_returns (
    return_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL,
    item_id BIGINT,
    product_id UUID,
    quantity INT NOT NULL CHECK (quantity > 0),
    item_condition VARCHAR(20) NOT NULL CHECK (item_condition IN ('resalable', 'damaged')),
    inventory_before INT,
    inventory_after INT,
    restocked BOOLEAN NOT NULL DEFAULT FALSE,
    reason TEXT,
    processed_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (sale_id) REFERENCES pos_sales(sale_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES pos_sale_items(item_id) ON DELETE SET NULL,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL,
    FOREIGN KEY (processed_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pos_returns_sale_id ON pos_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_pos_returns_product_id ON pos_returns(product_id);
CREATE INDEX IF NOT EXISTS idx_pos_returns_created_at ON pos_returns(created_at DESC);

-- 4. Extend audit_logs CHECK constraint to allow VOID and RETURN actions.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'audit_logs_action_check'
          AND conrelid = 'audit_logs'::regclass
    ) THEN
        ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_action_check;
    END IF;
END $$;

ALTER TABLE audit_logs
    ADD CONSTRAINT audit_logs_action_check
    CHECK (action IN (
        'insert', 'update', 'delete', 'verify', 'reject', 'refund',
        'login_attempt', 'password_reset', 'stock_alert', 'void', 'return',
        'cancel', 'export', 'logout',
        'auto_hold_overdue_installment', 'auto_resume_installment_paid',
        'refund_requested', 'project_part_received', 'cancel_requested', 'cancel_request_withdrawn',
        'cancel_approved', 'refund_processing', 'refund_refunded', 'INSERT',
        'project_cancelled', 'milestone_updated', 'hold_requested', 'project_resumed',
        'VERIFY', 'subtask_status_changed', 'refund_pending_payment_verified',
        'build_claim_created', 'project_part_unreceived', 'workflow_initialized',
        'refund_approved', 'UPDATE', 'project_claimed', 'DELETE'
    ));
