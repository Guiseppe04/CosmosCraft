# Sales Report Overhaul — Implementation Plan

## Goal

Redesign the Sales Report to show Gross Sales, Sales Adjustments, Net Sales, and reliable cross-channel analytics with date filtering and print-ready output.

## Scope

Files to change:
- `server/services/reportService.js` — rewrite `getSalesReport()` 
- `server/controllers/reportController.js` — pass date filters
- `client/src/app/utils/adminApi.js` — forward date params
- `client/src/app/hooks/useInventoryAdmin.js` — accept and pass date filters
- `client/src/app/pages/admin/tabs/SalesReportTab.jsx` — full redesign (UI is unconstrained)

No new dependencies. No CSV export. No schema.sql changes.

## Key Decisions

| Decision | Answer | Evidence |
|----------|--------|----------|
| Revenue formula | `total_amount - tax_amount` for all channels | Tax is remittance, not shop revenue. POS `tax_amount` is always 0 (`posService.js:1053`), so POS numbers don't change but code becomes consistent. |
| Net Sales formula | `Gross Sales - Refunds - Returns - Voids` | Gives shop owners actual collected revenue. |
| Payment eligibility — Orders | `payment_status = 'approved'` | Orders use `order_payment_status_enum` (`schema.sql:26-33`). Only `approved` means verified payment. |
| Payment eligibility — POS | `payment_status = 'verified'` | POS uses `payment_status_enum` (`schema.sql:18-25`). Cash sales are auto-`verified` (`posService.js:72`). |
| Payment eligibility — Appointments | `payment_status = 'approved'` | Appointments share `order_payment_status_enum` values (`validation.js:880`). |
| Appointments as channel | Yes, 4th channel | Appointments already tracked separately; should be integrated. Revenue from `services.price` via JSONB join. |
| Adjustment source | `refund_requests` + `pos_sales.refund_amount` only | Do NOT query `payments.status = 'refunded'` — it's already synced from `refund_requests` via `syncPaymentsAndOrderToRefunded` (`refundService.js:84-99`), would double-count. |
| Partial refunds | Use actual refunded amount | `COALESCE(rr.refunded_amount, rr.approved_amount, 0)` — never subtract full order total for partial refunds. |
| Date filtering | Presets + custom range | Backend already accepts `start_date`/`end_date`; frontend never used them. |
| Print | Inline HTML/CSS, no Recharts canvas | Same pattern as current `printSalesReport()`. |
| CSV | Excluded this iteration | No line-item backend endpoint exists yet. |

## Backend: `reportService.js`

Replace `getSalesReport(filters)` with new logic accepting `{ start_date, end_date }`.

### Helper functions needed

- `revenueExpr(alias?)` — returns `COALESCE(alias.total_amount, 0) - COALESCE(alias.tax_amount, 0)`. Used for POS and order revenue.
- `buildDateFilter(startDate, endDate, column?)` — returns `{ clause, params }` for date range on a given column.
- `orderChannelExpr(isCustomization)` — returns SQL fragment for online vs customization channel classification using `EXISTS`/`NOT EXISTS` on `order_items.customization_id`.

### Query groups (run in parallel)

**1. Channel summaries** — one query per channel, each returning `{ transactions, gross, adjustments, net }`:

- **Walk-in**: `pos_sales WHERE status = 'completed' AND payment_status = 'verified' [dateRange]`
  - Gross: `SUM(total_amount - tax_amount)`
  - Adjustments: `COALESCE((SELECT SUM(refund_amount) FROM pos_sales WHERE status IN ('voided','returned') [dateRange]), 0)`
  - Net: `gross - adjustments`

- **Online**: `orders o WHERE status = 'delivered' AND payment_status = 'approved' AND NOT EXISTS (customization items) [dateRange]`
  - Gross: `SUM(total_amount - tax_amount)`
  - Adjustments: `COALESCE((SELECT SUM(COALESCE(rr.refunded_amount, rr.approved_amount, 0)) FROM refund_requests rr WHERE rr.order_id = o.order_id AND rr.status IN ('approved','refunded','processing')), 0)` — use LEFT JOIN + GROUP BY instead of correlated subquery for performance.

- **Customization**: `orders o WHERE status = 'delivered' AND payment_status = 'approved' AND EXISTS (customization items) [dateRange]`
  - Same gross/adjustments logic as Online.
  - Also include project-level refunds: `LEFT JOIN refund_requests rr ON (rr.order_id = o.order_id OR rr.project_id IS NOT NULL AND rr.project_id IN (SELECT project_id FROM projects WHERE order_id = o.order_id))`

