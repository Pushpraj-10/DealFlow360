/**
 * Test Data and Credentials for DealFlow360 E2E Tests
 * 
 * IMPORTANT: These are REAL test accounts that exist in the seeded database.
 * All passwords are: Password123!
 */

export const TEST_USERS = {
  salesRep: {
    email: 'sales.rep@dealflow360.test',
    password: 'Password123!',
    role: 'SALES_REP',
    expectedName: 'Sam Sales Rep',
  },
  salesManager: {
    email: 'sales.manager@dealflow360.test',
    password: 'Password123!',
    role: 'SALES_MANAGER',
    expectedName: 'Maya Sales Manager',
  },
  finance: {
    email: 'finance@dealflow360.test',
    password: 'Password123!',
    role: 'FINANCE',
    expectedName: 'Finn Finance',
  },
  admin: {
    email: 'admin@dealflow360.test',
    password: 'Password123!',
    role: 'ADMIN',
    expectedName: 'Ada Admin',
  },
  customer: {
    email: 'customer@acme.test',
    password: 'Password123!',
    role: 'CUSTOMER',
    expectedName: 'Acme Buyer',
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
  teamDeals: '/sales/team-deals',
  customerPortal: '/portal',
  fulfillment: '/operations/fulfillment',
  invoices: '/finance/invoices',
  payments: '/finance/payments',
  subscriptions: '/finance/subscriptions',
  products: '/admin/products',
  customers: '/admin/customers',
  dealHealth: '/management/deal-health',
} as const;

/**
 * Expected navigation elements for authenticated users
 */
export const NAV_ELEMENTS = {
  dashboard: 'Overview',
  quotations: 'Quotations',
  approvals: 'Approvals',
  pipeline: 'Pipeline',
  customers: 'Customers',
} as const;

/**
 * Test products from seed data
 */
export const TEST_PRODUCTS = {
  laptop: {
    name: 'Laptop',
    category: 'Hardware',
    price: 1200,
    cost: 850,
    type: 'ONE_TIME',
  },
  setupService: {
    name: 'Setup Service',
    category: 'Services',
    price: 500,
    cost: 250,
    type: 'ONE_TIME',
  },
  extendedWarranty: {
    name: 'Extended Warranty',
    category: 'Services',
    price: 199,
    cost: 80,
    type: 'ONE_TIME',
  },
  supportPlan: {
    name: 'Support Plan',
    category: 'Subscription',
    price: 99,
    cost: 35,
    type: 'RECURRING',
  },
} as const;

/**
 * Test customer data
 */
export const TEST_CUSTOMER = {
  name: 'Acme Corp',
  tier: 'Gold',
  tierLimit: 20, // percentage
  email: 'customer@acme.test',
} as const;

/**
 * Tier discount limits from seed data
 */
export const TIER_LIMITS = {
  Bronze: 5,
  Silver: 10,
  Gold: 20,
} as const;

/**
 * Category discount limits from seed data
 */
export const CATEGORY_LIMITS = {
  Hardware: 15,
  Services: 10,
  Subscription: 12,
} as const;

/**
 * Seed quotation for testing
 */
export const SEED_QUOTATION = {
  quoteNumber: 'Q-SEED-GOLD-DISCOUNT-SCENARIO',
  lines: [
    {
      product: 'Laptop',
      discount: 12,
      allowedLimit: 15, // min(Gold 20%, Hardware 15%)
      isViolation: false,
    },
    {
      product: 'Setup Service',
      discount: 18,
      allowedLimit: 10, // min(Gold 20%, Services 10%)
      isViolation: true,
      excessDiscount: 8, // 18% - 10%
    },
  ],
} as const;
