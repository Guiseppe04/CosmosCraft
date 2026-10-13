CREATE TABLE IF NOT EXISTS order_dispatch_photos (
  photo_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(order_id),
  order_item_id BIGINT NOT NULL REFERENCES order_items(order_item_id),
  dispatch_key TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('pre_dispatch','supplemental')),
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png','image/jpeg','image/webp')),
  file_data BYTEA NOT NULL CHECK (octet_length(file_data) BETWEEN 12 AND 5242880),
  uploaded_by UUID NOT NULL REFERENCES users(user_id),
  addition_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dispatch_photos_order ON order_dispatch_photos(order_id,created_at);
REVOKE ALL ON order_dispatch_photos FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON order_dispatch_photos FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON order_dispatch_photos FROM authenticated; END IF;
END $$;
CREATE OR REPLACE FUNCTION protect_dispatch_photos() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Dispatch photos are preserved evidence and cannot be edited or deleted'; END $$;
DROP TRIGGER IF EXISTS trg_dispatch_photos_immutable ON order_dispatch_photos;
CREATE TRIGGER trg_dispatch_photos_immutable BEFORE UPDATE OR DELETE ON order_dispatch_photos FOR EACH ROW EXECUTE FUNCTION protect_dispatch_photos();
DROP TRIGGER IF EXISTS trg_dispatch_photos_no_truncate ON order_dispatch_photos;
CREATE TRIGGER trg_dispatch_photos_no_truncate BEFORE TRUNCATE ON order_dispatch_photos FOR EACH STATEMENT EXECUTE FUNCTION protect_dispatch_photos();
-- Record metadata only: private image bytes never enter audit history.
CREATE OR REPLACE FUNCTION audit_dispatch_photo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details,context)
  VALUES(NEW.uploaded_by,'INSERT','order',NEW.order_id,
    jsonb_build_object('photo_id',NEW.photo_id,'order_item_id',NEW.order_item_id,'dispatch_key',NEW.dispatch_key,
      'phase',NEW.phase,'quantity',NEW.quantity,'addition_reason',NEW.addition_reason),
    jsonb_build_object('source','dispatch_photo','order_id',NEW.order_id,'item_name',NEW.item_name));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_dispatch_photo_audit ON order_dispatch_photos;
CREATE TRIGGER trg_dispatch_photo_audit AFTER INSERT ON order_dispatch_photos FOR EACH ROW EXECUTE FUNCTION audit_dispatch_photo();