- **Appointments**: `appointments a WHERE status = 'completed' AND payment_status = 'approved' AND payment_method IS NOT NULL [scheduled_at range]`
  - Gross: `COALESCE(SUM(s.price), 0)` via `jsonb_array_elements_text(a.services)` joining `services`
  - Adjustments: separate aggregated query: `SELECT COALESCE(SUM(COALESCE(rr.refunded_amount, rr.approved_amount, 0)), 0) FROM refund_requests rr JOIN appointments a ON rr.appointment_id = a.appointment_id WHERE a.status = 'completed' AND a.payment_status = 'approved' [dateRange]`
  - Net: gross - adjustments

**2. Adjustments by type**:
- `SELECT 'void' AS type, COUNT(*)::int, COALESCE(SUM(refund_amount),0) AS amount FROM pos_sales WHERE status = 'voided' [dateRange]`
- `SELECT 'return' AS type, COUNT(*)::int, COALESCE(SUM(refund_amount),0) FROM pos_sales WHERE status = 'returned' [dateRange]`
- `SELECT 'refund' AS type, COUNT(*)::int, COALESCE(SUM(COALESCE(refunded_amount, approved_amount, 0)),0) FROM refund_requests WHERE status IN ('approved','refunded','processing') [dateRange]`

**3. Adjustments by channel**:
- Walk-in: `pos_sales.status IN ('voided','returned')` → `SUM(refund_amount)` [dateRange]
- Online: `refund_requests rr JOIN orders o ON rr.order_id = o.order_id WHERE rr.status IN (...) AND o.payment_status = 'approved' AND NOT EXISTS customization items` [dateRange]
- Customization: same but `EXISTS customization items OR rr.project_id IS NOT NULL` [dateRange]
- Appointments: `refund_requests rr JOIN appointments a ON rr.appointment_id = a.appointment_id WHERE rr.status IN (...) AND a.payment_status = 'approved'` [dateRange]

**4. Daily trend** (only when date range is provided, max 60 days):
- `SELECT DATE_TRUNC('day', created_at) AS day, SUM(revenue) FROM (orders UNION pos_sales) WHERE ... GROUP BY day ORDER BY day`
- If no date range, skip this and return empty array.

**5. Best-selling products** (retain current UNION ALL pattern):
- Order items: `(oi.quantity * oi.unit_price) * (o.total_amount - o.tax_amount) / NULLIF(o.total_amount, 0)` to allocate tax-free revenue proportionally.
- POS items: `COALESCE(psi.subtotal, psi.quantity * psi.unit_price)`
- Join with `products` + `categories` for names.

**6. Top adjusted/returned products** (new):
- `refund_request_items` JOIN `products` → `SUM(refund_amount)` GROUP BY product
- UNION `pos_returns` JOIN `pos_sale_items` JOIN `products` → `SUM(quantity * unit_price)`
- Order by amount DESC, limit 10.

**7. Refund reasons** (new):
- `SELECT reason, COUNT(*)::int, COALESCE(SUM(COALESCE(refunded_amount, approved_amount, 0)),0) AS amount FROM refund_requests WHERE status IN ('approved','refunded','processing') AND reason IS NOT NULL GROUP BY reason ORDER BY count DESC LIMIT 10`

**8. Appointment payment methods** (retain, filter `payment_status = 'approved'`):
- Same JSONB services join, filtered by approved appointments.

### Response shape

```json
{
  "grossSales": 12345.67,
  "totalAdjustments": 1234.56,
  "netSales": 11111.11,
  "totalTransactions": 42,
  "averagePerTransaction": 264.55,
  "customizationOrders": 5,
  "channels": {
    "walkIn": { "gross": 5000, "adjustments": 300, "net": 4700, "transactions": 20 },
    "online": { "gross": 4000, "adjustments": 500, "net": 3500, "transactions": 12 },
    "customization": { "gross": 2000, "adjustments": 200, "net": 1800, "transactions": 5 },
    "appointments": { "gross": 1345.67, "adjustments": 234.56, "net": 1111.11, "transactions": 5 }
  },
  "adjustmentsByType": [
    { "type": "void", "count": 2, "amount": 500 },
    { "type": "return", "count": 3, "amount": 400 },
    { "type": "refund", "count": 1, "amount": 334.56 }
  ],
  "adjustmentsByChannel": [
    { "channel": "walkIn", "count": 2, "amount": 300 },
    ...
  ],
  "adjustmentRate": 10.0,
  "dailyTrend": [
    { "date": "2026-08-01", "revenue": 1200, "transactions": 5 },
    ...
  ],
  "bestSellingProducts": [
    { "name": "Product A", "units": 10, "revenue": 5000, "category": "Guitar" }
  ],
  "topAdjustedProducts": [
    { "name": "Product B", "adjustmentAmount": 500, "reason": "Defective" }
  ],
  "refundReasons": [
    { "reason": "Changed mind", "count": 3, "amount": 1500 }
  ],
  "appointmentPaymentMethods": [
    { "method": "gcash", "appointments": 3, "revenue": 900 }
  ]
}
```

