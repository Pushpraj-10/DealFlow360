# DealFlow360 Testing - Quick Start Guide

**Goal:** Get Playwright running with your first test in 30 minutes

---

## Step 1: Install Playwright (5 minutes)

```bash
cd d:\DealFlow360

# Option A: Interactive setup (recommended)
npm init playwright@latest

# Option B: Manual
npm install -D @playwright/test
npx playwright install
```

**Answer prompts:**
- TypeScript or JavaScript? → **TypeScript**
- Test folder? → **tests**
- GitHub Actions? → **No** (for now)

---

## Step 2: Verify Installation (2 minutes)

```bash
# Should create:
# - playwright.config.ts
# - tests/
# - tests/example.spec.ts

# Run example test
npx playwright test

# Open test report
npx playwright show-report
```

---

## Step 3: Start Application (3 minutes)

**Terminal 1 - Backend:**
```bash
cd backend
npm install
npm run seed
npm start
# Should show: Server running on port 8001
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install
npm run dev
# Should show: Ready on http://localhost:3000
```

**Terminal 3 - Keep open for tests**

---

## Step 4: Configure Playwright (5 minutes)

Edit `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Run tests sequentially for now
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

---

## Step 5: Create Your First Test (10 minutes)

Create `tests/auth-login.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('successful login as Sales Rep', async ({ page }) => {
    // Go to login page
    await page.goto('/login');
    
    // Fill in credentials
    await page.fill('input[name="email"]', 'rep@dealflow360.dev');
    await page.fill('input[name="password"]', 'Password123!');
    
    // Click login button
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/');
    
    // Should see dashboard heading
    await expect(page.locator('h1')).toContainText('Overview');
  });

  test('invalid credentials show error', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[name="email"]', 'wrong@test.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    
    await page.click('button[type="submit"]');
    
    // Should stay on login page
    await expect(page).toHaveURL('/login');
    
    // Should show error (adjust selector based on your UI)
    const error = page.locator('.error, [role="alert"], .alert-error').first();
    await expect(error).toBeVisible();
  });

  test('logout clears session', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', 'rep@dealflow360.dev');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
    
    // Click logout (adjust selector based on your UI)
    await page.click('button:has-text("Logout"), a:has-text("Logout")');
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
  });
});
```

---

## Step 6: Run Your First Test (2 minutes)

```bash
# Run all tests
npx playwright test

# Run with UI (interactive mode)
npx playwright test --ui

# Run specific file
npx playwright test tests/auth-login.spec.ts

# Run in headed mode (see browser)
npx playwright test --headed

# Debug mode
npx playwright test --debug
```

---

## Step 7: View Results (2 minutes)

```bash
# Open HTML report
npx playwright show-report

# Take screenshot on every step (debug)
npx playwright test --screenshot=on
```

---

## Common Issues & Fixes

### Issue: "Target closed" error
**Fix:** Application not running. Start backend + frontend first.

### Issue: "Timeout exceeded" on login
**Fix:** Adjust selectors in test to match your actual HTML.

### Issue: Test passes but shouldn't
**Fix:** Assertions are weak. Add more specific checks.

### Issue: Cannot find element
**Fix:** Use Playwright Inspector to find correct selector:
```bash
npx playwright codegen http://localhost:3000
```

---

## Next Steps

### Create Second Test (Quotation Creation)

```typescript
// tests/quotations.spec.ts
import { test, expect } from '@playwright/test';

// Helper function for login
async function loginAsSalesRep(page) {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'rep@dealflow360.dev');
  await page.fill('input[name="password"]', 'Password123!');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/');
}

test.describe('Quotations', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSalesRep(page);
  });

  test('create quotation with valid discount', async ({ page }) => {
    // Navigate to quotations
    await page.goto('/sales/quotations');
    
    // Click new quotation
    await page.click('button:has-text("New"), a:has-text("New Quotation")');
    
    // Should be on quotation builder
    await expect(page.url()).toContain('/quotations/');
    
    // TODO: Add customer selection
    // TODO: Add product line
    // TODO: Submit quotation
  });
});
```

---

## Useful Playwright Commands

```bash
# Generate test by recording
npx playwright codegen http://localhost:3000

# Run specific test
npx playwright test -g "successful login"

# Run in specific browser
npx playwright test --project=chromium

# Update snapshots
npx playwright test --update-snapshots

