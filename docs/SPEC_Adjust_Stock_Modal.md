# Adjust Stock Modal - Design Specification

## Overview
This document outlines the design specification for an enhanced Adjust Stock Modal in the CosmosCraft inventory management system. The modal enables warehouse staff and inventory managers to easily increase or decrease stock quantities with clear visual feedback, validation, and accessibility compliance.

---

## 1. Visual Layout Specification

### 1.1 Modal Container
- **Dimensions**: 
  - Desktop: max-width 520px, centered
  - Mobile: full width with 16px padding
- **Background**: Surface dark (`bg-[var(--surface-dark)]`)
- **Border**: 1px solid border color (`border-[var(--border)]`)
- **Border radius**: 24px (rounded-3xl)
- **Shadow**: Large shadow for depth
- **Padding**: 24px (p-6)

### 1.2 Header Section
- **Title**: "Adjust Stock" - bold, 20px, white text
- **Close button**: X icon, top-right, 40px touch target
- **Subtitle**: Product name preview (if pre-selected)

### 1.3 Stock Level Visualization
```
┌─────────────────────────────────────────────────┐
│  Current Stock          New Stock (Preview)       │
│  ┌────────────┐        ┌────────────┐        │
│  │   145    │  →    │   155    │        │
│  │  units   │       │  +10    │        │
│  └────────────┘        └────────────┘        │
│  [██████████░░░]     [████████████]          │
└─────────────────────────────────────────────────┘
```
- **Current stock**: Large number display with visual progress bar
- **New stock**: Color-coded (green if increase, red if decrease)
- **Delta indicator**: Animated arrow showing direction

---

## 2. Component Specifications

### 2.1 Product Selector
| Feature | Specification |
|---------|----------------|
| Type | Searchable dropdown with autocomplete |
| Search | Real-time filtering as user types |
| Display | Product name + SKU + current stock |
| Empty state | "No products found" message |
| Loading | Skeleton while fetching |

```jsx
// Proposed implementation
<ProductSearchSelector
  products={visibleProducts}
  value={form.product_id}
  onChange={(product) => setForm({ 
    product_id: product.product_id,
    current_stock: product.stock 
  })}
  placeholder="Search by name or SKU..."
/>
```

### 2.2 Adjustment Type Selector
| Type | Label | Icon | Color |
|------|-------|------|-------|
| stock_in | Stock In (Add) | ArrowUpCircle | Green |
| stock_out | Stock Out (Remove) | ArrowDownCircle | Red |
| adjustment | Manual Set | Equal | Amber |

**UI Style**: Segmented button group
- Horizontal layout on desktop
- Vertical stack on mobile
- Active state: filled background

### 2.3 Quantity Input
| Feature | Specification |
|---------|----------------|
| Type | Number input with +/- stepper buttons |
| Min value | 1 (or allow negative for stock_out) |
| Max value | Current stock for subtract |
| Step | 1 (configurable) |
| Validation | Prevent negative final stock |

**Stepper Buttons**:
```
┌───┐
│ - │  ← decrement button
├───┤
│ 10 │  ← quantity input
├───┤
│ + │  ← increment button
└───┘
```

### 2.4 Reason/Category Selector
Categories for stock adjustments:

| Category | Description | Requires Notes |
|----------|-------------|----------------|
| damaged_goods | Items that are damaged/defective | Yes |
| restocking | Routine stock replenishment | No |
| cycle_count | Regular inventory count correction | Yes |
| received_shipment | New stock from supplier | No |
| returned_items | Customer returns | No |
| sale_adjustment | POS/external sales reconciliation | No |
| transfer_in | Stock transferred from另一个location | Yes |
| transfer_out | Stock transferred to另一个location | Yes |
| sample_item | Items given as samples | Yes |
| lost_missing | Lost or missing inventory | Yes |
| other | Other adjustment reason | Yes |

**UI**: Dropdown with grouped options

### 2.5 Notes Field
- **Type**: Textarea
- **Rows**: 3
- **Max length**: 500 characters
- **Placeholder**: "Add any additional details..."
- **Validation**: Required for specific reasons (marked with *)

---

## 3. Interaction Flow

### 3.1 Open Modal (from inventory table)
```
1. User clicks edit icon in inventory row
   ↓
2. Modal opens with product pre-selected
   ↓
3. Current stock level displayed
   ↓
4. User selects adjustment type
   ↓
5. User enters quantity
   ↓
6. New stock preview updates in real-time
   ↓
7. User selects reason
   ↓
8. User adds notes (if required)
   ↓
9. User clicks "Confirm Adjustment"
   ↓
10. Success toast displayed
   ↓
11. Modal closes, inventory refreshes
```

### 3.2 Validation Rules
| Rule | Error Message |
|------|---------------|
| No product selected | "Please select a product" |
| No adjustment type | "Please select adjustment type" |
| Quantity is empty | "Please enter quantity" |
| Quantity is 0 | "Quantity must be greater than 0" |
| Quantity exceeds stock (subtract) | "Insufficient stock. Available: {n}" |
| Result would be negative | "Stock cannot be negative" |
| No reason selected | "Please select a reason" |
| Notes required but empty | "Notes required for this reason" |

---

## 4. Visual Feedback Design

