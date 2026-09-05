import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../core/db/index.js';

import { User } from '../modules/auth/user.model.js';
import { Customer } from '../modules/_shared/placeholders/customer.model.js';
import { Product } from '../modules/_shared/placeholders/product.model.js';
import { Quotation } from '../modules/_shared/placeholders/quotation.model.js';
import { QuotationLine } from '../modules/_shared/placeholders/quotation-line.model.js';
import { Warehouse } from '../modules/warehouses/warehouse.model.js';
import { Inventory } from '../modules/inventory/inventory.model.js';
import { SubscriptionPlan } from '../modules/subscriptions/subscription-plan.model.js';
import { Subscription } from '../modules/subscriptions/subscription.model.js';

dotenv.config({ path: './.env', quiet: true });

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const firstOfMonthUTC = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
};

const lastOfMonthUTC = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
};

const wipe = async () => {
    await Promise.all([
        User.deleteMany({}),
        Customer.deleteMany({}),
        Product.deleteMany({}),
        Quotation.deleteMany({}),
        QuotationLine.deleteMany({}),
        Warehouse.deleteMany({}),
        Inventory.deleteMany({}),
        SubscriptionPlan.deleteMany({}),
        Subscription.deleteMany({}),
    ]);
};

const run = async () => {
    await connectDB();
    console.log('Resetting DealFlow360 demo collections...');
    await wipe();

    const [rep, ops, admin] = await User.create([
        { name: 'Sam Rep', email: 'rep@dealflow360.dev', role: 'sales_rep', team: 'east' },
        { name: 'Olivia Ops', email: 'ops@dealflow360.dev', role: 'finance_ops', team: 'east' },
        { name: 'Alex Admin', email: 'admin@dealflow360.dev', role: 'admin', team: 'east' },
    ]);

    const [acme, beta] = await Customer.create([
        { name: 'Acme Corp', tier: 'Gold', currency_code: 'USD', email: 'buyer@acme.test' },
        { name: 'Beta Industries', tier: 'Silver', currency_code: 'USD', email: 'buyer@beta.test' },
    ]);

    const [laptop, dock, carePlan, onsiteSetup] = await Product.create([
        {
            sku: 'LAPTOP-PRO-14',
            name: 'Laptop Pro 14"',
            category: 'Hardware',
            base_price_cents: 120000,
            unit_cost_cents: 85000,
            is_stock_managed: true,
        },
        {
            sku: 'DOCK-STATION',
            name: 'Dock Station',
            category: 'Hardware',
            base_price_cents: 18000,
            unit_cost_cents: 12000,
            is_stock_managed: true,
        },
        {
            sku: 'CARE-PLAN-2YR',
            name: 'Care Plan (2yr)',
            category: 'Subscription',
            base_price_cents: 4600,
            unit_cost_cents: 1000,
            is_subscription: true,
            is_stock_managed: false,
        },
        {
            sku: 'ONSITE-SETUP',
            name: 'Onsite Setup Service',
            category: 'Services',
            base_price_cents: 25000,
            unit_cost_cents: 5000,
            is_stock_managed: false,
        },
    ]);

    const [mainWarehouse, eastDepot] = await Warehouse.create([
        { name: 'Main Warehouse', shipping_cost_weight: 1.0, active: true },
        { name: 'East Depot', shipping_cost_weight: 1.8, active: true },
    ]);

    // Deliberately sized so LAPTOP-PRO-14 qty 25 forces a Main + East split:
    // Main available = 40 - 18 = 22, East available = 10 - 6 = 4 (22+4=26 >= 25).
    await Inventory.create([
        { warehouse_id: mainWarehouse._id, sku: 'LAPTOP-PRO-14', on_hand: 40, reserved: 18 },
        { warehouse_id: eastDepot._id, sku: 'LAPTOP-PRO-14', on_hand: 10, reserved: 6 },
        { warehouse_id: mainWarehouse._id, sku: 'DOCK-STATION', on_hand: 65, reserved: 12 },
    ]);

    const carePlanMonthly = await SubscriptionPlan.create({
        name: 'Care Plan Monthly',
        cycle: 'monthly',
        proration_policy: 'daily_calendar',
        cancellation_policy: 'credit_remaining',
        active: true,
    });

    // Q-DEMO-1: forces the warehouse split (Scenario 1) and carries the
    // DOCK-STATION line used for the ship-50%/invoice-50% test (Scenario 3),
    // plus a recurring line for the proration test (Scenario 2).
    const quoteDemo1 = await Quotation.create({
        quote_no: 'Q-DEMO-1',
        customer_id: acme._id,
        owner_id: rep._id,
        status: 'confirmed',
        requested_delivery_date: daysAgo(-14),
        last_activity_at: new Date(),
    });
    const [laptopLine, dockLine, carePlanLine] = await QuotationLine.create([
        {
            quotation_id: quoteDemo1._id,
            product_id: laptop._id,
            qty: 25,
            unit_price_cents: laptop.base_price_cents,
            discount_pct: 8,
            tax_pct: 5,
            billing_type: 'one_time_stock',
        },
        {
            quotation_id: quoteDemo1._id,
            product_id: dock._id,
            qty: 10,
            unit_price_cents: dock.base_price_cents,
            discount_pct: 5,
            tax_pct: 5,
            billing_type: 'one_time_stock',
        },
        {
            quotation_id: quoteDemo1._id,
            product_id: carePlan._id,
            qty: 1,
            unit_price_cents: carePlan.base_price_cents,
            discount_pct: 0,
            tax_pct: 0,
            billing_type: 'recurring',
        },
    ]);

    // Q-DEMO-2: stalled-deal trigger (idle for 9 days, still open).
    await Quotation.create({
        quote_no: 'Q-DEMO-2',
        customer_id: beta._id,
        owner_id: rep._id,
        status: 'sent',
        requested_delivery_date: daysAgo(-3),
        last_activity_at: daysAgo(9),
    });

    // Rep discount history (5-8%) plus one 25% outlier -> discount-anomaly trigger.
    for (const discount of [5, 6, 8]) {
        const historicalQuote = await Quotation.create({
            quote_no: `Q-HIST-${discount}`,
            customer_id: beta._id,
            owner_id: rep._id,
            status: 'confirmed',
            last_activity_at: new Date(),
        });
        await QuotationLine.create({
            quotation_id: historicalQuote._id,
            product_id: dock._id,
            qty: 5,
            unit_price_cents: dock.base_price_cents,
            discount_pct: discount,
            tax_pct: 5,
            billing_type: 'one_time_stock',
        });
    }

    const quoteDemo3 = await Quotation.create({
        quote_no: 'Q-DEMO-3',
        customer_id: beta._id,
        owner_id: rep._id,
        status: 'pending_approval',
        last_activity_at: new Date(),
    });
    await QuotationLine.create({
        quotation_id: quoteDemo3._id,
        product_id: onsiteSetup._id,
        qty: 2,
        unit_price_cents: onsiteSetup.base_price_cents,
        discount_pct: 25,
        tax_pct: 0,
        billing_type: 'one_time_service',
    });

    // Active mid-period subscription for the proration test (Scenario 2).
    const subscription = await Subscription.create({
        customer_id: acme._id,
        originating_quote_line_id: carePlanLine._id,
        plan_id: carePlanMonthly._id,
        status: 'ACTIVE',
        start_date: firstOfMonthUTC(),
        next_bill_date: lastOfMonthUTC(),
        qty: 1,
        recurring_unit_price_cents: 4600,
        current_period_start: firstOfMonthUTC(),
        current_period_end: lastOfMonthUTC(),
    });

    console.log('\nSeed complete. Reference IDs:\n');
    console.table([
        { what: 'User (rep)', id: rep._id.toString(), email: rep.email },
        { what: 'User (ops)', id: ops._id.toString(), email: ops.email },
        { what: 'User (admin)', id: admin._id.toString(), email: admin.email },
        { what: 'Customer (Acme)', id: acme._id.toString() },
        { what: 'Customer (Beta)', id: beta._id.toString() },
        { what: 'Warehouse (Main)', id: mainWarehouse._id.toString() },
        { what: 'Warehouse (East)', id: eastDepot._id.toString() },
        { what: 'Quotation Q-DEMO-1', id: quoteDemo1._id.toString() },
        { what: '  - LAPTOP-PRO-14 line (qty 25)', id: laptopLine._id.toString() },
        { what: '  - DOCK-STATION line (qty 10)', id: dockLine._id.toString() },
        { what: '  - CARE-PLAN-2YR line (recurring)', id: carePlanLine._id.toString() },
        { what: 'Quotation Q-DEMO-2 (stalled)', id: 'see quote_no Q-DEMO-2' },
        { what: 'Quotation Q-DEMO-3 (anomaly)', id: quoteDemo3._id.toString() },
        { what: 'Subscription (Care Plan, active mid-period)', id: subscription._id.toString() },
        { what: 'SubscriptionPlan (Care Plan Monthly)', id: carePlanMonthly._id.toString() },
    ]);

    console.log('\nGet a dev token:');
    console.log(
        `  curl -X POST http://localhost:${process.env.PORT || 8001}/api/v1/auth/dev-token -H "Content-Type: application/json" -d '{"email":"ops@dealflow360.dev"}'`
    );
    console.log('\nThen, e.g.:');
    console.log(
        `  curl -X POST http://localhost:${process.env.PORT || 8001}/api/v1/fulfillments -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"quotation_id":"${quoteDemo1._id}"}'`
    );

    await mongoose.disconnect();
    process.exit(0);
};

run().catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
});
