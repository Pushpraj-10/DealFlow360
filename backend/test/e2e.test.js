/**
 * Automated version of PLAN.md Phase 5's three manual E2E scenarios, plus
 * an audit-trail check. Requires a reachable MongoDB replica set (same
 * requirement as running the app - see backend/.env's MONGODB_URI); this
 * suite wipes the target database's relevant collections on start, so
 * point MONGODB_URI at a disposable database, not a shared dev one.
 *
 * Run with: RUN_PERSON2_E2E=1 npm test  (from backend/)
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { app } from '../src/app.js';
import connectDB from '../src/core/db/index.js';
import { hashPassword } from '../src/modules/auth/auth.service.js';
import { USER_ROLES, QUOTATION_STATUSES } from '../src/core/constants.js';

import { User } from '../src/modules/users/user.model.js';
import { Customer } from '../src/modules/customers/customer.model.js';
import { CustomerTier } from '../src/modules/customerTiers/customerTier.model.js';
import { Category } from '../src/modules/categories/category.model.js';
import { Product } from '../src/modules/products/product.model.js';
import { ProductVariant } from '../src/modules/products/productVariant.model.js';
import { Quotation } from '../src/modules/quotations/quotation.model.js';
import { QuotationLine } from '../src/modules/quotationLines/quotationLine.model.js';
import { Warehouse } from '../src/modules/warehouses/warehouse.model.js';
import { Inventory } from '../src/modules/inventory/inventory.model.js';
import { SubscriptionPlan } from '../src/modules/subscriptions/subscription-plan.model.js';
import { Subscription } from '../src/modules/subscriptions/subscription.model.js';
import { InvoiceLine } from '../src/modules/invoicing/invoice-line.model.js';
import { AuditLog } from '../src/modules/auditLogs/auditLog.model.js';

let server;
let baseUrl;
let token;
const fixtures = {};
const shouldRun = process.env.RUN_PERSON2_E2E === '1' && Boolean(process.env.MONGODB_URI);
const e2eOptions = {
    skip: shouldRun ? false : 'Set RUN_PERSON2_E2E=1 and MONGODB_URI to run'
};

const callApi = async (path, { method = 'GET', body, auth = true } = {}) => {
    const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(auth ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
};

/** Mirrors seed.js's helper - dhan's QuotationLine schema requires every
 * derived commercial field up-front (no defaults). */