### 4.1 Stock Level Visualizer
```jsx
<StockVisualizer
  current={145}
  change={10}
  type="increase" // or "decrease"
  threshold={20} // low stock threshold
/>
```

### 4.2 Color Scheme
| State | Background | Text | Border |
|-------|-------------|------|--------|
| Normal | bg-green-500/10 | text-green-400 | border-green-500/30 |
| Warning | bg-amber-500/10 | text-amber-400 | border-amber-500/30 |
| Critical | bg-red-500/10 | text-red-400 | border-red-500/30 |
| Increase | bg-green-500/20 | text-green-400 | border-green-500/30 |
| Decrease | bg-red-500/20 | text-red-400 | border-red-500/30 |

### 4.3 Animations
- Stock number change: Count-up animation
- Progress bar: Smooth width transition (300ms ease)
- Success: Checkmark animation
- Error: Shake animation on invalid field

---

## 5. Accessibility Compliance

### 5.1 Keyboard Navigation
| Key | Action |
|-----|--------|
| Tab | Navigate between fields |
| Enter | Submit form (when valid) |
| Escape | Close modal |
| Arrow Up/Down | Adjust quantity in stepper |
| Arrow Up/Down | Navigate dropdown options |

### 5.2 Screen Reader
- Proper labels on all inputs
- Live region for stock preview updates
- Error announcements
- Focus management on open/close

### 5.3 ARIA Attributes
```jsx
<Modal
  role="dialog"
  aria-labelledby="modal-title"
  aria-describedby="modal-desc"
>
  <input
    aria-label="Current stock level"
    aria-live="polite"
  />
  <input
    aria-required="true"
    aria-invalid={hasError}
    aria-describedby="error-message"
  />
</Modal>
```

---

## 6. Mobile Responsive Design

### 6.1 Breakpoints
| Breakpoint | Width | Layout Changes |
|-----------|------|---------------|
| Mobile | < 640px | Single column, full width |
| Tablet | 640-1024px | Single column, 480px centered |
| Desktop | > 1024px | Two-column for large screens |

### 6.2 Touch Targets
- Minimum touch target: 44px × 44px
- Adequate spacing between interactive elements: 8px
- Stepper buttons: 48px height

### 6.3 Mobile-Specific Features
- Native number keyboard input
- Bottom sheet style on mobile (optional)
- Larger text for readability

---

## 7. API Integration

### 7.1 Request Payload
```json
{
  "product_id": "prod_123",
  "adjustment_type": "stock_in",
  "quantity": 10,
  "reason": "received_shipment",
  "notes": "PO-2024-0567",
  "performed_by": "user_456"
}
```

### 7.2 Response Handling
| Status | Action |
|--------|--------|
| 200 | Show success, refresh inventory |
| 400 | Show validation errors inline |
| 401 | Redirect to login |
| 500 | Show error toast, log error |

---

## 8. Example UI Mockup

```
┌──────────────────────────────────────────────────────┐
│  ×  Adjust Stock                              [HEADER] │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Product:                                           │
│  ┌──────────────────────────────────────────────┐   │
│  │ 🔍 Search products...                      ▼ │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Current Stock:  145 units                          │
│  ┌────────────────────────────────────────────┐     │
│  │ ████████████████████░░░░░░░░░░░░░░░░  │     │
│  └────────────────────────────────────────────┘     │
│                                                      │
│  ┌─────────────────────────────────────────────┐      │
│  │ [STOCK IN]  [STOCK OUT]  [MANUAL ADJUST] │      │
│  └─────────────────────────────────────────────┘      │
│                                                      │
│  Quantity:                                          │
│  ┌───┐    ┌────────┐    ┌───┐                       │
│  │ - │    │   10   │    │ + │                       │
│  └───┘    └────────┘    └───┘                       │
│                                                      │
│  New Stock: 155 units  (+10)         [PREVIEW]       │
│  ┌────────────────────────────────────────────┐     │
│  │ ████████████████████████████████░░░░░░░  │     │
│  └────────────────────────────────────────────┘     │
│                                                      │
│  Reason:                                            │
│  ┌──────────────────────────────────────────────┐   │
│  │ Received Shipment                        ▼ │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Notes (optional):                                  │
│  ┌──────────────────────────────────────────────┐   │
│  │                                              │   │
│  │                                              │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌─────────────────┐  ┌─────────────────────┐    │
│  │    Cancel       │  │  Confirm Adjustment  │    │
│  └─────────────────┘  └─────────────────────┘    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 9. Success/Error States

### 9.1 Success State
- ✓ Checkmark animation
- Toast: "Stock adjusted successfully"
- Inventory table refreshes
- Modal closes after 1.5s delay (optional)

### 9.2 Error State
- Inline error messages below invalid fields
- Red border on invalid inputs
- Shake animation on error
- Error toast for API failures

---

## 10. Implementation Priority

| Priority | Feature | Description |
|----------|---------|-------------|
| P0 | Product selector | Searchable dropdown |
| P0 | Quantity input | With validation |
| P0 | Reason selector | With categorized options |
| P1 | Stock preview | Real-time visualization |
| P1 | Validation | All rules implemented |
| P2 | Animations | Visual feedback |
| P2 | Accessibility | Keyboard + ARIA |
| P3 | Mobile optimization | Touch-friendly |
| FTR | History log | View past adjustments |