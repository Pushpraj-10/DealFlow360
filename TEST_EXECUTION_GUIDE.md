# DealFlow360 E2E Test Execution Guide

## Prerequisites

1. **Backend running**: `cd backend && npm start` (Port 8001)
2. **Frontend running**: `cd frontend && npm run dev` (Port 3000)
3. **Database seeded**: Backend seed script must have run successfully
4. **Playwright installed**: `npx playwright install` (if not already done)

## Test Accounts

All passwords: `Password123!`

- Sales Rep: `sales.rep@dealflow360.test`
- Sales Manager: `sales.manager@dealflow360.test`
- Finance: `finance@dealflow360.test`
- Admin: `admin@dealflow360.test`
- Customer: `customer@acme.test`

## Running Tests

### Run all tests sequentially
```bash
npx playwright test --workers=1
```

### Run specific test file
```bash
npx playwright test tests/e2e/01-normal-quotation-flow.spec.ts
npx playwright test tests/e2e/02-discount-violation-approval.spec.ts
npx playwright test tests/e2e/04-upsell-cross-sell.spec.ts
npx playwright test tests/e2e/07-rbac-security.spec.ts
```

### Run with UI mode (interactive)
```bash
npx playwright test --ui
```

### Run with headed browser (visible)
```bash
npx playwright test --headed
```

### Run specific test by name
```bash
npx playwright test -g "Sales Rep: Create quotation"
```

## Test Structure

### Test 1: Normal Quotation Flow
- Creates quotation for Acme Corp
- Adds Laptop with valid discount
- Submits for approval
- Manager approves (if required)
- Customer views and confirms

**Key Validations:**
- Quote starts in DRAFT state
- Totals calculated correctly
- Margin/risk values from backend
- Approval workflow functional
- Customer cannot see internal data

### Test 2: Discount Violation and Approval
- Uses seed quotation `Q-SEED-GOLD-DISCOUNT-SCENARIO`
- Laptop: 12% discount (valid, under 15% limit)
- Setup Service: 18% discount (violation, exceeds 10% limit)
- Tests multi-level approval workflow

**Key Validations:**
- Backend calculates min(tier%, category%)
- Violation detected and displayed
- Risk score updates
- Manager approval works
- Finance approval (if high-risk)
- Approval order enforced

### Test 4: Upsell/Cross-Sell
- Creates new quotation
- Adds Laptop product
- Verifies recommendations appear (Extended Warranty, Support Plan)
- Adds recommendation to quote
- Verifies totals and margin update

**Key Validations:**
- Recommendations from backend API (not hardcoded)
- Expected revenue, margin delta, margin % displayed
- Add to quote creates real quotation line
- Total and margin update correctly
- Recommendation disappears after adding
- Changes persist after reload

### Test 7: RBAC and Security
- Customer cannot access internal routes
- Customer cannot see cost/margin/risk data
- Sales Rep cannot perform manager actions
- Sales Rep cannot access admin routes
- Manager can access approvals
- Finance can access finance routes
- Admin can access admin routes
- Customer cannot access other customers' data

## Viewing Results

### HTML Report
```bash
npx playwright show-report
```

### Screenshots
Failed tests automatically capture screenshots in:
- `test-results/` directory
- Named by test name and failure step

### Traces
Failed tests capture execution traces:
```bash
npx playwright show-trace test-results/trace.zip
```

## Test Data

### Products (from seed)
- **Laptop**: $1200, cost $850, Hardware, ONE_TIME
- **Setup Service**: $500, cost $250, Services, ONE_TIME
- **Extended Warranty**: $199, cost $80, Services, ONE_TIME
- **Support Plan**: $99/mo, cost $35, Subscription, RECURRING

### Customer
- **Acme Corp**: Gold tier (20% max discount)

### Discount Limits
- **Tiers**: Bronze 5%, Silver 10%, Gold 20%
- **Categories**: Hardware 15%, Services 10%, Subscription 12%
- **Policy**: min(tier limit, category limit) enforced

### Seed Quotation
- **Quote Number**: `Q-SEED-GOLD-DISCOUNT-SCENARIO`
- **Line 1**: Laptop, 12% discount (valid)
- **Line 2**: Setup Service, 18% discount (violation: +8%)

## Troubleshooting

### Tests fail immediately
- Check backend is running on port 8001
- Check frontend is running on port 3000
- Verify database is seeded

### Login fails
- Verify test account emails match seed data
- Check password is `Password123!`
- Ensure auth endpoints are working

### Quotation not found
- Seed script may not have run
- Database may have been reset
- Check backend logs for errors

### Recommendations don't appear
- Laptop must be added first (triggers upsell rules)
- Backend may return empty recommendations if rules inactive
- Check seed data for UpsellRule documents

### Timeouts
- Increase timeout in playwright.config.ts
- Network may be slow
- Backend API may be slow to respond

## Expected Test Results

Based on current implementation:

### Test 1: Normal Quotation Flow
**Expected**: ✅ PASS (if approval workflow implemented)
**May fail if**: Approval endpoints not fully functional

### Test 2: Discount Violation
**Expected**: ✅ PASS (backend logic exists)
**Validates**: Policy calculation, risk detection, approval chain

### Test 4: Upsell/Cross-Sell
**Expected**: ✅ PASS (just implemented)
**Validates**: Frontend integration with backend recommendations API

### Test 7: RBAC/Security
**Expected**: ✅ PASS (if route guards implemented)
**May fail if**: Some routes not properly protected

## Failure Classification

When a test fails, classify as:

1. **TEST ISSUE**: Wrong selector, incorrect assertion, timing issue
2. **FRONTEND ISSUE**: UI bug, display error, client-side logic
3. **BACKEND ISSUE**: API error, calculation error, server-side logic
4. **BUSINESS LOGIC ISSUE**: Incorrect requirement implementation
5. **RBAC/SECURITY ISSUE**: Unauthorized access, data leakage
6. **DATA ISSUE**: Missing seed data, incorrect test data
7. **ENVIRONMENT ISSUE**: Services not running, network problems

## Notes

- Tests run sequentially to avoid data conflicts
- Shared seed data may be mutated by tests
- Some tests depend on previous tests (quotation ID)
- Customer portal URLs may vary by implementation
- Approval workflows may require specific quotation states

## Next Steps

After running tests:
1. Review HTML report for pass/fail summary
2. Check screenshots for UI issues
3. Review traces for failed tests
4. Classify failures by category
5. Report defects with evidence
6. Do NOT modify product code to make tests pass
7. Fix test code only if test assumptions were wrong
