# E2E Test Suite Summary

## Created Test Suites

### Test 03: Customer Negotiation → Reapproval
**File:** `03-customer-negotiation-reapproval.spec.ts`

**Routes Touched:**
- `/sales/quotations` - Quotation management
- `/sales/approvals` - Approval workflow
- `/sales/negotiations` - Negotiation management
- `/portal` - Customer portal

**APIs Touched:**
- `GET /api/v1/quotations/:id` - Get quotation details with version history
- `POST /api/v1/negotiations/quotations/:quotationId` - Customer creates negotiation
- `POST /api/v1/negotiations/:negotiationId/accept` - Sales Rep accepts negotiation
- `POST /api/v1/negotiations/:negotiationId/reject` - Sales Rep rejects negotiation
- `GET /api/v1/negotiations/quotations/:quotationId` - List negotiations for quotation
- `GET /api/v1/approvals` - List pending approvals

**Status Transitions:**
```
DRAFT 
  → PENDING_APPROVAL (if discount requires approval)
  → APPROVED
  → SENT_TO_CUSTOMER
  → UNDER_NEGOTIATION (when customer requests change)
  → REAPPROVAL_REQUIRED (when accepted negotiation exceeds limits)
  → APPROVED (after reapproval)
  → CONFIRMED (customer confirms)
```

**Key Verifications:**
- New quotation version created on negotiation acceptance
- Old approved version remains unchanged in history
- Totals, margin, and risk score recalculated for new version
- Reapproval triggered when negotiated discount exceeds limits
- Manager approval required for reapproval
- Finance approval if required by approval rules
- Customer can confirm final version
- Version history preserved via `negotiationHistory` in quotation response

**Expected Negotiation Message Types:**
- `LINE_QUESTION` - Customer asks about line item
- `QUANTITY_CHANGE` - Customer requests quantity change
- `PRICE_CHANGE` - Customer requests price change
- `COUNTER_DISCOUNT` - Customer proposes counter discount
- `GENERAL_COMMENT` - General negotiation message

---

### Test 05: Fulfillment → Multi-Warehouse → Backorder
**File:** `05-fulfillment-backorder.spec.ts`

**Routes Touched:**
- `/operations/fulfillment` - Fulfillment management
- `/operations/backorders` - Backorder tracking
- `/portal` - Customer portal (for order confirmation)

**APIs Touched:**
- `POST /api/v1/fulfillment` - Create fulfillment record
- `GET /api/v1/fulfillment/:id` - Get fulfillment details
- `GET /api/v1/fulfillment` - List fulfillments
- `POST /api/v1/fulfillment/:id/suggest` - Request warehouse split recommendation
- `POST /api/v1/fulfillment/:id/accept` - Accept recommended split
- `POST /api/v1/fulfillment/:id/override` - Override split manually
- `POST /api/v1/fulfillment/:id/ship` - Record shipment
- `GET /api/v1/backorders` - List backorders
- `POST /api/v1/backorders/:id/consolidate` - Consolidate backorder
- `GET /api/v1/inventory` - Check inventory levels

**Status Transitions:**
```
Fulfillment:
NOT_READY 
  → SPLIT_PROPOSED (after suggest)
  → RESERVED (after accept, stock available)
  → PARTIAL_BACKORDER (after accept, insufficient stock)
  → BACKORDER (fully backordered)
  → PARTIALLY_SHIPPED (some items shipped)
  → SHIPPED (all shipped)

Backorder:
OPEN 
  → PARTIALLY_RESOLVED (some stock allocated)
  → RESOLVED (fully resolved)
```

**Scenario A: Multi-Warehouse Split**
- Create order with quantity requiring multiple warehouses (15 Laptops)
- System recommends split across warehouses
- Verify allocations never exceed available stock per warehouse
- Accept recommendation persists allocations
- Inventory reserved quantities updated

**Scenario B: Backorder Creation**
- Create order exceeding total inventory (100 Laptops)
- System allocates available stock
- Remaining quantity creates backorder
- Fulfillment status changes to PARTIAL_BACKORDER
- Backorder record created with status OPEN

**Key Verifications:**
- Multi-warehouse allocation logic functions correctly
- Stock constraints respected (allocation ≤ available)
- Backorder creation when total stock insufficient
- Inventory reservation tracking accurate
- Fulfillment allocations persisted correctly

---

### Test 06: Hybrid Billing → Payment → Deal Health
**File:** `06-hybrid-billing-deal-health.spec.ts`

**Routes Touched:**
- `/finance/invoices` - Invoice management
- `/finance/payments` - Payment recording
- `/finance/subscriptions` - Subscription management
- `/management/deal-health` - Deal health alerts
- `/management/reports` - Reporting dashboard

**APIs Touched:**

**Invoicing:**
- `POST /api/v1/invoices` - Generate invoice from quotation
- `GET /api/v1/invoices/:id` - Get invoice details
- `GET /api/v1/invoices` - List invoices
- `POST /api/v1/invoices/:id/payments` - Record payment
- `GET /api/v1/credit-notes` - List credit notes
- `POST /api/v1/credit-notes` - Issue credit note

**Subscriptions:**
- `GET /api/v1/subscriptions` - List subscriptions
- `GET /api/v1/subscriptions/:id` - Get subscription details
- `POST /api/v1/subscriptions` - Create subscription
- `POST /api/v1/subscriptions/:id/modify` - Modify subscription
- `POST /api/v1/subscriptions/:id/cancel` - Cancel subscription
- `POST /api/v1/subscriptions/:id/proration-preview` - Preview proration