const buildQuotationLine = ({
    quotationId,
    productId,
    variantId = null,
    lineType,
    quantity,
    unitPrice,
    costPrice,
    discountPercent,
    taxPercentage,
    allowedDiscountPercent,
}) => {
    const lineSubtotal = quantity * unitPrice;
    const discountAmount = Math.round(lineSubtotal * (discountPercent / 100) * 100) / 100;
    const revenueAfterDiscount = lineSubtotal - discountAmount;
    const tax = Math.round(revenueAfterDiscount * (taxPercentage / 100) * 100) / 100;
    const lineTotal = revenueAfterDiscount + tax;
    const totalCost = quantity * costPrice;
    const marginAmount = revenueAfterDiscount - totalCost;
    const marginPercentage = revenueAfterDiscount > 0 ? (marginAmount / revenueAfterDiscount) * 100 : 0;
    const excessDiscount = Math.max(0, discountPercent - allowedDiscountPercent);

    return {
        quotationId,
        productId,
        variantId,
        lineType,
        quantity,
        unitPrice,
        costPrice,
        discountPercent,
        taxPercentage,
        tax,
        lineSubtotal,
        discountAmount,
        revenueAfterDiscount,
        totalCost,
        lineTotal,
        margin: marginPercentage,
        marginAmount,
        grossMarginAmount: marginAmount,
        marginPercentage,
        allowedDiscountPercent,
        allowed_discount: allowedDiscountPercent,
        actual_discount: discountPercent,
        excess_discount: excessDiscount,
        is_violation: excessDiscount > 0,
        violationAmount: Math.round(lineSubtotal * (excessDiscount / 100) * 100) / 100,
        description: 'test line',
    };
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const utcMidnight = (date) => {
    const d = new Date(date);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

before(async () => {
    if (!shouldRun) {
        return;
    }

    await connectDB();

    await Promise.all([
        User.deleteMany({}),
        Customer.deleteMany({}),
        CustomerTier.deleteMany({}),
        Category.deleteMany({}),
        Product.deleteMany({}),
        ProductVariant.deleteMany({}),
        Quotation.deleteMany({}),
        QuotationLine.deleteMany({}),
        Warehouse.deleteMany({}),
        Inventory.deleteMany({}),
        SubscriptionPlan.deleteMany({}),
        Subscription.deleteMany({}),
        AuditLog.deleteMany({}),
    ]);

    const passwordHash = hashPassword('Password123!');
    const user = await User.create({
        fullName: 'Test Ops',
        email: 'test-ops@dealflow360.dev',
        passwordHash,
        role: USER_ROLES.FINANCE,
    });

    const tier = await CustomerTier.create({ name: 'Test Tier', defaultMaxDiscountPercent: 15 });
    const customer = await Customer.create({
        name: 'Test Customer',
        tierId: tier._id,
        email: 'buyer@test.dev',
        company: 'Test Co',
    });
    const category = await Category.create({ name: 'Test Hardware', maxAllowedDiscountPercent: 15 });

    const laptop = await Product.create({
        name: 'Test Laptop',
        categoryId: category._id,
        productType: 'Hardware',
        billingType: 'ONE_TIME',
        basePrice: 1000,
        costPrice: 700,
        taxPercentage: 5,
        unit: 'unit',
        isStockManaged: true,
    });
    const laptopVariant = await ProductVariant.create({ productId: laptop._id, sku: 'TEST-LAPTOP', extraPrice: 0 });

    const dock = await Product.create({
        name: 'Test Dock',
        categoryId: category._id,
        productType: 'Hardware',
        billingType: 'ONE_TIME',
        basePrice: 100,
        costPrice: 60,
        taxPercentage: 5,
        unit: 'unit',
        isStockManaged: true,
    });
    const dockVariant = await ProductVariant.create({ productId: dock._id, sku: 'TEST-DOCK', extraPrice: 0 });

    const carePlan = await Product.create({
        name: 'Test Care Plan',
        categoryId: category._id,
        productType: 'Subscription',
        billingType: 'RECURRING',
        basePrice: 50,
        costPrice: 10,
        taxPercentage: 0,
        unit: 'plan',
        isStockManaged: false,
    });

    const mainWarehouse = await Warehouse.create({ name: 'Test Main', shipping_cost_weight: 1.0, active: true });
    const eastWarehouse = await Warehouse.create({ name: 'Test East', shipping_cost_weight: 1.8, active: true });

    // Main available = 40-18 = 22, East available = 10-6 = 4 -> forces a
    // split for a qty-25 requirement (Scenario 1).
    await Inventory.create([
        { warehouse_id: mainWarehouse._id, sku: 'TEST-LAPTOP', on_hand: 40, reserved: 18 },
        { warehouse_id: eastWarehouse._id, sku: 'TEST-LAPTOP', on_hand: 10, reserved: 6 },
        { warehouse_id: mainWarehouse._id, sku: 'TEST-DOCK', on_hand: 65, reserved: 12 },
    ]);

    const quotation = await Quotation.create({
        quoteNumber: 'Q-TEST-1',
        customerId: customer._id,
        salesRepId: user._id,
        ownerId: user._id,
        status: QUOTATION_STATUSES.CONFIRMED,
    });

    const laptopLine = await QuotationLine.create(
        buildQuotationLine({
            quotationId: quotation._id,
            productId: laptop._id,
            variantId: laptopVariant._id,
            lineType: 'ONE_TIME',
            quantity: 25,
            unitPrice: 1000,
            costPrice: 700,
            discountPercent: 8,
            taxPercentage: 5,
            allowedDiscountPercent: 15,
        })
    );
    const dockLine = await QuotationLine.create(
        buildQuotationLine({
            quotationId: quotation._id,
            productId: dock._id,
            variantId: dockVariant._id,
            lineType: 'ONE_TIME',
            quantity: 10,
            unitPrice: 100,
            costPrice: 60,
            discountPercent: 5,
            taxPercentage: 5,
            allowedDiscountPercent: 15,
        })
    );
    const carePlanLine = await QuotationLine.create(
        buildQuotationLine({
            quotationId: quotation._id,
            productId: carePlan._id,
            lineType: 'RECURRING',
            quantity: 1,
            unitPrice: 50,
            costPrice: 10,
            discountPercent: 0,
            taxPercentage: 0,
            allowedDiscountPercent: 15,
        })
    );

    const plan = await SubscriptionPlan.create({
        name: 'Test Plan Monthly',
        cycle: 'monthly',
        cancellation_policy: 'credit_remaining',
        active: true,
    });

    // Deterministic period: "now" sits exactly 10 days into a fixed 30-day
    // period, so remaining_fraction = 20/30 regardless of the calendar date
    // this suite happens to run on.
    const periodStart = utcMidnight(new Date(Date.now() - 10 * MS_PER_DAY));
    const periodEnd = new Date(periodStart.getTime() + 30 * MS_PER_DAY);

    const subscription = await Subscription.create({
        customer_id: customer._id,
        originating_quote_line_id: carePlanLine._id,
        plan_id: plan._id,
        status: 'ACTIVE',
        start_date: periodStart,
        next_bill_date: periodEnd,
        qty: 1,
        recurring_unit_price_cents: 5000,
        current_period_start: periodStart,
        current_period_end: periodEnd,
    });

    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://localhost:${server.address().port}/api/v1`;

    const login = await callApi('/auth/login', {
        method: 'POST',
        auth: false,
        body: { email: user.email, password: 'Password123!' },
    });
    assert.equal(login.status, 200, 'seed login must succeed');
    token = login.json.data.accessToken;

    Object.assign(fixtures, { user, customer, mainWarehouse, eastWarehouse, quotation, laptopLine, dockLine, subscription });
});

after(async () => {
    if (!shouldRun) {
        return;
    }

    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
});

test('Scenario 1 - warehouse split across Main + East for an oversubscribed SKU', e2eOptions, async () => {
    const created = await callApi('/fulfillments', {
        method: 'POST',
        body: { quotation_id: fixtures.quotation._id.toString() },
    });
    assert.equal(created.status, 201);
    fixtures.fulfillmentId = created.json.data._id;

    const suggested = await callApi(`/fulfillments/${fixtures.fulfillmentId}/suggest`, { method: 'POST' });
    assert.equal(suggested.status, 200);
    assert.equal(suggested.json.data.fulfillment.status, 'SPLIT_PROPOSED');
    assert.equal(suggested.json.data.backorders.length, 0, 'no backorder expected - 22+4=26 covers the 25 required');

    const laptopLineId = fixtures.laptopLine._id.toString();
    const laptopAllocations = suggested.json.data.allocations.filter((a) => a.quote_line_id._id === laptopLineId);
    assert.equal(laptopAllocations.length, 2, 'the 25-unit laptop line must be split across 2 warehouses');
    const totalAllocated = laptopAllocations.reduce((sum, a) => sum + a.allocated_qty, 0);
    assert.equal(totalAllocated, 25);
    const warehouseIds = new Set(laptopAllocations.map((a) => a.warehouse_id));
    assert.equal(warehouseIds.size, 2);

    const accepted = await callApi(`/fulfillments/${fixtures.fulfillmentId}/accept`, { method: 'POST' });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.json.data.fulfillment.status, 'RESERVED');

    const mainInventory = await Inventory.findOne({ warehouse_id: fixtures.mainWarehouse._id, sku: 'TEST-LAPTOP' });
    const eastInventory = await Inventory.findOne({ warehouse_id: fixtures.eastWarehouse._id, sku: 'TEST-LAPTOP' });
    assert.equal(mainInventory.on_hand - mainInventory.reserved, 0, 'Main should be fully reserved (22 available -> 22 taken)');
    assert.equal(eastInventory.reserved, 6 + (25 - 22), 'East should carry the 3-unit remainder on top of its prior reservation');

    fixtures.dockAllocationId = accepted.json.data.allocations.find(
        (a) => a.quote_line_id.toString() === fixtures.dockLine._id.toString() || a.allocated_qty === 10
    )?._id;
});

test('Scenario 3 - shipment-aware invoicing bills only the shipped quantity', e2eOptions, async () => {
    const detail = await callApi(`/fulfillments/${fixtures.fulfillmentId}`);
    const dockAllocation = detail.json.data.allocations.find((a) => a.allocated_qty === 10);
    assert.ok(dockAllocation, 'dock allocation (qty 10, single warehouse) must exist');

    const shipHalf = await callApi(`/fulfillments/${fixtures.fulfillmentId}/ship`, {
        method: 'POST',
        body: { allocation_id: dockAllocation._id, qty: 5 },
    });
    assert.equal(shipHalf.status, 200);

    const firstInvoice = await callApi('/invoices', {
        method: 'POST',
        body: { source_type: 'shipment', fulfillment_allocation_id: dockAllocation._id },
    });
    assert.equal(firstInvoice.status, 201);

    const prematureSecondInvoice = await callApi('/invoices', {
        method: 'POST',
        body: { source_type: 'shipment', fulfillment_allocation_id: dockAllocation._id },
    });
    assert.equal(prematureSecondInvoice.status, 400);
    assert.equal(prematureSecondInvoice.json.code, 'INVALID_SHIPMENT_QTY');

    const shipRemainder = await callApi(`/fulfillments/${fixtures.fulfillmentId}/ship`, {
        method: 'POST',
        body: { allocation_id: dockAllocation._id, qty: 5 },
    });
    assert.equal(shipRemainder.status, 200);

    const secondInvoice = await callApi('/invoices', {
        method: 'POST',
        body: { source_type: 'shipment', fulfillment_allocation_id: dockAllocation._id },
    });
    assert.equal(secondInvoice.status, 201);

    const invoiceLines = await InvoiceLine.find({ source_type: 'shipment', source_id: dockAllocation._id }).sort({
        created_at: 1,
    });
    assert.equal(invoiceLines.length, 2, 'exactly two invoice lines, one per shipment');
    assert.equal(invoiceLines[0].qty, 5);
    assert.equal(invoiceLines[1].qty, 5);
    assert.equal(
        invoiceLines.reduce((sum, l) => sum + l.qty, 0),
        10,
        'cumulative invoiced qty must equal cumulative shipped qty, never more'
    );
});

test('Scenario 2 - subscription proration: dry-run matches applied change; downgrade credits instead of charges', e2eOptions, async () => {
    const dryRun = await callApi(`/billing/prorate?subscriptionId=${fixtures.subscription._id}&newQty=2`);
    assert.equal(dryRun.status, 200);
    // remaining_fraction = 20/30 (see the deterministic period fixture above):
    // delta = (5000*2 - 5000*1) * 20/30 = 5000 * 0.6667 = round(3333.33) = 3333
    assert.equal(dryRun.json.data.proratedDeltaCents, 3333);

    const upgrade = await callApi(`/subscriptions/${fixtures.subscription._id}/modify`, {
        method: 'POST',
        body: { newQty: 2 },
    });
    assert.equal(upgrade.status, 200);
    assert.equal(upgrade.json.data.change.prorated_delta_cents, dryRun.json.data.proratedDeltaCents, 'dry-run and applied delta must match exactly');
    assert.ok(upgrade.json.data.invoice, 'a positive delta must create an invoice');
    assert.equal(upgrade.json.data.invoice.total_cents, 3333);
    assert.equal(upgrade.json.data.creditNote, null);

    const downgrade = await callApi(`/subscriptions/${fixtures.subscription._id}/modify`, {
        method: 'POST',
        body: { newQty: 1, reason: 'automated test downgrade' },
    });
    assert.equal(downgrade.status, 200);
    assert.ok(downgrade.json.data.creditNote, 'a negative delta must create a credit note, not an invoice');
    assert.equal(downgrade.json.data.invoice, null);
    assert.equal(downgrade.json.data.creditNote.amount_cents, Math.abs(downgrade.json.data.change.prorated_delta_cents));
});

test('Audit trail - every mutating fulfillment action is attributable to the real actor', e2eOptions, async () => {
    const logs = await AuditLog.find({ entityType: 'Fulfillment', entityId: fixtures.fulfillmentId }).sort({
        createdAt: 1,
    });
    const eventTypes = logs.map((l) => l.eventType);

    assert.ok(eventTypes.includes('FULFILLMENT_CREATED'));
    assert.ok(eventTypes.includes('FULFILLMENT_SUGGESTED'));
    assert.ok(eventTypes.includes('FULFILLMENT_ACCEPTED'));
    assert.ok(
        logs.every((l) => l.actorId?.toString() === fixtures.user._id.toString()),
        'every log entry must be attributed to the authenticated user, not left null'
    );
});