# Show trace
npx playwright show-trace trace.zip
```

---

## Best Practices

### 1. Use Data Test IDs
Add to your React components:
```tsx
<button data-testid="login-button">Login</button>
```

Then in tests:
```typescript
await page.click('[data-testid="login-button"]');
```

### 2. Create Helper Functions
```typescript
// tests/helpers/auth.ts
export async function login(page, email, password) {
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
}
```

### 3. Use Page Object Model
```typescript
// tests/pages/LoginPage.ts
export class LoginPage {
  constructor(private page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.page.fill('input[name="email"]', email);
    await this.page.fill('input[name="password"]', password);
    await this.page.click('button[type="submit"]');
  }
}
```

### 4. Wait for Network Idle
```typescript
// Wait for API calls to complete
await page.waitForLoadState('networkidle');
```

### 5. Use Soft Assertions
```typescript
// Continue test even if assertion fails
await expect.soft(page.locator('.title')).toHaveText('Expected');
await expect.soft(page.locator('.subtitle')).toBeVisible();
```

---

## Debugging Tips

### 1. Use console.log in tests
```typescript
test('debug example', async ({ page }) => {
  const text = await page.locator('h1').textContent();
  console.log('Found heading:', text);
});
```

### 2. Take screenshots manually
```typescript
await page.screenshot({ path: 'debug.png' });
```

### 3. Pause execution
```typescript
await page.pause(); // Opens Playwright Inspector
```

### 4. See what Playwright sees
```typescript
test('debug selectors', async ({ page }) => {
  await page.goto('/login');
  
  // List all buttons
  const buttons = await page.locator('button').all();
  console.log(`Found ${buttons.length} buttons`);
  
  for (const button of buttons) {
    const text = await button.textContent();
    console.log('Button:', text);
  }
});
```

---

## Test Data Strategy

### Option 1: Use Existing Seed Data
```typescript
// Relies on npm run seed being executed
test('use seeded customer', async ({ page }) => {
  // Use rep@dealflow360.dev
  // Customer: Acme Corp already exists
});
```

### Option 2: Create Test-Specific Data
```typescript
test('create customer for test', async ({ page }) => {
  // Login as admin
  // Create customer via UI
  // Use customer in test
});
```

### Option 3: API Setup
```typescript
test.beforeEach(async ({ request }) => {
  // Create customer via API
  const response = await request.post('http://localhost:8001/api/v1/customers', {
    data: {
      name: 'Test Customer',
      tierId: '...'
    }
  });
  
  const customer = await response.json();
  // Use customer._id in test
});
```

---

## Example: Complete Test Flow

```typescript
// tests/flows/basic-approval.spec.ts
import { test, expect } from '@playwright/test';

test('Flow A: Quotation to Approval', async ({ page }) => {
  // 1. Login as Sales Rep
  await page.goto('/login');
  await page.fill('input[name="email"]', 'rep@dealflow360.dev');
  await page.fill('input[name="password"]', 'Password123!');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/');

  // 2. Navigate to Quotations
  await page.click('a[href*="/sales/quotations"]');
  
  // 3. Create New Quotation
  await page.click('button:has-text("New Quotation")');
  
  // 4. Select Customer (adjust selectors)
  await page.selectOption('select[name="customerId"]', { label: /Acme/ });
  
  // 5. Add Product Line
  await page.click('button:has-text("Add Line")');
  // ... fill product details
  
  // 6. Verify Discount Indicator
  const indicator = page.locator('[data-testid="discount-indicator"]').first();
  await expect(indicator).toHaveClass(/valid/);
  
  // 7. Submit Quotation
  await page.click('button:has-text("Submit")');
  
  // 8. Verify Status
  await expect(page.locator('.status, [data-testid="status"]')).toHaveText(/DRAFT|PENDING/);
  
  // 9. Logout
  await page.click('button:has-text("Logout")');
  
  // 10. Login as Manager
  await page.fill('input[name="email"]', 'manager@dealflow360.dev');
  await page.fill('input[name="password"]', 'Password123!');
  await page.click('button[type="submit"]');
  
  // 11. Navigate to Approvals
  await page.click('a[href*="/sales/approvals"]');
  
  // 12. Should see pending approval
  await expect(page.locator('tr').filter({ hasText: 'Acme' })).toBeVisible();
});
```

---

## Configuration Tips

### Run tests against different environments
```typescript
// playwright.config.ts
const baseURL = process.env.TEST_ENV === 'prod' 
  ? 'https://dealflow360.com'
  : 'http://localhost:3000';
```

### Set up test database
```typescript
// In your backend before tests
process.env.TEST_MODE = 'true';
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI;
```

---

## VS Code Extensions

Install for better experience:
1. **Playwright Test for VSCode**
   - Run tests from editor
   - See results inline
   - Debug with breakpoints

2. **Pretty TypeScript Errors**
   - Better error messages

---

## Summary

**You now have:**
- ✅ Playwright installed
- ✅ First test written
- ✅ Application running
- ✅ Test execution verified

**Next:**
1. Add more tests (see `TESTING_AUDIT_REPORT.md`)
2. Create helper functions
3. Add Page Object Models
4. Implement critical flows

**Total time:** 30 minutes 🎉

---

## Resources

- **Full Report:** `TESTING_AUDIT_REPORT.md` (280 test scenarios)
- **Summary:** `TESTING_SUMMARY.md` (Quick overview)
- **Playwright Docs:** https://playwright.dev/
- **Demo Accounts:** See `TESTING_SUMMARY.md`

**Happy Testing!** 🚀
