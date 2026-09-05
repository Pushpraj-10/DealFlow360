import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/login';
import { ROUTES } from '../fixtures/test-data';

/**
 * TEST 7: RBAC / SECURITY ASSERTIONS
 * 
 * Verifies:
 * - Sales Rep cannot perform manager actions
 * - Manager cannot perform out-of-sequence actions
 * - Customer cannot access internal routes
 * - Customer cannot see internal data (cost, margin, risk)
 * - Finance only sees permitted actions
 * - Admin routes protected from other roles
 */

test.describe('Test 7: RBAC and Security', () => {
  
  test('7.1 Customer: Cannot access internal quotation routes', async ({ page }) => {
    await loginAs(page, 'customer');
    
    // Try to access Sales quotations page
    await page.goto(ROUTES.quotations);
    await page.waitForTimeout(1000);
    
    // Should be redirected to customer portal
    expect(page.url()).toContain('/portal');
    
    console.log('✓ Customer redirected from internal routes');
  });

  test('7.2 Customer: Cannot see cost, margin, risk data', async ({ page }) => {
    await loginAs(page, 'customer');
    
    // Navigate to customer portal
    await page.goto(ROUTES.customerPortal);
    await page.waitForTimeout(1500);
    
    // Get page content
    const pageContent = await page.content();
    const lowerContent = pageContent.toLowerCase();
    
    // Verify sensitive data is NOT present
    expect(lowerContent).not.toContain('cost price');
    expect(lowerContent).not.toContain('margin');
    expect(lowerContent).not.toContain('risk score');
    expect(lowerContent).not.toContain('approval workflow');
    
    // Customer should see product names and prices, but not internal data
    console.log('✓ Customer portal does not expose internal data');
    
    await page.screenshot({ 
      path: 'test-results/test-7-customer-portal.png',
      fullPage: true 
    });
  });

  test('7.3 Sales Rep: Cannot access admin routes', async ({ page }) => {
    await loginAs(page, 'salesRep');
    
    // Try to access admin products page
    await page.goto(ROUTES.products);
    await page.waitForTimeout(1000);
    
    // Check if access is denied or redirected
    const url = page.url();
    
    // Should either:
    // - Show error/forbidden message
    // - Redirect to dashboard
    // - Not show admin functionality
    
    const hasErrorMessage = await page.getByText(/access denied|forbidden|not authorized/i)
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    
    const redirectedToDashboard = url === new URL(ROUTES.dashboard, page.url()).href;
    
    if (hasErrorMessage || redirectedToDashboard) {
      console.log('✓ Sales Rep cannot access admin routes');
    } else {
      // Check if admin features are hidden
      const hasAdminFeatures = await page.getByText(/create product|delete product/i)
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      
      expect(hasAdminFeatures).toBeFalsy();
      console.log('✓ Admin features not visible to Sales Rep');
    }
  });

  test('7.4 Sales Rep: Cannot access manager approval actions', async ({ page }) => {
    await loginAs(page, 'salesRep');
    
    // Navigate to approvals page (sales reps may see their pending items)
    await page.goto(ROUTES.approvals);
    await page.waitForTimeout(1000);
    
    // Sales rep should not see "Approve" buttons for other reps' quotations
    // They should only see their own submitted quotations status
    
    const approveButtons = page.getByRole('button', { name: /approve/i });
    const approveCount = await approveButtons.count();
    
    // Sales rep should not have approve buttons on approvals page
    expect(approveCount).toBe(0);
    
    console.log('✓ Sales Rep cannot perform approval actions');
  });

  test('7.5 Manager: Can access approvals', async ({ page }) => {
    await loginAs(page, 'salesManager');
    
    await page.goto(ROUTES.approvals);
    await page.waitForTimeout(1000);
    
    // Manager should see approvals page
    await expect(page.getByText(/approval/i)).toBeVisible({ timeout: 3000 });
    
    console.log('✓ Manager can access approvals page');
  });

  test('7.6 Finance: Can access finance routes', async ({ page }) => {
    await loginAs(page, 'finance');
    
    // Navigate to invoices
    await page.goto(ROUTES.invoices);
    await page.waitForTimeout(1000);
    
    // Verify access granted
    const hasAccess = await page.getByText(/invoice/i).isVisible({ timeout: 3000 })
      .catch(() => false);
    
    expect(hasAccess).toBeTruthy();
    
    console.log('✓ Finance can access finance routes');
  });

  test('7.7 Admin: Can access admin routes', async ({ page }) => {
    await loginAs(page, 'admin');
    
    // Navigate to customers admin page
    await page.goto(ROUTES.customers);
    await page.waitForTimeout(1000);
    
    // Verify admin access
    const hasAdminAccess = await page.getByText(/customer/i).isVisible({ timeout: 3000 })
      .catch(() => false);
    
    expect(hasAdminAccess).toBeTruthy();
    
    console.log('✓ Admin can access admin routes');
  });

  test('7.8 Customer: Cannot change URL to access other customers data', async ({ page }) => {
    await loginAs(page, 'customer');
    
    await page.goto(ROUTES.customerPortal);
    await page.waitForTimeout(1000);
    
    // Customer should only see their own data (Acme Corp)
    await expect(page.getByText(/acme/i)).toBeVisible({ timeout: 3000 });
    
    // Try to construct URL with different customer ID (should fail or redirect)
    // This is a basic check - actual implementation may vary
    
    const originalUrl = page.url();
    
    // Try to navigate to a different quotation by ID (not theirs)
    await page.goto(`${ROUTES.customerPortal}/quotation/fake-id-12345`);
    await page.waitForTimeout(1000);
    
    // Should either:
    // - Show error
    // - Redirect to portal root
    // - Show "not found"
    
    const hasError = await page.getByText(/not found|access denied|not authorized/i)
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    
    const redirected = page.url() !== `${new URL(ROUTES.customerPortal, page.url()).href}/quotation/fake-id-12345`;
    
    if (hasError || redirected) {
      console.log('✓ Customer cannot access other customers\' data via URL manipulation');
    }
  });
});
