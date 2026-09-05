# Quotation Builder Redesign - Testing Guide

## Quick Start

1. Start the backend: `cd backend && npm start`
2. Start the frontend: `cd frontend && npm run dev`
3. Login as Sales Rep
4. Navigate to: **Quotations**

## Test Scenarios

### Scenario 1: Create and Build a Clean Quotation
**Purpose:** Verify basic functionality without violations

1. Click "New quotation"
2. Select a customer
3. Click "Create Draft"
4. **Expected:** New quotation appears in table and is selected
5. In the "Add line item" form:
   - Select a product (e.g., "Laptop")
   - Quantity: 2
   - Discount: 5%
6. Click "Add line"
7. **Expected:**
   - Line appears in the list
   - Shows: "Laptop | 2 × $[price] | Discount 5%"
   - No violation warning
   - Summary sidebar updates with totals

8. Add another line with 0% discount
9. **Expected:**
   - Second line appears
   - Summary shows updated totals
   - Margin appears in summary (if provided by backend)

### Scenario 2: Create a Quotation with Violations
**Purpose:** Verify violation display is refined, not aggressive

1. Create a new quotation
2. Add a line with high discount (e.g., 20%)
3. **Expected:**
   - Line appears with subtle red/amber background
   - Inline violation warning shows:
     - "20% discount · policy limit 15%"
     - "5% above policy"
   - Warning uses AlertTriangle icon
   - NOT a bright red background

4. Check Commercial Summary:
   - Risk section appears
   - Risk badge shows severity (HIGH/MEDIUM)
   - Details list the violation
   - Clear explanation: "Product discount exceeds policy by X%"

### Scenario 3: Submit for Approval
**Purpose:** Verify submit workflow unchanged

1. Build a quotation with at least one line
2. Click "Submit for Approval" in summary sidebar
3. **Expected:**
   - Success message appears
   - If violations exist: "routed for approval"
   - If no violations: "no approval required"
   - Quotation status updates in table

### Scenario 4: Navigate Between Quotations
**Purpose:** Verify selection and data loading

1. Create multiple quotations (or use existing)
2. Click different rows in the quotation table
3. **Expected:**
   - Selected row highlights
   - Main content updates with correct lines
   - Summary updates with correct totals
   - No data mixing between quotations

### Scenario 5: Search and Filter
**Purpose:** Verify list functionality unchanged

1. Use search box to search for customer name
2. **Expected:** Table filters correctly
3. Use status dropdown to filter
4. **Expected:** Table shows only matching statuses
5. Clear filters
6. **Expected:** All quotations visible again

### Scenario 6: Responsive Testing
**Purpose:** Verify mobile/tablet layouts

**Desktop (>1200px):**
- Main content should be ~70% width
- Summary sidebar ~30% width on right
- Summary should be sticky when scrolling

**Tablet (800-1200px):**
- Layout switches to single column
- Main content appears first
- Summary appears below
- Form fields stack appropriately

**Mobile (<800px):**
- All content stacks
- Form uses single column
- Buttons are full width
- Text sizes adjust

### Scenario 7: Empty States
**Purpose:** Verify empty state displays

1. Create new quotation
2. Don't add any lines
3. **Expected:**
   - Empty state message: "No line items yet. Add products below to get started."
   - Summary shows $0 for all amounts
   - Submit button still available (backend will validate)

### Scenario 8: Multiple Violations
**Purpose:** Verify all violations shown

1. Create quotation with 3+ lines
2. Make 2 or more have violations
3. **Expected:**
   - Each violation line has inline warning
   - Risk section in summary lists ALL violations
   - Each violation clearly identified
   - Excess amounts shown for each

### Scenario 9: Margin Display
**Purpose:** Verify margin information shows when available

1. Create quotation with lines
2. Submit (to trigger backend calculations)
3. Reload or navigate away and back
4. **Expected:**
   - Margin percentage appears in summary
   - Displayed as: "Margin: 28%" (or similar)
   - Green text for positive margin

### Scenario 10: Approval Status Display
**Purpose:** Verify approval information shown

1. Create quotation requiring approval
2. Submit it
3. **Expected:**
   - Approval section appears in summary
   - Shows approval status
   - Clear and readable

## Visual Checklist

