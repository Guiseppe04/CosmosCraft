-- =============================================
-- MIGRATION 17: Add audit_logs CHECK constraint
-- =============================================

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;

ALTER TABLE audit_logs
    ADD CONSTRAINT audit_logs_action_check
    CHECK (action IN (
        'INSERT', 'insert', 'UPDATE', 'update', 'DELETE', 'delete',
        'VERIFY', 'verify', 'REJECT', 'reject', 'REFUND', 'refund',
        'LOGIN_ATTEMPT', 'login_attempt', 'PASSWORD_RESET', 'password_reset',
        'STOCK_ALERT', 'stock_alert', 'VOID', 'void', 'RETURN', 'return',
        'CANCEL', 'cancel', 'EXPORT', 'export', 'LOGOUT', 'logout',
        'auto_hold_overdue_installment', 'auto_hold_overdue_installment',
        'auto_resume_installment_paid', 'auto_resume_installment_paid',
        'refund_requested', 'refund_requested', 'project_part_received', 'project_part_received',
        'cancel_requested', 'cancel_requested', 'cancel_request_withdrawn', 'cancel_request_withdrawn',
        'cancel_approved', 'cancel_approved', 'refund_processing', 'refund_processing',
        'refund_refunded', 'refund_refunded',
        'INSERT', 'insert', 'PROJECT_CANCELLED', 'project_cancelled',
        'MILESTONE_UPDATED', 'milestone_updated', 'HOLD_REQUESTED', 'hold_requested',
        'PROJECT_RESUMED', 'project_resumed', 'VERIFY', 'verify',
        'SUBTASK_STATUS_CHANGED', 'subtask_status_changed',
        'REFUND_PENDING_PAYMENT_VERIFIED', 'refund_pending_payment_verified',
        'BUILD_CLAIM_CREATED', 'build_claim_created', 'PROJECT_PART_UNRECEIVED', 'project_part_unreceived',
        'WORKFLOW_INITIALIZED', 'workflow_initialized', 'REFUND_APPROVED', 'refund_approved',
        'UPDATE', 'update', 'PROJECT_CLAIMED', 'project_claimed', 'DELETE', 'delete'
    ));