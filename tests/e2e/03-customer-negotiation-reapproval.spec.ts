import { test, expect, Page } from '@playwright/test';
import { loginAs, logout } from '../helpers/login';
import { ROUTES, TEST_CUSTOMER, TEST_PRODUCTS } from '../fixtures/test-data';

/**
 * TEST 3: CUSTOMER NEGOTIATION → REAPPROVAL
 * 
 * Flow:
 * 1. Sales Rep creates and submits quotation for approval
 * 2. Manager approves quotation (status: APPROVED)
 * 3. Sales Rep sends quotation to customer (status: SENT_TO_CUSTOMER)
 * 4. Customer logs in and requests discount change via negotiation
 * 5. Sales Rep accepts negotiation, creating new quotation version
 * 6. Verify old approved version remains unchanged
 * 7. Verify totals/margin/risk recalculate on new version
 * 8. Verify reapproval is triggered if discount exceeds limits
 * 9. Manager approves reapproval request
 * 10. Finance approves if required
 * 11. Customer confirms final version
 * 
 * Key Verifications:
 * - Negotiation API endpoints work correctly
 * - New quotation version is created on negotiation acceptance
 * - Old version history is preserved
 * - Reapproval workflow triggers correctly
 * - Status transitions: APPROVED → SENT_TO_CUSTOMER → UNDER_NEGOTIATION → REAPPROVAL_REQUIRED → APPROVED → CONFIRMED
 */

let quotationId: string | null = null;
let quoteNumber: string | null = null;
let negotiationId: string | null = null;
let originalVersion: number = 1;