### Header Section
- [ ] Quote number displayed prominently
- [ ] Customer name large and clear
- [ ] Status badge shown (not oversized)
- [ ] Clean layout, not cluttered

### Line Items
- [ ] Product name is bold and prominent
- [ ] Quantity × price format clear
- [ ] Discount shown inline if present
- [ ] Policy limit shown if relevant
- [ ] Line total right-aligned
- [ ] Cards have subtle hover effect
- [ ] Violations have SUBTLE red tint (not bright)

### Violation Warnings
- [ ] AlertTriangle icon present
- [ ] Clear message: "X% discount · policy limit Y%"
- [ ] Excess clearly stated: "Z% above policy"
- [ ] Muted semantic colors (red/amber)
- [ ] NOT aggressive bright red
- [ ] Border or divider separates warning from line details

### Commercial Summary
- [ ] "Commercial Summary" title clear
- [ ] Subtotal shown
- [ ] Discount shown (negative, if present)
- [ ] Tax shown (if applicable)
- [ ] Divider line before total
- [ ] Total emphasized (large, bold)
- [ ] Margin shown if available
- [ ] Risk section appears only if risk exists
- [ ] Risk badge clear (HIGH/MEDIUM/LOW)
- [ ] Risk details listed below badge
- [ ] Approval section appears only if needed
- [ ] Actions at bottom with proper hierarchy

### Actions
- [ ] "Submit for Approval" button primary style (blue)
- [ ] "Save Draft" button secondary style
- [ ] Both buttons full-width in sidebar
- [ ] Proper spacing between buttons

### Add Line Form
- [ ] "Add line item" title clear
- [ ] Product dropdown full-width (2fr)
- [ ] Quantity field medium (1fr)
- [ ] Discount field medium (1fr)
- [ ] Add button below fields
- [ ] Form visually separated from lines above

## Browser Testing

Test in these browsers:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

## Device Testing

Test on these viewport sizes:
- [ ] Desktop: 1920x1080
- [ ] Laptop: 1366x768
- [ ] Tablet: 768x1024
- [ ] Mobile: 375x667

## Performance Checks

- [ ] Page loads in <2 seconds
- [ ] Line item adds respond instantly
- [ ] Summary updates immediately
- [ ] No flickering or layout shift
- [ ] Scrolling is smooth
- [ ] No console errors
- [ ] No console warnings

## Accessibility Checks

- [ ] Can tab through form fields
- [ ] Submit button keyboard accessible
- [ ] Status badges readable
- [ ] Sufficient color contrast
- [ ] Icons have semantic meaning
- [ ] Focus indicators visible

## Data Integrity

After each test:
- [ ] Refresh page → data persists
- [ ] Navigate away and back → state correct
- [ ] Create multiple quotations → no mixing
- [ ] Backend data matches frontend display

## Known Limitations

These are INTENTIONAL (per requirements):
- ❌ Line items are NOT editable inline (would need API change)
- ❌ Save Draft button is disabled (handler preserved but not wired)
- ❌ Upsell/cross-sell not shown (logic preserved, UI ready)
- ❌ No drag-and-drop reordering
- ❌ No quantity/discount inline editing

## Regression Testing

Verify these still work:
- [ ] Table selection
- [ ] Search functionality
- [ ] Status filtering
- [ ] New quotation creation
- [ ] Line item addition
- [ ] Submit for approval
- [ ] Error handling
- [ ] Loading states

## Success Criteria

The redesign is successful if:
1. ✅ All scenarios pass
2. ✅ No functionality is broken
3. ✅ Violations are clearly shown but not aggressive
4. ✅ Commercial summary provides better insights
5. ✅ Layout works on all devices
6. ✅ No backend changes were needed
7. ✅ Performance is maintained
8. ✅ Design looks professional and polished

## Reporting Issues

If you find issues, note:
1. Scenario being tested
2. Steps to reproduce
3. Expected behavior
4. Actual behavior
5. Browser and viewport size
6. Screenshot if applicable

## Quick Smoke Test (2 minutes)

1. Login → Navigate to Quotations ✓
2. Create quotation → Select customer ✓
3. Add line → Verify appears ✓
4. Add line with high discount → Verify violation shown subtly ✓
5. Check summary → Verify totals correct ✓
6. Resize browser → Verify responsive ✓
7. Submit → Verify success message ✓

If all 7 steps pass, basic functionality is confirmed.
