-- Paid separately by the customer; excluded from order/payment totals.
-- NULL means the admin has not yet entered a shipping quote.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS additional_shipping_fee NUMERIC(12, 2)
  CHECK (additional_shipping_fee >= 0);
