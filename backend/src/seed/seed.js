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
} from '../core/constants.js';
import { hashPassword } from '../modules/auth/auth.service.js';

import { User } from '../modules/users/user.model.js';
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
    const [bronze, silver, gold] = await Promise.all([
        upsertByName(CustomerTier, 'Bronze', { defaultMaxDiscountPercent: 5, description: 'Entry customer tier', isActive: true }),
        upsertByName(CustomerTier, 'Silver', { defaultMaxDiscountPercent: 10, description: 'Growth customer tier', isActive: true }),
        upsertByName(CustomerTier, 'Gold', { defaultMaxDiscountPercent: 20, description: 'Strategic customer tier', isActive: true }),
    ]);

    const [hardware, services, subscriptionCategory] = await Promise.all([
        upsertByName(Category, 'Hardware', { description: 'Physical devices and equipment', maxAllowedDiscountPercent: 15, isActive: true }),
        upsertByName(Category, 'Services', { description: 'Implementation and professional services', maxAllowedDiscountPercent: 10, isActive: true }),
        upsertByName(Category, 'Subscription', { description: 'Recurring software and support plans', maxAllowedDiscountPercent: 12, isActive: true }),
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

    const productDefs = [
        { name: 'Laptop', categoryId: hardware._id, productType: 'Hardware', billingType: PRODUCT_BILLING_TYPES.ONE_TIME, basePrice: 1200, costPrice: 850, taxPercentage: 8, unit: 'each', description: 'Business laptop', isStockManaged: true },
        { name: 'Setup Service', categoryId: services._id, productType: 'Service', billingType: PRODUCT_BILLING_TYPES.ONE_TIME, basePrice: 500, costPrice: 250, taxPercentage: 8, unit: 'project', description: 'Deployment and setup', isStockManaged: false },
        { name: 'Extended Warranty', categoryId: services._id, productType: 'Service', billingType: PRODUCT_BILLING_TYPES.ONE_TIME, basePrice: 199, costPrice: 80, taxPercentage: 8, unit: 'each', description: 'Additional warranty coverage', isStockManaged: false },
        { name: 'Support Plan', categoryId: subscriptionCategory._id, productType: 'Subscription', billingType: PRODUCT_BILLING_TYPES.RECURRING, recurringPlanReference: 'support-plan-monthly', basePrice: 99, costPrice: 35, taxPercentage: 8, unit: 'month', description: 'Monthly support plan', isStockManaged: false },
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

    for (const tier of [bronze, silver, gold]) {
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
        { name: 'Hardware category ceiling', customerTierId: null, categoryId: hardware._id, maxDiscountPercent: 15 },
        { name: 'Services category ceiling', customerTierId: null, categoryId: services._id, maxDiscountPercent: 10 },
        { name: 'Subscription category ceiling', customerTierId: null, categoryId: subscriptionCategory._id, maxDiscountPercent: 12 },
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

    const laptopVariant = await ProductVariant.findOneAndUpdate(
        { productId: products.Laptop._id, sku: 'LAPTOP-001' },
        { $set: { productId: products.Laptop._id, sku: 'LAPTOP-001', name: 'Standard', extraPrice: 0, isActive: true } },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    const mainWarehouse = await upsertByName(Warehouse, 'Main Warehouse', { shipping_cost_weight: 1.0, active: true });
    const eastDepot = await upsertByName(Warehouse, 'East Depot', { shipping_cost_weight: 1.8, active: true });

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

    const supportPlanMonthly = await upsertByName(SubscriptionPlan, 'Support Plan Monthly', {
        cycle: 'monthly',
        proration_policy: 'daily_calendar',
        cancellation_policy: 'credit_remaining',
        active: true,
    });

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