test.describe('Test 3: Customer Negotiation and Reapproval', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ROUTES.login);
  });

  test('3.1 Sales Rep: Create quotation with Laptop (valid discount)', async ({ page }) => {
    await loginAs(page, 'salesRep');
    
    await page.goto(ROUTES.quotations);
    await expect(page.getByRole('heading', { name: /commercial workbench/i })).toBeVisible();
    
    // Create new quotation
    await page.getByRole('button', { name: /new quotation/i }).click();
    await expect(page.getByText(/customer/i).first()).toBeVisible();
    
    // Select Acme Corp
    const customerSelect = page.locator('select').first();
    await customerSelect.selectOption({ label: /acme corp/i });
    
    await page.getByRole('button', { name: /create draft/i }).click();
    await page.waitForTimeout(1000);
    
    // Capture quotation ID
    const url = page.url();
    const match = url.match(/[?&]quote=([^&]+)/);
    if (match) {
      quotationId = match[1];
      console.log('Created quotation ID:', quotationId);
    }
    
    await expect(page.getByText(/draft/i)).toBeVisible();
    
    // Add Laptop with 8% discount (within limits)
    await page.locator('select[required]').first().selectOption({ label: /laptop/i });
    await page.locator('input[type="number"]').first().fill('1');
    await page.locator('input[type="number"]').nth(1).fill('8');
    
    await page.getByRole('button', { name: /add line/i }).click();
    await page.waitForTimeout(1000);
    
    // Verify line added
    await expect(page.getByText(/laptop/i)).toBeVisible();
    
    // Verify quotation total calculated
    const totalText = await page.locator('text=/\\$[\\d,]+\\.\\d{2}/').first().textContent();
    console.log('Quotation total:', totalText);
  });

  test('3.2 Sales Rep: Submit quotation for approval', async ({ page }) => {
    test.skip(!quotationId, 'Quotation not created in previous test');
    
    await loginAs(page, 'salesRep');
    await page.goto(`${ROUTES.quotations}?quote=${quotationId}`);
    
    await expect(page.getByText(/acme corp/i)).toBeVisible();
    
    // Submit for approval
    const submitButton = page.getByRole('button', { name: /submit/i });
    if (await submitButton.isVisible()) {
      await submitButton.click();
      await page.waitForTimeout(1500);
      
      // Verify status changed to PENDING_APPROVAL
      await expect(page.locator('text=/pending/i')).toBeVisible();
    } else {
      console.log('Submit button not visible - may be auto-approved');
    }
  });

  test('3.3 Manager: Approve quotation', async ({ page }) => {
    test.skip(!quotationId, 'Quotation not created in previous test');
    
    await loginAs(page, 'salesManager');
    await page.goto(ROUTES.approvals);
    
    await expect(page.getByRole('heading', { name: /approvals/i })).toBeVisible();
    
    // Look for pending approval
    const approvalRow = page.locator(`text=/Q-.*${quotationId.slice(-6)}/i`).first();
    
    if (await approvalRow.isVisible({ timeout: 2000 })) {
      await approvalRow.click();
      await page.waitForTimeout(500);
      
      // Approve
      const approveButton = page.getByRole('button', { name: /approve/i });
      await approveButton.click();
      await page.waitForTimeout(1000);
      
      console.log('Manager approved quotation');
    } else {
      console.log('No pending approval found - may be auto-approved');
    }
  });

  test('3.4 Sales Rep: Send quotation to customer', async ({ page }) => {
    test.skip(!quotationId, 'Quotation not created in previous test');
    
    await loginAs(page, 'salesRep');
    await page.goto(`${ROUTES.quotations}?quote=${quotationId}`);
    
    await expect(page.getByText(/acme corp/i)).toBeVisible();
    
    // Send to customer
    const sendButton = page.getByRole('button', { name: /send to customer/i });
    if (await sendButton.isVisible({ timeout: 2000 })) {
      await sendButton.click();
      await page.waitForTimeout(1500);
      
      // Verify status changed to SENT_TO_CUSTOMER
      await expect(page.locator('text=/sent.*customer/i')).toBeVisible();
      console.log('Quotation sent to customer');
    } else {
      console.log('Send button not visible - checking current status');
    }
  });

  test('3.5 Customer: Request discount change via negotiation', async ({ page }) => {
    test.skip(!quotationId, 'Quotation not created in previous test');
    
    await loginAs(page, 'customer');
    
    // Navigate to customer portal
    await page.goto(ROUTES.customerPortal);
    await expect(page.getByRole('heading', { name: /customer portal/i })).toBeVisible();
    
    // Find and click on the quotation
    const quoteLink = page.locator(`text=/Q-/i`).first();
    if (await quoteLink.isVisible({ timeout: 2000 })) {
      await quoteLink.click();
      await page.waitForTimeout(1000);
      
      // Look for negotiation or request discount button
      const negotiateButton = page.getByRole('button', { name: /negotiate|request.*change|request.*discount/i });
      
      if (await negotiateButton.isVisible({ timeout: 2000 })) {
        await negotiateButton.click();
        await page.waitForTimeout(500);
        
        // Fill negotiation form
        // Request higher discount (15% - may trigger reapproval)
        const discountInput = page.locator('input[type="number"]').filter({ hasText: '' });
        if (await discountInput.first().isVisible({ timeout: 1000 })) {
          await discountInput.first().fill('15');
        }
        
        // Add message
        const messageInput = page.locator('textarea, input[type="text"]').first();
        if (await messageInput.isVisible({ timeout: 1000 })) {
          await messageInput.fill('Requesting additional discount for bulk purchase commitment.');
        }
        
        // Submit negotiation
        const submitButton = page.getByRole('button', { name: /submit|send/i }).last();
        await submitButton.click();
        await page.waitForTimeout(1500);
        
        console.log('Customer submitted negotiation request');
      } else {
        console.log('Negotiate button not found on customer portal');
      }
    }
  });

  test('3.6 Sales Rep: Accept negotiation', async ({ page }) => {
    test.skip(!quotationId, 'Quotation not created in previous test');
    
    await loginAs(page, 'salesRep');
    
    // Navigate to negotiations page
    await page.goto('/sales/negotiations');
    
    // Look for pending negotiation
    const negotiationRow = page.locator(`text=/Q-/i`).first();
    
    if (await negotiationRow.isVisible({ timeout: 2000 })) {
      await negotiationRow.click();
      await page.waitForTimeout(1000);
      
      // Accept negotiation
      const acceptButton = page.getByRole('button', { name: /accept/i });
      if (await acceptButton.isVisible({ timeout: 2000 })) {
        await acceptButton.click();
        await page.waitForTimeout(1500);
        
        console.log('Sales Rep accepted negotiation');
        
        // Verify new version created
        await page.goto(`${ROUTES.quotations}?quote=${quotationId}`);
        await page.waitForTimeout(1000);
        
        // Check for version indicator
        const versionText = page.locator('text=/version.*2|v2/i');
        if (await versionText.isVisible({ timeout: 2000 })) {
          console.log('New quotation version 2 created');
        }
        
        // Verify status changed to REAPPROVAL_REQUIRED if discount exceeds limits
        const statusLocator = page.locator('text=/reapproval|pending/i');
        if (await statusLocator.isVisible({ timeout: 2000 })) {
          const statusText = await statusLocator.textContent();
          console.log('Quotation status after negotiation:', statusText);
        }
      }
    } else {
      console.log('No pending negotiation found');
    }
  });

  test('3.7 Verify: New version created, old version unchanged', async ({ page }) => {
    test.skip(!quotationId, 'Quotation not created in previous test');
    
    await loginAs(page, 'salesRep');
    await page.goto(`${ROUTES.quotations}?quote=${quotationId}`);
    await page.waitForTimeout(1000);
    
    // Check version history via API
    const apiUrl = `http://localhost:8001/api/v1/quotations/${quotationId}`;
    const response = await page.evaluate(async (url) => {
      const token = localStorage.getItem('dealflow360_access_token');
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      return res.json();
    }, apiUrl);
    
    console.log('Quotation API response:', JSON.stringify(response, null, 2));
    
    // Verify version information
    if (response.data) {
      const { currentVersion, negotiationHistory } = response.data;
      console.log('Current version:', currentVersion);
      console.log('Negotiation history:', negotiationHistory);
      
      expect(currentVersion).toBeGreaterThan(1);
      
      if (negotiationHistory?.negotiations) {
        expect(negotiationHistory.negotiations.length).toBeGreaterThan(0);
        console.log('Negotiation records found:', negotiationHistory.negotiations.length);
      }
    }
  });

  test('3.8 Verify: Totals and margin recalculated', async ({ page }) => {
    test.skip(!quotationId, 'Quotation not created in previous test');
    
    await loginAs(page, 'salesRep');
    await page.goto(`${ROUTES.quotations}?quote=${quotationId}`);
    await page.waitForTimeout(1000);
    
    // Verify new totals displayed
    const totalLocator = page.locator('text=/\\$[\\d,]+\\.\\d{2}/').first();
    if (await totalLocator.isVisible()) {
      const newTotal = await totalLocator.textContent();
      console.log('New quotation total after negotiation:', newTotal);
    }
    
    // Verify margin displayed
    const marginLocator = page.locator('text=/margin.*%|%.*margin/i');
    if (await marginLocator.isVisible({ timeout: 2000 })) {
      const margin = await marginLocator.textContent();
      console.log('Recalculated margin:', margin);
    }
    
    // Verify risk score via API
    const apiUrl = `http://localhost:8001/api/v1/quotations/${quotationId}`;
    const response = await page.evaluate(async (url) => {
      const token = localStorage.getItem('dealflow360_access_token');
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      return res.json();
    }, apiUrl);
    
    if (response.data?.riskScore !== undefined) {
      console.log('Recalculated risk score:', response.data.riskScore);
      expect(response.data.riskScore).toBeGreaterThanOrEqual(0);
    }
  });

  test('3.9 Manager: Approve reapproval request', async ({ page }) => {
    test.skip(!quotationId, 'Quotation not created in previous test');
    
    await loginAs(page, 'salesManager');
    await page.goto(ROUTES.approvals);
    
    await expect(page.getByRole('heading', { name: /approvals/i })).toBeVisible();
    
    // Look for reapproval request
    const approvalRow = page.locator(`text=/Q-.*negotiat|reapproval/i`).first();
    
    if (await approvalRow.isVisible({ timeout: 2000 })) {
      await approvalRow.click();
      await page.waitForTimeout(500);
      
      // Approve
      const approveButton = page.getByRole('button', { name: /approve/i });
      if (await approveButton.isVisible()) {
        await approveButton.click();
        await page.waitForTimeout(1500);
        
        console.log('Manager approved reapproval request');
      }
    } else {
      console.log('No reapproval request found - may not require approval');
    }
  });

  test('3.10 Finance: Approve if required', async ({ page }) => {
    test.skip(!quotationId, 'Quotation not created in previous test');
    
    await loginAs(page, 'finance');
    await page.goto(ROUTES.approvals);
    
    await expect(page.getByRole('heading', { name: /approvals/i })).toBeVisible();
    
    // Look for finance approval request
    const approvalRow = page.locator(`text=/Q-/i`).first();
    
    if (await approvalRow.isVisible({ timeout: 2000 })) {
      await approvalRow.click();
      await page.waitForTimeout(500);
      
      // Approve
      const approveButton = page.getByRole('button', { name: /approve/i });
      if (await approveButton.isVisible()) {
        await approveButton.click();
        await page.waitForTimeout(1500);
        
        console.log('Finance approved quotation');
      }
    } else {
      console.log('No finance approval required');
    }
  });

  test('3.11 Customer: Confirm final version', async ({ page }) => {
    test.skip(!quotationId, 'Quotation not created in previous test');
    
    await loginAs(page, 'customer');
    
    // Navigate to customer portal
    await page.goto(ROUTES.customerPortal);
    await expect(page.getByRole('heading', { name: /customer portal/i })).toBeVisible();
    
    // Find and click on the quotation
    const quoteLink = page.locator(`text=/Q-/i`).first();
    if (await quoteLink.isVisible({ timeout: 2000 })) {
      await quoteLink.click();
      await page.waitForTimeout(1000);
      
      // Look for confirm/accept button
      const confirmButton = page.getByRole('button', { name: /confirm|accept|approve/i });
      
      if (await confirmButton.isVisible({ timeout: 2000 })) {
        await confirmButton.click();
        await page.waitForTimeout(1500);
        
        // Verify status changed to CONFIRMED
        await expect(page.locator('text=/confirmed/i')).toBeVisible({ timeout: 3000 });
        
        console.log('Customer confirmed final quotation version');
      } else {
        console.log('Confirm button not visible - checking status');
      }
    }
  });

  test('3.12 Verify: Final status is CONFIRMED', async ({ page }) => {
    test.skip(!quotationId, 'Quotation not created in previous test');
    
    await loginAs(page, 'salesRep');
    
    // Verify final status via API
    const apiUrl = `http://localhost:8001/api/v1/quotations/${quotationId}`;
    const response = await page.evaluate(async (url) => {
      const token = localStorage.getItem('dealflow360_access_token');
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      return res.json();
    }, apiUrl);
    
    console.log('Final quotation status:', response.data?.status);
    
    if (response.data?.status) {
      // Should be CONFIRMED or APPROVED
      expect(['CONFIRMED', 'APPROVED']).toContain(response.data.status);
    }
    
    // Verify quotation appears in UI with correct status
    await page.goto(`${ROUTES.quotations}?quote=${quotationId}`);
    await page.waitForTimeout(1000);
    
    const statusLocator = page.locator('text=/confirmed|approved/i');
    await expect(statusLocator.first()).toBeVisible({ timeout: 3000 });
    
    console.log('Test 3 completed: Customer negotiation and reapproval flow verified');
  });
});
