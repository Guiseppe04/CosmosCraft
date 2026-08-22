# Sales Report Layout Update Plan

## Goal
Replace the current `SalesReportTab.jsx` content with the new polished layout provided by the user, adapted to use real `salesReport` prop data from the backend.

## Current State
- `client/src/app/pages/admin/tabs/SalesReportTab.jsx` uses a dark theme with CSS variables and its own print function.
- Backend `getSalesReport` returns: `grossSales`, `totalAdjustments`, `netSales`, `totalTransactions`, `averagePerTransaction`, `customizationOrders`, `channels`, `adjustmentsByType`, `adjustmentsByChannel`, `adjustmentRate`, `dailyTrend`, `bestSellingProducts`, `topAdjustedProducts`, `refundReasons`, `appointmentPaymentMethods`, and daily/weekly/monthly summary fields.
- `StatusBadge` exists at `client/src/app/pages/admin/components/shared/StatusBadge.jsx`.
- `DateRangePicker` does not exist and must be created.
- No `client/src/app/lib/data.js` exists; the provided layout's mock data imports must be replaced with derived values from the `salesReport` prop.

## Data Mapping (Backend → New Layout)

| New Layout Need | Backend Source | Notes |
|---|---|---|
| KPIs (gross, adjustments, net, txns, avg, customization) | `salesReport` top-level fields | Direct 1:1 mapping |
| Channel table + colors | `salesReport.channels` | Add color constants per channel |
| Sales trend chart | `salesReport.dailyTrend` | Backend has `revenue` only; map `revenue` → both `gross` and `net` for chart |
| Adjustments summary (refunds/returns/voids) | `salesReport.adjustmentsByType` | Map `type` to Refund/Return/Void labels |
| Adjustment rate | `salesReport.adjustmentRate` | Direct mapping |
| Adjustment detail table | `salesReport.adjustmentsByChannel` + `adjustmentsByType` | Backend lacks per-transaction history; show aggregated breakdown instead of detailed history rows |
| Top selling products | `salesReport.bestSellingProducts` | Map `name` → `product`, `revenue` → `gross`/`net`; `sku` and `category` are not returned by backend — omit or derive |
| Customization performance | `salesReport.customizationOrders` | Backend does not return type breakdown; show simplified KPI card and omit type table |
| Payment methods | `salesReport.appointmentPaymentMethods` | Backend only returns appointment payment methods; show section with available data only |

## Tasks

1. **Create `DateRangePicker`**
   - File: `client/src/app/pages/admin/tabs/shared/DateRangePicker.jsx`
   - Base: use the provided snippet.
   - Adapt imports: replace `../../lib/data` with a local `dateRangeLabels` map or inline the labels.
   - Replace `DateRange` type import with a local union type: `"today" | "yesterday" | "week" | "month" | "last_month" | "custom"`.

2. **Create `SalesReportTab` data helpers**
   - Inside `SalesReportTab.jsx`, derive all chart/table data from `salesReport` prop.
   - Add color constants for channels: Walk-in (`#10B981`), Online (`#3B82F6`), Customization (`#8B5CF6`), Appointments (`#F59E0B`).
   - Build `channelData` array with `channel`, `transactions`, `gross`, `adjustments`, `net`, `color`, and computed `% of Sales`.
   - Build `chartData` from `salesReport.dailyTrend` using `revenue` for both gross and net.
   - Build `sortedProducts` from `salesReport.bestSellingProducts`.
   - Build `adjustmentSummary` from `salesReport.adjustmentsByType` and `adjustmentsByChannel`.

3. **Rewrite `SalesReportTab.jsx`**
   - Replace the entire component body with the new layout structure.
   - Keep the existing prop interface (`salesReport`, `fetchSalesReport`, `loading`).
   - Preserve the existing preset/custom date logic (it already works and is more functional than the simple `DateRangePicker` dropdown shown in the snippet).
   - Update imports:
     - `StatusBadge` → `../../components/shared/StatusBadge`
     - Remove mock data imports (`../lib/data`).
     - Use existing `formatCurrency` from `../../../utils/formatCurrency`.
   - Replace `printSalesReport` with a print function that matches the new layout's sections, or remove it if the new layout doesn't require a separate print window.
   - Adapt the "Performance" section to use `salesReport.dailyTrend` as an area chart when data exists, and fall back to daily/weekly/monthly summary cards when `preset === 'all'`.

4. **Update Print Layout (if needed)**
   - The provided `PrintLayout` snippet imports from `../lib/data` and uses hardcoded values.
   - Either remove the separate print HTML and rely on `window.print()` with print CSS, or update it to accept `salesReport` as props.

5. **Validation**
   - Run `npm run build` to verify the client compiles.
   - Run `npm run dev` and manually verify the Sales Report tab renders with real data.

## Open Questions / Risks
- **Per-transaction adjustment history**: Backend does not return individual adjustment rows with dates/transaction IDs. The new layout's detailed adjustment history table cannot be populated without a new backend endpoint or query. **Decision**: Show aggregated adjustments by type and by channel instead.
- **Payment methods**: Backend only returns `appointmentPaymentMethods`. There is no overall payment-method breakdown across all channels. **Decision**: Show appointment payment methods in the payment section with a note, or hide the section if empty.
- **Top products `sku`/`category`**: Backend returns `name`, `units`, `revenue`, `category` but no `sku`. **Decision**: Show `name` and `category`, omit `sku`, use `revenue` for both gross and net columns.
- **Customization type breakdown**: Backend does not provide gross/net/orders by customization type. **Decision**: Show only the total customization orders KPI and skip the type breakdown table.