## Backend: `reportController.js`

- `getSalesReport`: destructure `start_date`, `end_date` from `req.query` and pass to service.

## Backend: `adminApi.js`

- `getSalesReport(params = {})`: accept object with optional `start_date`/`end_date` and forward as query params.

## Frontend: `useInventoryAdmin.js`

- `fetchSalesReport({ start_date, end_date })` accepts optional date params, passes to `adminApi.getSalesReport()`.
- Fallback object includes all new fields.

## Frontend: `SalesReportTab.jsx` (full redesign)

Layout structure (top to bottom):

1. **Header bar**: Title + date range controls + Print button
   - Date range state: `{ preset: 'all'|'today'|'yesterday'|'week'|'month'|'last_month'|'custom', start_date, end_date }`
   - Preset buttons set state and trigger fetch. Custom inputs for manual range.
   - On preset change or date input blur → call `fetchSalesReport({ start_date, end_date })`

2. **KPI row** (6 cards):
   - Gross Sales — white card, bold number
   - Sales Adjustments — red accent, negative value
   - Net Sales — gold border/background, highlighted as primary metric
   - Total Transactions — blue accent
   - Average Transaction Value — green accent
   - Customization Orders — purple accent

3. **Channel breakdown** (4 cards in grid):
   - Each card: Channel name, Gross amount, Adjustments amount, Net amount, Transaction count
   - Walk-in (green), Online (blue), Customization (purple), Appointments (orange)
   - Visual: small horizontal bar showing Gross → Net with Adjustments as the gap

4. **Sales Adjustments detail section**:
   - Summary row: Refunds | Returns | Voids | Total | Adjustment Rate %
   - Channel breakdown table

5. **Performance section**:
   - If date range selected: daily trend chart (Recharts BarChart, max 60 days)
   - If no date range: Daily / Weekly / Monthly summary cards (legacy behavior)

6. **Top Performing Products** (table, same columns as current)

7. **Top Adjusted / Returned Products** (new table)

8. **Refund Reasons** (table)

9. **Appointment Payment Methods** (grid, same as current but reflects approved appointments only)

10. **Print button behavior**: Opens new window with complete HTML document. All data rendered as HTML tables — no Recharts canvas. `@media print` CSS for A4 layout. Includes: title, selected date range, generation timestamp, all KPIs, channels, adjustments, top products, top adjusted products, refund reasons, footer.

## Edge Cases

| Case | Handling |
|------|----------|
| Partial refund | `COALESCE(rr.refunded_amount, rr.approved_amount, 0)` — never full order total |
| POS void vs return | Both use `pos_sales.refund_amount`. Void sets it to `total_amount`. Return sets it to `totalRefund` (sum of unit_price × qty). |
| Customization order with project refund | Include `rr.project_id IS NOT NULL` joins via `projects.order_id` |
| No date range | Backend returns all-time data. Frontend shows Daily/Weekly/Monthly cards instead of trend chart. |
| Zero gross sales | `adjustmentRate = 0` to avoid division by zero. |
| Large date range | Daily trend limited to 60 days. Frontend can show "showing last 60 days" notice. |
| Appointment without payment_method | Excluded from revenue entirely. |
| Double-counting prevention | `refund_requests` is the single source of truth for order/project/appointment adjustments. `payments.status = 'refunded'` is never queried. |

## Validation

1. All SQL uses `total_amount - tax_amount` consistently.
2. Order channels filter on `payment_status = 'approved'`.
3. POS channel filters on `payment_status = 'verified'`.
4. Appointment channel filters on `payment_status = 'approved'`.
5. POS adjustments only from `pos_sales.status IN ('voided','returned')` using `refund_amount`.
6. Order/project/appointment adjustments only from `refund_requests` with `status IN ('approved','refunded','processing')`.
7. `payments.status = 'refunded'` is NOT queried anywhere in the report.
8. Partial refunds use actual refunded/approved amount, not full order total.
9. Best-selling products revenue allocation uses proportional `(total_amount - tax_amount) / total_amount` formula.
10. Server lint/typecheck passes.
11. Print preview shows clean A4 layout with all sections, no broken charts.
12. Date range filters correctly across all sections.