**Deal Health:**
- `GET /api/v1/deal-health` - List alerts
- `POST /api/v1/deal-health/:alertId/nudge` - Nudge alert
- `POST /api/v1/deal-health/:alertId/escalate` - Escalate alert
- `GET /api/v1/dashboard` - Dashboard aggregates

**Status Transitions:**
```
Invoice:
DRAFT 
  → UNPAID (after generation)
  → PARTIALLY_PAID (after partial payment)
  → PAID (fully paid)
  → CREDITED (credit note applied)
  → VOIDED (cancelled)

Subscription:
ACTIVE (from creation)
  → MODIFIED (after modification)
  → CANCELLED (after cancellation)

Deal Alert:
OPEN 
  → ACKNOWLEDGED (after nudge)
  → RESOLVED (issue fixed)
  → DISMISSED (ignored)
```

**Part 1: Hybrid Billing**
- Order contains ONE_TIME items (Laptop, Setup Service)
- Order contains RECURRING item (Support Plan)
- Invoice generated for one-time items only
- Subscription created for recurring item
- Billing schedule and next billing date set
- Invoice total = one-time items total (excludes recurring)

**Part 2: Payment Processing**
- Record 50% payment → status PARTIALLY_PAID
- Remaining balance calculated correctly
- Record remaining payment → status PAID
- Final balance = 0

**Part 3: Deal Health**
- Query alerts: STALLED, DISCOUNT_ANOMALY, DELIVERY_SLIPPAGE
- Test Nudge action (sends reminder)
- Test Escalate action (raises alert priority)
- Test Resolve action (marks alert resolved)
- Dashboard aggregates verified

**Key Verifications:**
- Hybrid billing correctly separates one-time vs recurring
- Subscription billing schedule configured
- Payment recording updates invoice status
- Balance calculation accurate
- Deal health alerts functional
- Alert actions (Nudge, Escalate) work if implemented

---

## Test Execution Notes

**DO NOT RUN YET** - Tests created as requested.

**Prerequisites:**
1. Backend running on `localhost:8001`
2. Frontend running on `localhost:3000`
3. Database seeded with test data
4. Test users created (see `tests/fixtures/test-data.ts`)

**Run Commands:**
```bash
# Run all E2E tests
npx playwright test tests/e2e

# Run specific test suite
npx playwright test tests/e2e/03-customer-negotiation-reapproval.spec.ts
npx playwright test tests/e2e/05-fulfillment-backorder.spec.ts
npx playwright test tests/e2e/06-hybrid-billing-deal-health.spec.ts

# Run with UI (headed mode)
npx playwright test tests/e2e/03-customer-negotiation-reapproval.spec.ts --headed

# Debug mode
npx playwright test tests/e2e/03-customer-negotiation-reapproval.spec.ts --debug
```

**Sequential Execution:**
Tests use `test.describe` and rely on state from previous tests within the same suite. Run with `workers=1` in `playwright.config.ts` to ensure sequential execution:

```typescript
workers: process.env.CI ? 1 : 1, // Sequential execution
```

---

## Discovered Blockers

### Potential Issues to Watch:

1. **Negotiation Frontend UI:**
   - Customer portal may need UI for initiating negotiations
   - Sales Rep negotiations page may need implementation
   - Button labels/selectors assumed from common patterns

2. **Fulfillment UI:**
   - Operations fulfillment page existence verified via routes
   - UI for warehouse split suggestions may vary
   - May need to use API-based testing for complex scenarios

3. **Deal Health:**
   - Alert generation may require specific conditions
   - Nudge/Escalate actions may be partially implemented
   - Dashboard aggregates depend on data availability

4. **Subscription Creation:**
   - May be triggered automatically on invoice generation
   - Timing of subscription creation needs verification
   - Billing schedule calculation depends on plan configuration

### Recommended Approach:

1. Run Test 03 first - tests negotiation flow
2. Then Test 05 - tests fulfillment logic
3. Finally Test 06 - tests billing and health monitoring

Each test uses API verification when UI may not be complete, ensuring backend functionality is tested even if frontend is partial.

---

## Test Architecture

**Pattern Used:**
- Sequential test steps within describe blocks
- State passed via module-level variables
- API verification when UI incomplete
- Graceful degradation with console logs
- `test.skip` for dependent tests

**Selector Strategy:**
- Prefer `getByRole`, `getByLabel`, `getByText`
- Fallback to `locator` with semantic patterns
- API-first verification for critical state

**Error Handling:**
- Timeout handling for async operations
- Visibility checks with fallbacks
- Console logging for debugging
- Skip dependent tests if prerequisites fail

---

## Next Steps

1. **Manual Review:** Inspect test code for business logic accuracy
2. **Dry Run:** Execute one test suite to verify API contracts
3. **Debug:** Fix any selector mismatches or API differences
4. **Document:** Update test report template with actual results
5. **Classify:** Use classification system for any failures found

**Classification System:**
- TEST ISSUE - Test code problem
- FRONTEND ISSUE - UI/component problem
- BACKEND ISSUE - API/service problem
- BUSINESS LOGIC ISSUE - Calculation/rule problem
- RBAC/SECURITY ISSUE - Authorization problem
- DATA ISSUE - Seed data problem
- ENVIRONMENT ISSUE - Infrastructure problem

