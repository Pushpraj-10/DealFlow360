/**
 * Canonical demo seed for the whole app. Safe to re-run any time: every
 * write is an upsert scoped to a specific document (by name/email/
 * quoteNumber/etc.), never a blanket deleteMany - MONGODB_URI now points at
 * a shared Atlas cluster used by the whole team, so this script must never
 * wipe collections wholesale the way an earlier version of it did against a
 * disposable local database.
 *
 * Covers the full account matrix (Sales Rep / Sales Manager / Finance /
 * Admin / Customer) plus the Person-2 scope (warehouses, inventory,
 * subscription plan + active subscription, and demo quotations sized to
 * exercise the warehouse-split, shipment-aware-invoicing, and deal-health
 * rules) on top of the same customers/tiers/categories/products/price
 * lists/discount rules/approval rules dhan's seedPerson1.js creates - both
 * scripts are safe to run in either order against the same database.
 */
import mongoose from 'mongoose';
import '../core/config/env.js';
import connectDB from '../core/db/index.js';
import {
    USER_ROLES,
    USER_STATUSES,
    CUSTOMER_STATUSES,
    PRODUCT_BILLING_TYPES,
    QUOTATION_STATUSES,
    APPROVAL_STATUSES,
    SIGNUP_REQUEST_STATUSES,
} from '../core/constants.js';
import { hashPassword } from '../modules/auth/auth.service.js';

import { User } from '../modules/users/user.model.js';
import { UserSignupRequest } from '../modules/users/userSignupRequest.model.js';
import { Customer } from '../modules/customers/customer.model.js';
import { CustomerTier } from '../modules/customerTiers/customerTier.model.js';
import { Category } from '../modules/categories/category.model.js';
import { Product } from '../modules/products/product.model.js';
import { ProductVariant } from '../modules/products/productVariant.model.js';
import { PriceList } from '../modules/priceLists/priceList.model.js';
import { DiscountRule } from '../modules/discountRules/discountRule.model.js';
import { ApprovalRule } from '../modules/approvals/approvalRule.model.js';
import { UpsellRule } from '../modules/recommendations/upsellRule.model.js';
import { Quotation } from '../modules/quotations/quotation.model.js';
import { QuotationLine } from '../modules/quotationLines/quotationLine.model.js';
import { calculateLineAmounts, calculateQuotationTotals } from '../modules/quotations/quotations.service.js';
import { Warehouse } from '../modules/warehouses/warehouse.model.js';
import { Inventory } from '../modules/inventory/inventory.model.js';
import { SubscriptionPlan } from '../modules/subscriptions/subscription-plan.model.js';
import { Subscription } from '../modules/subscriptions/subscription.model.js';
import { Invoice } from '../modules/invoicing/invoice.model.js';
import { InvoiceLine } from '../modules/invoicing/invoice-line.model.js';
import { Payment } from '../modules/invoicing/payment.model.js';
import { CreditNote } from '../modules/invoicing/credit-note.model.js';

