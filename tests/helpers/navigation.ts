import { Page, expect } from '@playwright/test';
import { ROUTES } from '../fixtures/test-data';

/**
 * Navigation helpers for DealFlow360
 * 
 * These helpers navigate to common pages and verify successful navigation
 */

/**
 * Navigate to dashboard
 */
export async function navigateToDashboard(page: Page): Promise<void> {
  await page.goto(ROUTES.dashboard);
  await expect(page.getByRole('heading', { name: /overview/i })).toBeVisible();
}

/**
 * Navigate to quotations
 */
export async function navigateToQuotations(page: Page): Promise<void> {
  await page.goto(ROUTES.quotations);
  // Add verification once we know the quotations page structure
}

/**
 * Navigate to approvals
 */
export async function navigateToApprovals(page: Page): Promise<void> {
  await page.goto(ROUTES.approvals);
  // Add verification once we know the approvals page structure
}

/**
 * Wait for page to be fully loaded
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}
