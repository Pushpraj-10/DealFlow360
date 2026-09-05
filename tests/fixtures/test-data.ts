/**
 * Test Data and Credentials for DealFlow360 E2E Tests
 * 
 * IMPORTANT: These are REAL test accounts that exist in the seeded database.
 * All passwords are: Password123!
 */

export const TEST_USERS = {
  salesRep: {
    email: 'rep@dealflow360.dev',
    password: 'Password123!',
    role: 'SALES_REP',
    expectedName: 'Sam Rep',
  },
  salesManager: {
    email: 'manager@dealflow360.dev',
    password: 'Password123!',
    role: 'SALES_MANAGER',
    expectedName: 'Sarah Manager',
  },
  finance: {
    email: 'ops@dealflow360.dev',
    password: 'Password123!',
    role: 'FINANCE',
    expectedName: 'Olivia Ops',
  },
  admin: {
    email: 'admin@dealflow360.dev',
    password: 'Password123!',
    role: 'ADMIN',
    expectedName: 'Alex Admin',
  },
  customer: {
    email: 'customer@dealflow360.dev',
    password: 'Password123!',
    role: 'CUSTOMER',
    expectedName: 'Chris Customer',
  },
} as const;

export type UserRole = keyof typeof TEST_USERS;

/**
 * Get user credentials by role
 */
export function getUserByRole(role: UserRole) {
  return TEST_USERS[role];
}

/**
 * Routes
 */
export const ROUTES = {
  login: '/login',
  dashboard: '/',
  quotations: '/sales/quotations',
  approvals: '/sales/approvals',
  customerPortal: '/portal/quotation',
  fulfillment: '/operations/fulfillment',
  invoices: '/finance/invoices',
  products: '/admin/products',
  customers: '/admin/customers',
} as const;

/**
 * Expected navigation elements for authenticated users
 */
export const NAV_ELEMENTS = {
  dashboard: 'Overview',
  quotations: 'Quotations',
  approvals: 'Approvals',
} as const;