const SEED_PASSWORD = 'Password123!';
const passwordHash = hashPassword(SEED_PASSWORD);

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(Date.now() - n * MS_PER_DAY);
const utcMidnight = (date) => {
    const d = new Date(date);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

const upsertByName = (Model, name, payload) =>
    Model.findOneAndUpdate(
        { name },
        { $set: { name, ...payload } },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

const upsertUser = (email, payload) =>
    User.findOneAndUpdate(
        { email },
        { $set: { email, passwordHash, status: USER_STATUSES.ACTIVE, ...payload } },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

const upsertCustomer = (payload) =>
    Customer.findOneAndUpdate(
        { email: payload.email, company: payload.company },
        { $set: { status: CUSTOMER_STATUSES.ACTIVE, ...payload } },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

/** Mirrors quotations.service.js's own math so seeded lines are internally
 * consistent with what the real add-line endpoint would have computed. */
const buildLine = ({ quotation, product, variant = null, quantity, discountPercent, allowedDiscountPercent }) => {
    const amounts = calculateLineAmounts({
        quantity,
        unitPrice: product.basePrice,
        costPrice: product.costPrice,
        discountPercent,
        taxPercentage: product.taxPercentage,
        allowedDiscountPercent,
    });

    return {
        quotationId: quotation._id,
        productId: product._id,
        variantId: variant?._id || null,
        lineType: product.billingType,
        quantity,
        unitPrice: product.basePrice,
        costPrice: product.costPrice,
        discountPercent,
        taxPercentage: product.taxPercentage,
        tax: amounts.tax,
        lineSubtotal: amounts.lineSubtotal,
        discountAmount: amounts.discountAmount,
        revenueAfterDiscount: amounts.revenueAfterDiscount,
        totalCost: amounts.totalCost,
        lineTotal: amounts.lineTotal,
        margin: amounts.margin,
        marginAmount: amounts.marginAmount,
        grossMarginAmount: amounts.grossMarginAmount,
        marginPercentage: amounts.marginPercentage,
        allowedDiscountPercent,
        allowed_discount: amounts.allowed_discount,
        actual_discount: amounts.actual_discount,
        excess_discount: amounts.excess_discount,
        is_violation: amounts.is_violation,
        violationAmount: amounts.violationAmount,
        description: product.name,
    };
};

/** Upserts a quotation by quoteNumber, replaces its lines, and recalculates
 * totals - safe to re-run. */
const upsertQuotationWithLines = async ({ quoteNumber, customerId, salesRepId, ownerId, status, lineBuilders }) => {
    const quotation = await Quotation.findOneAndUpdate(
        { quoteNumber },
        {
            $set: {
                quoteNumber,
                customerId,
                salesRepId,
                ownerId,
                status,
                currencyCode: 'USD',
                approvalStatus: APPROVAL_STATUSES.NOT_REQUIRED,
            },
        },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    await QuotationLine.deleteMany({ quotationId: quotation._id });
    const lines = await QuotationLine.insertMany(lineBuilders.map((build) => build(quotation)));

    const totals = await calculateQuotationTotals(quotation._id);
    await Quotation.findByIdAndUpdate(quotation._id, { $set: totals }, { runValidators: true });

    return { quotation, lines };
};

const run = async () => {
    await connectDB();
    console.log('Seeding DealFlow360 (idempotent upserts - existing data is updated in place, never deleted)...\n');

    // ---- Shared baseline (matches seedPerson1.js - safe if that already ran) ----
    const [bronze, silver, gold, platinum, startup, enterprise, government, education] = await Promise.all([
        upsertByName(CustomerTier, 'Bronze', { defaultMaxDiscountPercent: 5, description: 'Entry customer tier', isActive: true }),
        upsertByName(CustomerTier, 'Silver', { defaultMaxDiscountPercent: 10, description: 'Growth customer tier', isActive: true }),
        upsertByName(CustomerTier, 'Gold', { defaultMaxDiscountPercent: 20, description: 'Strategic customer tier', isActive: true }),
        upsertByName(CustomerTier, 'Platinum', { defaultMaxDiscountPercent: 25, description: 'Enterprise expansion tier', isActive: true }),
        upsertByName(CustomerTier, 'Startup', { defaultMaxDiscountPercent: 7, description: 'Early-stage customer tier', isActive: true }),
        upsertByName(CustomerTier, 'Enterprise', { defaultMaxDiscountPercent: 22, description: 'Large-account negotiated tier', isActive: true }),
        upsertByName(CustomerTier, 'Government', { defaultMaxDiscountPercent: 12, description: 'Public-sector buying tier', isActive: true }),
        upsertByName(CustomerTier, 'Education', { defaultMaxDiscountPercent: 18, description: 'Education and nonprofit tier', isActive: true }),
    ]);
    const customerTiers = [bronze, silver, gold, platinum, startup, enterprise, government, education];

    const [hardware, services, subscriptionCategory, networking, security, storage, collaboration, training] = await Promise.all([
        upsertByName(Category, 'Hardware', { description: 'Physical devices and equipment', maxAllowedDiscountPercent: 15, isActive: true }),
        upsertByName(Category, 'Services', { description: 'Implementation and professional services', maxAllowedDiscountPercent: 10, isActive: true }),
        upsertByName(Category, 'Subscription', { description: 'Recurring software and support plans', maxAllowedDiscountPercent: 12, isActive: true }),
        upsertByName(Category, 'Networking', { description: 'Connectivity, routing, and branch network equipment', maxAllowedDiscountPercent: 14, isActive: true }),
        upsertByName(Category, 'Security', { description: 'Identity, endpoint, and compliance products', maxAllowedDiscountPercent: 11, isActive: true }),
        upsertByName(Category, 'Storage', { description: 'Backup, storage, and archival products', maxAllowedDiscountPercent: 13, isActive: true }),
        upsertByName(Category, 'Collaboration', { description: 'Productivity and collaboration subscriptions', maxAllowedDiscountPercent: 12, isActive: true }),
        upsertByName(Category, 'Training', { description: 'Enablement and adoption services', maxAllowedDiscountPercent: 10, isActive: true }),
    ]);

    const [salesRep, salesManager, finance, admin] = await Promise.all([
        upsertUser('sales.rep@dealflow360.test', { fullName: 'Sam Sales Rep', role: USER_ROLES.SALES_REP }),
        upsertUser('sales.manager@dealflow360.test', { fullName: 'Maya Sales Manager', role: USER_ROLES.SALES_MANAGER }),
        upsertUser('finance@dealflow360.test', { fullName: 'Finn Finance', role: USER_ROLES.FINANCE }),
        upsertUser('admin@dealflow360.test', { fullName: 'Ada Admin', role: USER_ROLES.ADMIN }),
    ]);

    const customer = await Customer.findOneAndUpdate(
        { email: 'customer@acme.test', company: 'Acme Corp' },
        {
            $set: {
                name: 'Acme Buyer',
                email: 'customer@acme.test',
                company: 'Acme Corp',
                tierId: gold._id,
                status: CUSTOMER_STATUSES.ACTIVE,
                phone: '+1-555-0100',
                contactPerson: 'Acme Buyer',
                address: { street: '100 Market Street', city: 'San Francisco', state: 'CA', postalCode: '94105', country: 'USA' },
            },
        },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    const customerUser = await upsertUser('customer@acme.test', {
        fullName: 'Acme Buyer',
        role: USER_ROLES.CUSTOMER,
        customerId: customer._id,
    });

    const demoCustomers = [customer];
    const customerDefs = [
        { name: 'Nova Procurement', email: 'procurement@novaretail.test', company: 'Nova Retail', tierId: silver._id, phone: '+1-555-0101', contactPerson: 'Nora Reed', city: 'Austin', state: 'TX' },
        { name: 'Orion Buyer', email: 'buyer@orionfoods.test', company: 'Orion Foods', tierId: gold._id, phone: '+1-555-0102', contactPerson: 'Owen Clarke', city: 'Chicago', state: 'IL' },
        { name: 'Vertex Operations', email: 'ops@vertexhealth.test', company: 'Vertex Health', tierId: platinum._id, phone: '+1-555-0103', contactPerson: 'Vera Stone', city: 'Boston', state: 'MA' },
        { name: 'Summit IT', email: 'it@summitlogistics.test', company: 'Summit Logistics', tierId: bronze._id, phone: '+1-555-0104', contactPerson: 'Simon Lake', city: 'Denver', state: 'CO' },
        { name: 'Atlas Sourcing', email: 'sourcing@atlasinfra.test', company: 'Atlas Infrastructure', tierId: gold._id, phone: '+1-555-0105', contactPerson: 'Asha Patel', city: 'Seattle', state: 'WA' },
        { name: 'Pioneer Admin', email: 'admin@pioneerbank.test', company: 'Pioneer Bank', tierId: platinum._id, phone: '+1-555-0106', contactPerson: 'Priya Shah', city: 'New York', state: 'NY' },
        { name: 'Cobalt Buyer', email: 'buyer@cobaltenergy.test', company: 'Cobalt Energy', tierId: silver._id, phone: '+1-555-0107', contactPerson: 'Caleb Wright', city: 'Houston', state: 'TX' },
        { name: 'Harbor IT', email: 'it@harboredu.test', company: 'Harbor Education', tierId: bronze._id, phone: '+1-555-0108', contactPerson: 'Hana Kim', city: 'Portland', state: 'OR' },
        { name: 'Meridian Procurement', email: 'procurement@meridianlabs.test', company: 'Meridian Labs', tierId: gold._id, phone: '+1-555-0109', contactPerson: 'Miles Brooks', city: 'San Diego', state: 'CA' },
    ];

    for (const [index, definition] of customerDefs.entries()) {
        const seededCustomer = await upsertCustomer({
            name: definition.name,
            email: definition.email,
            company: definition.company,
            tierId: definition.tierId,
            phone: definition.phone,
            contactPerson: definition.contactPerson,
            address: {
                street: `${200 + index} Commerce Avenue`,
                city: definition.city,
                state: definition.state,
                postalCode: `90${String(index).padStart(3, '0')}`,
                country: 'USA',
            },
        });

        await upsertUser(definition.email, {
            fullName: definition.contactPerson,
            role: USER_ROLES.CUSTOMER,
            customerId: seededCustomer._id,
        });
        demoCustomers.push(seededCustomer);
    }

    const signupRequestDefs = [
        { fullName: 'Ivy Branch', email: 'ivy.branch@northwind.test', proposedRole: USER_ROLES.SALES_REP, proposedTeam: 'Enterprise Sales', status: SIGNUP_REQUEST_STATUSES.PENDING },
        { fullName: 'Liam Controls', email: 'liam.controls@dealflow360.test', proposedRole: USER_ROLES.FINANCE, proposedTeam: 'Finance Controls', status: SIGNUP_REQUEST_STATUSES.PENDING },
        { fullName: 'Mina Buyer', email: 'mina.buyer@aurora.test', proposedRole: USER_ROLES.CUSTOMER, customerName: 'Mina Buyer', customerCompany: 'Aurora Works', customerPhone: '+1-555-0202', status: SIGNUP_REQUEST_STATUSES.PENDING },
        { fullName: 'Theo Ops', email: 'theo.ops@dealflow360.test', proposedRole: USER_ROLES.SALES_MANAGER, proposedTeam: 'Operations Review', status: SIGNUP_REQUEST_STATUSES.APPROVED },
        { fullName: 'Rhea Vendor', email: 'rhea.vendor@external.test', proposedRole: USER_ROLES.CUSTOMER, customerName: 'Rhea Vendor', customerCompany: 'External Vendor Co', customerPhone: '+1-555-0204', status: SIGNUP_REQUEST_STATUSES.REJECTED },
        { fullName: 'Noah Admin', email: 'noah.admin@dealflow360.test', proposedRole: USER_ROLES.ADMIN, proposedTeam: 'Platform', status: SIGNUP_REQUEST_STATUSES.PENDING },
        { fullName: 'Ella Finance', email: 'ella.finance@dealflow360.test', proposedRole: USER_ROLES.FINANCE, proposedTeam: 'Billing', status: SIGNUP_REQUEST_STATUSES.APPROVED },
        { fullName: 'Kai Customer', email: 'kai.customer@zenith.test', proposedRole: USER_ROLES.CUSTOMER, customerName: 'Kai Customer', customerCompany: 'Zenith Advisory', customerPhone: '+1-555-0208', status: SIGNUP_REQUEST_STATUSES.PENDING },
    ];

    for (const request of signupRequestDefs) {
        await UserSignupRequest.findOneAndUpdate(
            { email: request.email },
            {
                $set: {
                    ...request,
                    passwordHash,
                    reviewedById: request.status === SIGNUP_REQUEST_STATUSES.PENDING ? null : admin._id,
                    reviewedAt: request.status === SIGNUP_REQUEST_STATUSES.PENDING ? null : daysAgo(2),
                    reviewNote: request.status === SIGNUP_REQUEST_STATUSES.REJECTED ? 'Company domain could not be verified.' : null,
                },
            },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        );
    }

    const productDefs = [
        { name: 'Laptop', categoryId: hardware._id, productType: 'Hardware', billingType: PRODUCT_BILLING_TYPES.ONE_TIME, basePrice: 1200, costPrice: 850, taxPercentage: 8, unit: 'each', description: 'Business laptop', isStockManaged: true },
        { name: 'Workstation Pro', categoryId: hardware._id, productType: 'Hardware', billingType: PRODUCT_BILLING_TYPES.ONE_TIME, basePrice: 2400, costPrice: 1725, taxPercentage: 8, unit: 'each', description: 'High performance desktop workstation', isStockManaged: true },
        { name: 'Docking Station', categoryId: hardware._id, productType: 'Hardware', billingType: PRODUCT_BILLING_TYPES.ONE_TIME, basePrice: 220, costPrice: 125, taxPercentage: 8, unit: 'each', description: 'USB-C docking station', isStockManaged: true },
        { name: 'Edge Router', categoryId: networking._id, productType: 'Networking', billingType: PRODUCT_BILLING_TYPES.ONE_TIME, basePrice: 890, costPrice: 540, taxPercentage: 8, unit: 'each', description: 'Branch edge routing appliance', isStockManaged: true },
        { name: 'Security Gateway', categoryId: security._id, productType: 'Security', billingType: PRODUCT_BILLING_TYPES.ONE_TIME, basePrice: 1450, costPrice: 930, taxPercentage: 8, unit: 'each', description: 'Managed firewall gateway', isStockManaged: true },
        { name: 'Backup Appliance', categoryId: storage._id, productType: 'Storage', billingType: PRODUCT_BILLING_TYPES.ONE_TIME, basePrice: 1750, costPrice: 1180, taxPercentage: 8, unit: 'each', description: 'Local backup and recovery appliance', isStockManaged: true },
        { name: 'Setup Service', categoryId: services._id, productType: 'Service', billingType: PRODUCT_BILLING_TYPES.ONE_TIME, basePrice: 500, costPrice: 250, taxPercentage: 8, unit: 'project', description: 'Deployment and setup', isStockManaged: false },
        { name: 'Migration Workshop', categoryId: services._id, productType: 'Service', billingType: PRODUCT_BILLING_TYPES.ONE_TIME, basePrice: 1800, costPrice: 950, taxPercentage: 8, unit: 'project', description: 'Data and user migration workshop', isStockManaged: false },
        { name: 'Admin Training', categoryId: training._id, productType: 'Training', billingType: PRODUCT_BILLING_TYPES.ONE_TIME, basePrice: 950, costPrice: 420, taxPercentage: 8, unit: 'session', description: 'Administrator enablement session', isStockManaged: false },
        { name: 'Extended Warranty', categoryId: services._id, productType: 'Service', billingType: PRODUCT_BILLING_TYPES.ONE_TIME, basePrice: 199, costPrice: 80, taxPercentage: 8, unit: 'each', description: 'Additional warranty coverage', isStockManaged: false },
        { name: 'Support Plan', categoryId: subscriptionCategory._id, productType: 'Subscription', billingType: PRODUCT_BILLING_TYPES.RECURRING, recurringPlanReference: 'support-plan-monthly', basePrice: 99, costPrice: 35, taxPercentage: 8, unit: 'month', description: 'Monthly support plan', isStockManaged: false },
        { name: 'Security Monitoring', categoryId: subscriptionCategory._id, productType: 'Subscription', billingType: PRODUCT_BILLING_TYPES.RECURRING, recurringPlanReference: 'security-monitoring-monthly', basePrice: 249, costPrice: 90, taxPercentage: 8, unit: 'month', description: 'Managed security monitoring', isStockManaged: false },
        { name: 'Cloud Backup', categoryId: storage._id, productType: 'Subscription', billingType: PRODUCT_BILLING_TYPES.RECURRING, recurringPlanReference: 'cloud-backup-monthly', basePrice: 179, costPrice: 65, taxPercentage: 8, unit: 'month', description: 'Managed cloud backup subscription', isStockManaged: false },
        { name: 'Collaboration Suite', categoryId: collaboration._id, productType: 'Subscription', billingType: PRODUCT_BILLING_TYPES.RECURRING, recurringPlanReference: 'collaboration-suite-monthly', basePrice: 149, costPrice: 45, taxPercentage: 8, unit: 'seat/month', description: 'Team collaboration software bundle', isStockManaged: false },
    ];

    const products = {};
    for (const payload of productDefs) {
        // isStockManaged is a Person-2 field seedPerson1.js doesn't set; upserting
        // it explicitly here corrects the schema's `true` default for the
        // service/subscription products so the warehouse-split logic doesn't
        // try to allocate stock for non-physical lines.
        products[payload.name] = await Product.findOneAndUpdate(
            { name: payload.name, categoryId: payload.categoryId },
            { $set: { ...payload, isActive: true } },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        );
    }

    for (const tier of customerTiers) {
        await PriceList.findOneAndUpdate(
            { name: `${tier.name} USD Price List` },
            {
                $set: {
                    name: `${tier.name} USD Price List`,
                    customerTierId: tier._id,
                    currencyCode: 'USD',
                    isActive: true,
                    items: Object.values(products).map((product) => ({
                        productId: product._id,
                        variantId: null,
                        unitPrice: product.basePrice,
                        basePriceOverride: product.basePrice,
                        validFrom: null,
                        validTo: null,
                    })),
                },
            },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        );
    }

    for (const rule of [
        { name: 'Gold tier ceiling', customerTierId: gold._id, categoryId: null, maxDiscountPercent: 20 },
        { name: 'Platinum tier ceiling', customerTierId: platinum._id, categoryId: null, maxDiscountPercent: 25 },
        { name: 'Enterprise tier ceiling', customerTierId: enterprise._id, categoryId: null, maxDiscountPercent: 22 },
        { name: 'Hardware category ceiling', customerTierId: null, categoryId: hardware._id, maxDiscountPercent: 15 },
        { name: 'Services category ceiling', customerTierId: null, categoryId: services._id, maxDiscountPercent: 10 },
        { name: 'Subscription category ceiling', customerTierId: null, categoryId: subscriptionCategory._id, maxDiscountPercent: 12 },
        { name: 'Networking category ceiling', customerTierId: null, categoryId: networking._id, maxDiscountPercent: 14 },
        { name: 'Security category ceiling', customerTierId: null, categoryId: security._id, maxDiscountPercent: 11 },
        { name: 'Storage category ceiling', customerTierId: null, categoryId: storage._id, maxDiscountPercent: 13 },
        { name: 'Collaboration category ceiling', customerTierId: null, categoryId: collaboration._id, maxDiscountPercent: 12 },
        { name: 'Training category ceiling', customerTierId: null, categoryId: training._id, maxDiscountPercent: 10 },
    ]) {
        await DiscountRule.findOneAndUpdate({ name: rule.name }, { $set: { ...rule, isActive: true } }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
    }

    for (const rule of [
        { name: 'Within Limit', minRiskScore: 0, maxRiskScore: 0, severity: 'NONE', requiredApprovalRoles: [], priority: 1 },
        { name: 'Medium Risk Manager Approval', minRiskScore: 0.01, maxRiskScore: 5.99, severity: 'MEDIUM', requiredApprovalRoles: [USER_ROLES.SALES_MANAGER], priority: 10 },
        { name: 'High Risk Manager Finance Approval', minRiskScore: 6, maxRiskScore: 100, severity: 'HIGH', requiredApprovalRoles: [USER_ROLES.SALES_MANAGER, USER_ROLES.FINANCE], priority: 20 },
    ]) {
        await ApprovalRule.findOneAndUpdate(
            { name: rule.name },
            { $set: { ...rule, minExcessDiscountExposure: 0, maxExcessDiscountExposure: Number.MAX_SAFE_INTEGER, isActive: true } },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        );
    }

    await UpsellRule.findOneAndUpdate(
        { sourceProductId: products.Laptop._id },
        {
            $set: {
                sourceProductId: products.Laptop._id,
                suggestedProductIds: [products['Extended Warranty']._id, products['Support Plan']._id],
                coPurchaseScore: 80,
                promotionBoost: 10,
                minimumRequiredMarginPercent: 20,
                isActive: true,
            },
        },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    // seedPerson1.js's own reference quotation (kept in sync here too, harmless if it already ran it)
    await upsertQuotationWithLines({
        quoteNumber: 'Q-SEED-GOLD-DISCOUNT-SCENARIO',
        customerId: customer._id,
        salesRepId: salesRep._id,
        ownerId: salesRep._id,
        status: QUOTATION_STATUSES.DRAFT,
        lineBuilders: [
            (q) => buildLine({ quotation: q, product: products.Laptop, quantity: 1, discountPercent: 12, allowedDiscountPercent: 15 }),
            (q) => buildLine({ quotation: q, product: products['Setup Service'], quantity: 1, discountPercent: 18, allowedDiscountPercent: 10 }),
        ],
    });

    // ---- Person 2 additions ----

    const variantDefs = [
        { product: products.Laptop, sku: 'LAPTOP-001', name: 'Standard', extraPrice: 0, attributes: { memory: '16GB', storage: '512GB' } },
        { product: products.Laptop, sku: 'LAPTOP-PRO-002', name: 'Pro', extraPrice: 450, attributes: { memory: '32GB', storage: '1TB' } },
        { product: products['Workstation Pro'], sku: 'WORKSTATION-PRO-001', name: 'Tower', extraPrice: 0, attributes: { cpu: 'Xeon', memory: '64GB' } },
        { product: products['Docking Station'], sku: 'DOCK-USBC-001', name: 'USB-C', extraPrice: 0, attributes: { ports: '12', power: '100W' } },
        { product: products['Edge Router'], sku: 'ROUTER-EDGE-001', name: 'Branch', extraPrice: 0, attributes: { throughput: '2Gbps', vpn: 'Enabled' } },
        { product: products['Edge Router'], sku: 'ROUTER-EDGE-HA-002', name: 'Branch HA', extraPrice: 320, attributes: { throughput: '4Gbps', vpn: 'Enabled' } },
        { product: products['Security Gateway'], sku: 'SEC-GW-001', name: 'Standard', extraPrice: 0, attributes: { users: '250', inspection: 'Standard' } },
        { product: products['Security Gateway'], sku: 'SEC-GW-ENT-002', name: 'Enterprise', extraPrice: 575, attributes: { users: '1000', inspection: 'Advanced' } },
        { product: products['Backup Appliance'], sku: 'BACKUP-APPL-001', name: '24TB', extraPrice: 0, attributes: { capacity: '24TB', retention: '30 days' } },
        { product: products['Backup Appliance'], sku: 'BACKUP-APPL-HA-002', name: '48TB HA', extraPrice: 680, attributes: { capacity: '48TB', retention: '90 days' } },
    ];
    const variants = {};

    for (const definition of variantDefs) {
        variants[definition.sku] = await ProductVariant.findOneAndUpdate(
            { productId: definition.product._id, sku: definition.sku },
            {
                $set: {
                    productId: definition.product._id,
                    sku: definition.sku,
                    name: definition.name,
                    attributes: definition.attributes,
                    extraPrice: definition.extraPrice,
                    isActive: true,
                },
            },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        );
    }

    const laptopVariant = variants['LAPTOP-001'];

    const warehouseDefs = [
        { name: 'Main Warehouse', shipping_cost_weight: 1.0 },
        { name: 'East Depot', shipping_cost_weight: 1.8 },
        { name: 'West Hub', shipping_cost_weight: 1.4 },
        { name: 'Central Fulfillment', shipping_cost_weight: 1.1 },
        { name: 'South Crossdock', shipping_cost_weight: 1.6 },
        { name: 'Northeast Reserve', shipping_cost_weight: 2.0 },
        { name: 'Pacific Overflow', shipping_cost_weight: 1.9 },
        { name: 'Enterprise Staging', shipping_cost_weight: 1.3 },
    ];
    const warehouses = [];

    for (const definition of warehouseDefs) {
        warehouses.push(await upsertByName(Warehouse, definition.name, { shipping_cost_weight: definition.shipping_cost_weight, active: true }));
    }

    const [mainWarehouse, eastDepot] = warehouses;

    const upsertInventory = (warehouseId, sku, onHand, reserved) =>
        Inventory.findOneAndUpdate(
            { warehouse_id: warehouseId, sku },
            { $set: { warehouse_id: warehouseId, sku, on_hand: onHand, reserved } },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        );

    // Main available = 40-18 = 22, East available = 10-6 = 4 -> forces a
    // Main+East split for the 25-unit demo line below (Scenario 1), and the
    // resulting Main allocation (22 units) is used for the partial-shipment
    // test (Scenario 3).
    await upsertInventory(mainWarehouse._id, 'LAPTOP-001', 40, 18);
    await upsertInventory(eastDepot._id, 'LAPTOP-001', 10, 6);

    for (const [warehouseIndex, warehouse] of warehouses.entries()) {
        for (const [skuIndex, sku] of Object.keys(variants).entries()) {
            if (warehouse._id.equals(mainWarehouse._id) && sku === 'LAPTOP-001') {
                continue;
            }

            if (warehouse._id.equals(eastDepot._id) && sku === 'LAPTOP-001') {
                continue;
            }

            await upsertInventory(
                warehouse._id,
                sku,
                18 + warehouseIndex * 5 + skuIndex * 3,
                (warehouseIndex + skuIndex) % 7
            );
        }
    }

    const planDefs = [
        { name: 'Support Plan Monthly', cycle: 'monthly', cancellation_policy: 'credit_remaining' },
        { name: 'Support Plan Quarterly', cycle: 'quarterly', cancellation_policy: 'credit_remaining' },
        { name: 'Security Monitoring Monthly', cycle: 'monthly', cancellation_policy: 'credit_remaining' },
        { name: 'Security Monitoring Yearly', cycle: 'yearly', cancellation_policy: 'credit_remaining' },
        { name: 'Cloud Backup Monthly', cycle: 'monthly', cancellation_policy: 'credit_remaining' },
        { name: 'Cloud Backup Yearly', cycle: 'yearly', cancellation_policy: 'credit_remaining' },
        { name: 'Collaboration Suite Monthly', cycle: 'monthly', cancellation_policy: 'credit_remaining' },
        { name: 'Collaboration Suite Yearly', cycle: 'yearly', cancellation_policy: 'credit_remaining' },
    ];
    const subscriptionPlans = {};

    for (const definition of planDefs) {
        subscriptionPlans[definition.name] = await upsertByName(SubscriptionPlan, definition.name, {
            cycle: definition.cycle,
            proration_policy: 'daily_calendar',
            cancellation_policy: definition.cancellation_policy,
            active: true,
        });
    }

    const supportPlanMonthly = subscriptionPlans['Support Plan Monthly'];

    // Fulfillment demo quotation: 25 laptops (forces warehouse split) + 1
    // Support Plan (recurring, feeds the Subscription below).
    const { quotation: fulfillmentQuotation, lines: fulfillmentLines } = await upsertQuotationWithLines({
        quoteNumber: 'Q-DEMO-FULFILLMENT',
        customerId: customer._id,
        salesRepId: salesRep._id,
        ownerId: salesRep._id,
        status: QUOTATION_STATUSES.CONFIRMED,
        lineBuilders: [
            (q) => buildLine({ quotation: q, product: products.Laptop, variant: laptopVariant, quantity: 25, discountPercent: 8, allowedDiscountPercent: 15 }),
            (q) => buildLine({ quotation: q, product: products['Support Plan'], quantity: 1, discountPercent: 0, allowedDiscountPercent: 12 }),
        ],
    });
    const supportPlanLine = fulfillmentLines.find((l) => l.productId.toString() === products['Support Plan']._id.toString());

    // Active mid-period subscription for the proration test (Scenario 2).
    // Deterministic period (10 days in, 30-day period) so proration math is
    // exactly reproducible regardless of the calendar date this runs on.
    const periodStart = utcMidnight(daysAgo(10));
    const periodEnd = new Date(periodStart.getTime() + 30 * MS_PER_DAY);
    const subscription = await Subscription.findOneAndUpdate(
        { customer_id: customer._id, originating_quote_line_id: supportPlanLine._id },
        {
            $set: {
                customer_id: customer._id,
                originating_quote_line_id: supportPlanLine._id,
                plan_id: supportPlanMonthly._id,
                status: 'ACTIVE',
                start_date: periodStart,
                next_bill_date: periodEnd,
                qty: 1,
                recurring_unit_price_cents: Math.round(products['Support Plan'].basePrice * 100),
                current_period_start: periodStart,
                current_period_end: periodEnd,
            },
        },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    // Rep discount history (5-8%, within the Services 10% ceiling) plus one
    // 30% outlier -> discount-anomaly trigger against Sam's own average.
    for (const [i, discountPercent] of [5, 6, 8].entries()) {
        await upsertQuotationWithLines({
            quoteNumber: `Q-HIST-${i + 1}`,
            customerId: customer._id,
            salesRepId: salesRep._id,
            ownerId: salesRep._id,
            status: QUOTATION_STATUSES.CONFIRMED,
            lineBuilders: [(q) => buildLine({ quotation: q, product: products['Extended Warranty'], quantity: 2, discountPercent, allowedDiscountPercent: 10 })],
        });
    }

    await upsertQuotationWithLines({
        quoteNumber: 'Q-DEMO-ANOMALY',
        customerId: customer._id,
        salesRepId: salesRep._id,
        ownerId: salesRep._id,
        status: QUOTATION_STATUSES.PENDING_APPROVAL,
        lineBuilders: [(q) => buildLine({ quotation: q, product: products['Extended Warranty'], quantity: 2, discountPercent: 30, allowedDiscountPercent: 10 })],
    });

    // Stalled + delivery-slippage demo: requested soon, but last touched 9
    // days ago (updatedAt force-set below, bypassing Mongoose's auto-touch).
    const { quotation: stalledQuotation } = await upsertQuotationWithLines({
        quoteNumber: 'Q-DEMO-STALLED',
        customerId: customer._id,
        salesRepId: salesRep._id,
        ownerId: salesRep._id,
        status: QUOTATION_STATUSES.APPROVED,
        lineBuilders: [(q) => buildLine({ quotation: q, product: products['Setup Service'], quantity: 1, discountPercent: 5, allowedDiscountPercent: 10 })],
    });
    await Quotation.updateOne({ _id: stalledQuotation._id }, { $set: { requestedDeliveryDate: daysAgo(-3), updatedAt: daysAgo(9) } }, { timestamps: false });

    const portfolioQuotes = [
        { quoteNumber: 'Q-PROTO-001-DRAFT', customerIndex: 1, status: QUOTATION_STATUSES.DRAFT, lines: [['Laptop', 'LAPTOP-001', 4, 5, 15], ['Docking Station', 'DOCK-USBC-001', 4, 4, 15]] },
        { quoteNumber: 'Q-PROTO-002-MANAGER', customerIndex: 2, status: QUOTATION_STATUSES.PENDING_APPROVAL, approvalStatus: APPROVAL_STATUSES.PENDING, riskSeverity: 'MEDIUM', riskScore: 3.4, lines: [['Setup Service', null, 2, 16, 10], ['Support Plan', null, 12, 5, 12]] },
        { quoteNumber: 'Q-PROTO-003-HIGH', customerIndex: 3, status: QUOTATION_STATUSES.PENDING_APPROVAL, approvalStatus: APPROVAL_STATUSES.PENDING, riskSeverity: 'HIGH', riskScore: 8.2, lines: [['Security Gateway', 'SEC-GW-ENT-002', 5, 22, 11], ['Security Monitoring', null, 24, 10, 12]] },
        { quoteNumber: 'Q-PROTO-004-APPROVED', customerIndex: 4, status: QUOTATION_STATUSES.APPROVED, approvalStatus: APPROVAL_STATUSES.APPROVED, riskSeverity: 'LOW', riskScore: 1.1, lines: [['Migration Workshop', null, 1, 7, 10], ['Extended Warranty', null, 8, 5, 10]] },
        { quoteNumber: 'Q-PROTO-005-SENT', customerIndex: 5, status: QUOTATION_STATUSES.SENT_TO_CUSTOMER, approvalStatus: APPROVAL_STATUSES.APPROVED, riskSeverity: 'NONE', riskScore: 0, lines: [['Edge Router', 'ROUTER-EDGE-001', 6, 6, 14], ['Setup Service', null, 1, 5, 10]] },
        { quoteNumber: 'Q-PROTO-006-CUSTOMER', customerIndex: 6, status: QUOTATION_STATUSES.READY_FOR_CUSTOMER, approvalStatus: APPROVAL_STATUSES.NOT_REQUIRED, riskSeverity: 'NONE', riskScore: 0, lines: [['Workstation Pro', 'WORKSTATION-PRO-001', 3, 3, 15], ['Support Plan', null, 6, 0, 12]] },
        { quoteNumber: 'Q-PROTO-007-NEGOTIATION', customerIndex: 7, status: QUOTATION_STATUSES.UNDER_NEGOTIATION, approvalStatus: APPROVAL_STATUSES.APPROVED, riskSeverity: 'MEDIUM', riskScore: 2.8, lines: [['Laptop', 'LAPTOP-PRO-002', 7, 12, 15], ['Security Monitoring', null, 7, 8, 12]] },
        { quoteNumber: 'Q-PROTO-008-CONFIRMED', customerIndex: 8, status: QUOTATION_STATUSES.CONFIRMED, approvalStatus: APPROVAL_STATUSES.APPROVED, riskSeverity: 'LOW', riskScore: 0.8, lines: [['Docking Station', 'DOCK-USBC-001', 18, 7, 15], ['Extended Warranty', null, 18, 3, 10]] },
        { quoteNumber: 'Q-PROTO-009-REJECTED', customerIndex: 9, status: QUOTATION_STATUSES.REJECTED, approvalStatus: APPROVAL_STATUSES.REJECTED, riskSeverity: 'HIGH', riskScore: 9.6, lines: [['Security Gateway', 'SEC-GW-001', 3, 28, 11], ['Migration Workshop', null, 1, 20, 10]] },
        { quoteNumber: 'Q-PROTO-010-CANCELLED', customerIndex: 0, status: QUOTATION_STATUSES.CANCELLED, approvalStatus: APPROVAL_STATUSES.CANCELLED, riskSeverity: 'LOW', riskScore: 1.6, lines: [['Edge Router', 'ROUTER-EDGE-HA-002', 2, 4, 14], ['Setup Service', null, 1, 2, 10]] },
        { quoteNumber: 'Q-PROTO-011-CLOUD-SUB', customerIndex: 1, status: QUOTATION_STATUSES.CONFIRMED, approvalStatus: APPROVAL_STATUSES.APPROVED, riskSeverity: 'NONE', riskScore: 0, lines: [['Cloud Backup', null, 15, 4, 13], ['Backup Appliance', 'BACKUP-APPL-001', 2, 6, 13]] },
        { quoteNumber: 'Q-PROTO-012-COLLAB-SUB', customerIndex: 2, status: QUOTATION_STATUSES.CONFIRMED, approvalStatus: APPROVAL_STATUSES.APPROVED, riskSeverity: 'LOW', riskScore: 1.2, lines: [['Collaboration Suite', null, 40, 8, 12], ['Admin Training', null, 2, 4, 10]] },
        { quoteNumber: 'Q-PROTO-013-MONITORING-SUB', customerIndex: 3, status: QUOTATION_STATUSES.SENT_TO_CUSTOMER, approvalStatus: APPROVAL_STATUSES.APPROVED, riskSeverity: 'MEDIUM', riskScore: 2.3, lines: [['Security Monitoring', null, 18, 9, 12], ['Security Gateway', 'SEC-GW-001', 4, 7, 11]] },
        { quoteNumber: 'Q-PROTO-014-BACKUP-RENEWAL', customerIndex: 4, status: QUOTATION_STATUSES.APPROVED, approvalStatus: APPROVAL_STATUSES.APPROVED, riskSeverity: 'LOW', riskScore: 1.4, lines: [['Cloud Backup', null, 25, 6, 13], ['Backup Appliance', 'BACKUP-APPL-HA-002', 1, 5, 13]] },
    ];
    const seededPortfolioQuotes = [];

    for (const [index, quoteDef] of portfolioQuotes.entries()) {
        const seededQuote = await upsertQuotationWithLines({
            quoteNumber: quoteDef.quoteNumber,
            customerId: demoCustomers[quoteDef.customerIndex]._id,
            salesRepId: salesRep._id,
            ownerId: salesRep._id,
            status: quoteDef.status,
            lineBuilders: quoteDef.lines.map(([productName, sku, quantity, discountPercent, allowedDiscountPercent]) => (
                (q) => buildLine({
                    quotation: q,
                    product: products[productName],
                    variant: sku ? variants[sku] : null,
                    quantity,
                    discountPercent,
                    allowedDiscountPercent,
                })
            )),
        });

        await Quotation.updateOne(
            { _id: seededQuote.quotation._id },
            {
                $set: {
                    approvalStatus: quoteDef.approvalStatus ?? APPROVAL_STATUSES.NOT_REQUIRED,
                    riskSeverity: quoteDef.riskSeverity ?? 'NONE',
                    riskScore: quoteDef.riskScore ?? 0,
                    requestedDeliveryDate: daysAgo(-(index + 4)),
                    confirmedById: quoteDef.status === QUOTATION_STATUSES.CONFIRMED ? customerUser._id : null,
                    confirmedAt: quoteDef.status === QUOTATION_STATUSES.CONFIRMED ? daysAgo(1) : null,
                    confirmedVersion: quoteDef.status === QUOTATION_STATUSES.CONFIRMED ? 1 : null,
                    updatedAt: daysAgo(index),
                },
            },
            { timestamps: false }
        );
        seededPortfolioQuotes.push(seededQuote);
    }

    const recurringProductIds = [
        products['Support Plan']._id.toString(),
        products['Security Monitoring']._id.toString(),
        products['Cloud Backup']._id.toString(),
        products['Collaboration Suite']._id.toString(),
    ];
    const recurringQuotes = [
        seededPortfolioQuotes[1],
        seededPortfolioQuotes[2],
        seededPortfolioQuotes[5],
        seededPortfolioQuotes[6],
        seededPortfolioQuotes[10],
        seededPortfolioQuotes[11],
        seededPortfolioQuotes[12],
        seededPortfolioQuotes[13],
        fulfillmentLines.length ? { lines: fulfillmentLines } : null,
    ].filter(Boolean);
    const recurringLines = recurringQuotes
        .flatMap((entry) => entry.lines)
        .filter((line) => recurringProductIds.includes(line.productId.toString()));
    const extraSubscriptions = [];

    for (const [index, line] of recurringLines.entries()) {
        const productId = line.productId.toString();
        let plan;

        if (productId === products['Security Monitoring']._id.toString()) {
            plan = subscriptionPlans[index % 2 === 0 ? 'Security Monitoring Monthly' : 'Security Monitoring Yearly'];
        } else if (productId === products['Cloud Backup']._id.toString()) {
            plan = subscriptionPlans[index % 2 === 0 ? 'Cloud Backup Monthly' : 'Cloud Backup Yearly'];
        } else if (productId === products['Collaboration Suite']._id.toString()) {
            plan = subscriptionPlans[index % 2 === 0 ? 'Collaboration Suite Monthly' : 'Collaboration Suite Yearly'];
        } else {
            plan = subscriptionPlans[index % 2 === 0 ? 'Support Plan Monthly' : 'Support Plan Quarterly'];
        }
        const start = utcMidnight(daysAgo(20 + index * 3));
        const end = new Date(start.getTime() + (plan.cycle === 'yearly' ? 365 : plan.cycle === 'quarterly' ? 90 : 30) * MS_PER_DAY);

        extraSubscriptions.push(await Subscription.findOneAndUpdate(
            { originating_quote_line_id: line._id },
            {
                $set: {
                    customer_id: demoCustomers[(index + 2) % demoCustomers.length]._id,
                    originating_quote_line_id: line._id,
                    plan_id: plan._id,
                    status: index % 4 === 3 ? 'PAUSED' : 'ACTIVE',
                    start_date: start,
                    next_bill_date: end,
                    qty: Math.max(1, line.quantity),
                    recurring_unit_price_cents: Math.round(line.unitPrice * 100),
                    current_period_start: start,
                    current_period_end: end,
                },
            },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        ));
    }

    const invoiceStatuses = ['DRAFT', 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'UNPAID', 'PAID', 'PARTIALLY_PAID', 'DRAFT'];
    const invoiceSources = seededPortfolioQuotes.slice(0, 8);
    const invoices = [];

    for (const [index, quoteEntry] of invoiceSources.entries()) {
        const totalCents = Math.max(10000, Math.round(quoteEntry.quotation.grandTotal * 100));
        const status = invoiceStatuses[index];
        const paidAmount = status === 'PAID' ? totalCents : status === 'PARTIALLY_PAID' ? Math.round(totalCents * 0.45) : 0;
        const invoice = await Invoice.findOneAndUpdate(
            { invoice_no: `INV-PROTO-${String(index + 1).padStart(3, '0')}` },
            {
                $set: {
                    invoice_no: `INV-PROTO-${String(index + 1).padStart(3, '0')}`,
                    customer_id: demoCustomers[index % demoCustomers.length]._id,
                    quotation_id: quoteEntry.quotation._id,
                    billing_period: `2026-${String((index % 9) + 1).padStart(2, '0')}`,
                    status,
                    issue_date: daysAgo(16 - index),
                    due_date: daysAgo(-(14 + index)),
                    currency: 'USD',
                    subtotal_cents: Math.round(totalCents / 1.08),
                    tax_cents: totalCents - Math.round(totalCents / 1.08),
                    total_cents: totalCents,
                    paid_amount_cents: paidAmount,
                },
            },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        );

        await InvoiceLine.findOneAndUpdate(
            { invoice_id: invoice._id, source_type: 'service', source_id: quoteEntry.lines[0]._id },
            {
                $set: {
                    invoice_id: invoice._id,
                    source_type: 'service',
                    source_id: quoteEntry.lines[0]._id,
                    description: `Prototype billing for ${quoteEntry.quotation.quoteNumber}`,
                    qty: 1,
                    unit_price_cents: totalCents,
                    tax_cents: totalCents - Math.round(totalCents / 1.08),
                    amount_cents: totalCents,
                },
            },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        );

        if (paidAmount > 0) {
            await Payment.findOneAndUpdate(
                { invoice_id: invoice._id, reference: `PAY-PROTO-${String(index + 1).padStart(3, '0')}` },
                {
                    $set: {
                        invoice_id: invoice._id,
                        amount_cents: paidAmount,
                        paid_at: daysAgo(4 - Math.min(index, 3)),
                        method: index % 2 === 0 ? 'bank_transfer' : 'card',
                        reference: `PAY-PROTO-${String(index + 1).padStart(3, '0')}`,
                        recorded_by: finance._id,
                    },
                },
                { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
            );
        }

        invoices.push(invoice);
    }

    for (const [index, invoice] of invoices.slice(0, 4).entries()) {
        await CreditNote.findOneAndUpdate(
            { invoice_id: invoice._id, reason: `Prototype adjustment ${index + 1}` },
            {
                $set: {
                    customer_id: invoice.customer_id,
                    invoice_id: invoice._id,
                    amount_cents: 2500 + index * 1750,
                    reason: `Prototype adjustment ${index + 1}`,
                    status: index % 2 === 0 ? 'ISSUED' : 'APPLIED',
                },
            },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        );
    }

    console.log('Seed complete.\n');
    console.table([
        { role: 'Sales Rep', email: salesRep.email, id: salesRep._id.toString() },
        { role: 'Sales Manager', email: salesManager.email, id: salesManager._id.toString() },
        { role: 'Finance', email: finance.email, id: finance._id.toString() },
        { role: 'Admin', email: admin.email, id: admin._id.toString() },
        { role: 'Customer', email: customerUser.email, id: customerUser._id.toString() },
    ]);
    console.log(`\nAll accounts share the password: ${SEED_PASSWORD}`);
    console.table([
        { what: 'Customer (Acme Corp, Gold)', id: customer._id.toString() },
        { what: 'Warehouse (Main)', id: mainWarehouse._id.toString() },
        { what: 'Warehouse (East)', id: eastDepot._id.toString() },
        { what: 'Quotation Q-DEMO-FULFILLMENT (25 laptops -> forces split)', id: fulfillmentQuotation._id.toString() },
        { what: 'Subscription (Support Plan, active mid-period)', id: subscription._id.toString() },
        { what: 'Quotation Q-DEMO-STALLED (stalled + delivery slippage)', id: stalledQuotation._id.toString() },
        { what: 'Quotation Q-DEMO-ANOMALY (discount anomaly)', id: 'see quoteNumber Q-DEMO-ANOMALY' },
    ]);

    console.log(`\nLog in:\n  curl -X POST http://localhost:${process.env.PORT || 8001}/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"finance@dealflow360.test","password":"${SEED_PASSWORD}"}'`);
    console.log(`\nThen, e.g.:\n  curl -X POST http://localhost:${process.env.PORT || 8001}/api/v1/fulfillments -H "Authorization: Bearer <accessToken>" -H "Content-Type: application/json" -d '{"quotation_id":"${fulfillmentQuotation._id}"}'`);

    await mongoose.disconnect();
    process.exit(0);
};

run().catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
});
