-- Reuse the return stock ledger from migration 20 on newer installations too.
CREATE TABLE IF NOT EXISTS refund_restock_log (
  restock_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_request_id UUID NOT NULL REFERENCES refund_requests(refund_request_id) ON DELETE CASCADE,
  order_item_id BIGINT REFERENCES order_items(order_item_id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(product_id) ON DELETE SET NULL,
  quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  restocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  restocked_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  UNIQUE(refund_request_id, order_item_id)
);
