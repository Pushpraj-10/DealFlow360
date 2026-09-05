import { test as base } from '@playwright/test';
import { loginAs, logout } from '../helpers/login';
import { UserRole } from './test-data';

/**
 * Custom fixtures for authenticated tests
 * 
 * Usage:
 * test('my test', async ({ authenticatedPage }) => {
 *   // Page is already logged in as salesRep
 * });
 */

type AuthFixtures = {
  authenticatedPage: any;
  authenticatedAsSalesRep: any;
  authenticatedAsSalesManager: any;
  authenticatedAsFinance: any;
  authenticatedAsAdmin: any;
  authenticatedAsCustomer: any;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Default: login as sales rep
    await loginAs(page, 'salesRep');
    await use(page);
    await logout(page);
  },

  authenticatedAsSalesRep: async ({ page }, use) => {
    await loginAs(page, 'salesRep');
    await use(page);
    await logout(page);
  },

  authenticatedAsSalesManager: async ({ page }, use) => {
    await loginAs(page, 'salesManager');
    await use(page);
    await logout(page);
  },

  authenticatedAsFinance: async ({ page }, use) => {
    await loginAs(page, 'finance');
    await use(page);
    await logout(page);
  },

  authenticatedAsAdmin: async ({ page }, use) => {
    await loginAs(page, 'admin');
    await use(page);
    await logout(page);
  },

  authenticatedAsCustomer: async ({ page }, use) => {
    await loginAs(page, 'customer');
    await use(page);
    await logout(page);
  },
});

export { expect } from '@playwright/test';
