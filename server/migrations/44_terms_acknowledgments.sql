-- OAuth providers can provision an identity before the customer reviews terms.
-- Keep that registration pending until explicit acknowledgment is stored.
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_registration_pending BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS terms_acknowledgments (
  acknowledgment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id),
  terms_type TEXT NOT NULL CHECK (terms_type IN ('account', 'orders', 'customization')),
  terms_version TEXT NOT NULL,
  context TEXT NOT NULL CHECK (context IN ('registration', 'login', 'checkout')),
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checkout_id UUID,
  order_id UUID REFERENCES orders(order_id),
  CHECK ((context = 'checkout' AND checkout_id IS NOT NULL AND terms_type <> 'account') OR
         (context <> 'checkout' AND checkout_id IS NULL AND order_id IS NULL AND terms_type = 'account'))
);
CREATE UNIQUE INDEX IF NOT EXISTS terms_account_version_unique
  ON terms_acknowledgments (user_id, terms_version) WHERE terms_type = 'account';
CREATE UNIQUE INDEX IF NOT EXISTS terms_checkout_version_unique
  ON terms_acknowledgments (user_id, checkout_id, terms_type, terms_version) WHERE context = 'checkout';
CREATE INDEX IF NOT EXISTS terms_order_index ON terms_acknowledgments (order_id);
