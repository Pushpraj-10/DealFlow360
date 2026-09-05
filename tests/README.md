# DealFlow360 E2E Tests

Browser-based end-to-end tests using Playwright.

## Prerequisites

1. **Backend running:** `cd backend && npm start` (port 8001)
2. **Frontend running:** `cd frontend && npm run dev` (port 3000)
3. **Database seeded:** Ensure test accounts exist in MongoDB

## Test Accounts

All passwords: `Password123!`

| Role | Email |
|------|-------|
| Sales Rep | sales.rep@dealflow360.test |
| Sales Manager | sales.manager@dealflow360.test |
| Finance | finance@dealflow360.test |
| Admin | admin@dealflow360.test |
| Customer | customer@acme.test |

## Installation

```bash
# Install Playwright
npm install -D @playwright/test

# Install browsers (if not already done)
npx playwright install chromium
```

## Running Tests

```bash
# Run all tests (headless)
npm run test:e2e

# Run with browser visible
npm run test:e2e:headed

# Open UI mode (interactive)
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug

# View last test report
npm run test:e2e:report

# Generate test code
npm run test:e2e:codegen
```

## Running Specific Tests

```bash
# Run only auth tests
npx playwright test tests/e2e/auth

# Run specific file
npx playwright test tests/e2e/auth/login.spec.ts

# Run tests matching pattern
npx playwright test --grep "Sales Rep"
```

## Directory Structure

```
tests/
├── e2e/                    # Test files organized by feature
│   ├── auth/              # Authentication tests
│   ├── rbac/              # Role-based access control
│   ├── quotations/        # Quotation management
│   ├── approvals/         # Approval workflows
│   ├── customer-portal/   # Customer portal tests
│   ├── fulfillment/       # Fulfillment tests
│   ├── billing/           # Billing and invoicing
│   ├── dashboard/         # Dashboard tests
│   ├── customers/         # Customer management
│   ├── products/          # Product management
│   └── full-flow/         # Complete end-to-end flows
├── fixtures/              # Test data and custom fixtures
│   ├── test-data.ts       # User credentials and constants
│   └── auth.fixture.ts    # Authenticated test fixtures
└── helpers/               # Reusable helper functions
    ├── login.ts           # Login/logout helpers
    ├── navigation.ts      # Navigation helpers
    └── assertions.ts      # Custom assertions
```

## Writing Tests

### Basic Test

```typescript
import { test, expect } from '@playwright/test';
import { loginAs } from '../../helpers/login';
import { TEST_USERS } from '../../fixtures/test-data';

test('example test', async ({ page }) => {
  await loginAs(page, 'salesRep');
  
  // Your test code here
  await expect(page.getByRole('heading', { name: /overview/i })).toBeVisible();
});
```

### Using Authenticated Fixtures

```typescript
import { test, expect } from '../../fixtures/auth.fixture';

test('test with authenticated page', async ({ authenticatedPage }) => {
  // Page is already logged in as sales rep
  await expect(authenticatedPage.getByText('Sam Sales Rep')).toBeVisible();
});
```

## Configuration

Configuration is in `playwright.config.ts` at the root.

### Environment Variables

- `PLAYWRIGHT_BASE_URL` - Frontend URL (default: http://localhost:3000)
- `CI` - Set to enable CI mode (more retries, different settings)

## Best Practices

1. **Use semantic selectors:** Prefer `getByRole`, `getByLabel`, `getByText` over CSS selectors
2. **Wait for navigation:** Use `page.waitForURL()` after actions that trigger navigation
3. **Verify state:** Always assert expected state after actions
4. **Clean state:** Clear auth between tests if needed
5. **Avoid hardcoded waits:** Use Playwright's auto-waiting instead of `page.waitForTimeout()`
6. **Use helpers:** Reuse login, navigation, and assertion helpers

## Troubleshooting

### "Target closed" error
- Make sure backend and frontend are running
- Check that ports 8001 and 3000 are accessible

### "Timeout exceeded" on login
- Verify test account exists in database
- Check that credentials match seeded data
- Inspect actual selectors using `npx playwright codegen`

### Tests fail in headless but pass in headed
- Add `await page.pause()` to debug
- Check for race conditions
- Ensure proper waiting for async operations

### Browser download timeout
- If `npx playwright install` fails, try:
  - Using a different network
  - Setting `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`
  - Downloading browsers manually

## Current Status

✅ Playwright installed  
✅ Test structure created  
✅ Login helpers implemented  
✅ Smoke test created  
⚠️ Browser may need manual installation (network issues)  
⬜ Additional tests to be implemented  

## Next Steps

1. Ensure browsers are installed: `npx playwright install chromium`
2. Start backend: `cd backend && npm start`
3. Start frontend: `cd frontend && npm run dev`
4. Run smoke test: `npm run test:e2e tests/e2e/auth/login.spec.ts`
5. Implement additional test scenarios as needed
