-- Supports deterministic recent-first pagination and actor/date filters.
-- Existing module/date, action/date, entity, and trigram indexes remain useful.
CREATE INDEX IF NOT EXISTS idx_audit_logs_timeline
  ON public.audit_logs (created_at DESC, audit_id DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_timeline
  ON public.audit_logs (user_id, created_at DESC, audit_id DESC);
