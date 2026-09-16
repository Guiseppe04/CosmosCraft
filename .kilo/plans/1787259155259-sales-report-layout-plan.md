# Sales Report Layout Plan

## Goal
Adapt the user-provided SalesReport layout to use real `salesReport` prop data. No mock data.

## Current State
- `SalesReportTab.jsx` has dark-theme UI with its own print function.
- Backend `getSalesReport` returns: `grossSales`, `totalAdjustments`, `netSales`, `totalTransactions`, `averagePerTransaction`, `customizationOrders`, `channels`, `adjustmentsByType`, `adjustmentsByChannel`, `adjustmentRate`, `dailyTrend`, `bestSellingProducts`, `topAdjustedProducts`, `refundReasons`, `appointmentPaymentMethods`.
- `StatusBadge` exists at `../../components/shared/StatusBadge`.
- `DateRangePicker` does not exist.

## Data Mapping

| Layout Section | Backend Source | Adaptation |
|---|---|---|
| KPIs (6 cards) | `salesReport` top-level fields | Direct 1:1 |
| Channel table + colors | `salesReport.channels` | Add hardcoded colors: Walk-in `#10B981`, Online `#3B82F6`, Customization `#8B5CF6`, Appointments `#F59E0B` |
| Sales trend chart | `salesReport.dailyTrend` | Backend has `revenue` + `transactions` only; use `revenue` for both `gross` and `net` in chart data |
| Adjustments summary | `salesReport.adjustmentsByType` | Map `type` to `Refund` / `Return` / `Void` labels |
| Adjustment detail table | `salesReport.adjustmentsByChannel` | Show aggregated channel breakdown instead of per-transaction rows (backend lacks date/transaction/reason fields) |
| Top selling products | `salesReport.bestSellingProducts` | Map `name` → `product`, `revenue` → `gross`/`net`; omit `sku` (not returned by backend); include `category` |
| Customization performance | `salesReport.customizationOrders` | Show KPI only; omit type breakdown table (backend doesn't return type-level gross/net) |
| Payment methods | `salesReport.appointmentPaymentMethods` | Show if data exists; omit pie chart if empty |
| Daily/Weekly/Monthly toggle | `salesReport.dailyTrend` | Use `dailyTrend` for daily view; derive weekly/monthly by aggregating `dailyTrend` chunks |

## Implementation Tasks

1. **Create `DateRangePicker`**
   - File: `client/src/app/pages/admin/tabs/shared/DateRangePicker.jsx`
   - Use the provided snippet.
   - Remove `../../lib/data` imports; inline `dateRangeLabels` and `DateRange` type.
   - Props: `value: "today" | "yesterday" | "week" | "month" | "last_month" | "custom"`, `onChange: (v) => void`.

2. **Refactor `SalesReportTab.jsx`**
   - Keep existing prop interface: `salesReport`, `fetchSalesReport`, `loading`.
   - Keep existing preset/custom date logic (it is more functional than the simple picker).
   - Remove all `../lib/data` imports.
   - Add `formatCurrency` from `../../../utils/formatCurrency`.
   - Import `StatusBadge` from `../../components/shared/StatusBadge`.
   - Add `recharts` imports: `AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend`.
   - Derive all data from `salesReport` prop:
     - `channelData`: map `salesReport.channels` with colors and `% of Sales`.
     - `chartData`: map `salesReport.dailyTrend` (`date`, `gross: revenue`, `net: revenue`, `transactions`); add `groupWeekly` helper.
     - `sortedProducts`: map `salesReport.bestSellingProducts` with sort state.
     - `adjustmentSummary`: compute refunds/returns/voids from `adjustmentsByType`.
   - Replace print function with one that uses real `salesReport` data and the new layout sections.
   - Preserve the new layout's visual structure: header, filters, KPIs, trend chart, channel analysis, adjustments, top products, customization, payment methods.

3. **Validation**
   - `npm run build` to verify compilation.
   - `npm run dev` and verify Sales Report renders with real data.

## Risks
- Backend lacks per-transaction adjustment history (date, transaction ID, reason). The layout's detailed history table will show aggregated channel data instead.
- `bestSellingProducts` lacks `sku`. Omit SKU column.
- `customizationTypes` breakdown not available. Show only total customization orders KPI.
- Payment methods section only has appointment data. Show it conditionally.
