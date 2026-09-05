import mongoose from 'mongoose';
import '../core/config/env.js';
import connectDB from '../core/db/index.js';
import { USER_ROLES, QUOTATION_STATUSES } from '../core/constants.js';
import { hashPassword } from '../modules/auth/auth.service.js';

import { User } from '../modules/users/user.model.js';
import { Customer } from '../modules/customers/customer.model.js';
import { CustomerTier } from '../modules/customerTiers/customerTier.model.js';
import { Category } from '../modules/categories/category.model.js';
import { Product } from '../modules/products/product.model.js';
import { ProductVariant } from '../modules/products/productVariant.model.js';
import { Quotation } from '../modules/quotations/quotation.model.js';
import { QuotationLine } from '../modules/quotationLines/quotationLine.model.js';
import { Warehouse } from '../modules/warehouses/warehouse.model.js';
import { Inventory } from '../modules/inventory/inventory.model.js';
import { SubscriptionPlan } from '../modules/subscriptions/subscription-plan.model.js';
import { Subscription } from '../modules/subscriptions/subscription.model.js';

const SEED_PASSWORD = 'Password123!';

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const firstOfMonthUTC = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
};

const lastOfMonthUTC = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
};

/**
 * dhan's QuotationLine schema requires every derived commercial field
 * up-front (no defaults) - this fills them all consistently from a small
 * set of inputs so seeded lines pass validation.
 */
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
    description,
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
        description,
    };
};

const wipe = async () => {
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
    ]);
};

const run = async () => {
    await connectDB();
    console.log('Resetting DealFlow360 demo collections...');
    await wipe();

    const passwordHash = hashPassword(SEED_PASSWORD);
    const [rep, ops, admin, manager, customer] = await User.create([
        { fullName: 'Sam Rep', email: 'rep@dealflow360.dev', passwordHash, role: USER_ROLES.SALES_REP, team: 'east' },
        { fullName: 'Olivia Ops', email: 'ops@dealflow360.dev', passwordHash, role: USER_ROLES.FINANCE, team: 'east' },
        { fullName: 'Alex Admin', email: 'admin@dealflow360.dev', passwordHash, role: USER_ROLES.ADMIN, team: 'east' },
        { fullName: 'Sarah Manager', email: 'manager@dealflow360.dev', passwordHash, role: USER_ROLES.SALES_MANAGER, team: 'east' },
        { fullName: 'Chris Customer', email: 'customer@dealflow360.dev', passwordHash, role: USER_ROLES.CUSTOMER, team: 'external' },
    ]);

    const [goldTier, silverTier] = await CustomerTier.create([
        { name: 'Gold', defaultMaxDiscountPercent: 15 },
        { name: 'Silver', defaultMaxDiscountPercent: 10 },
    ]);

    const [acme, beta] = await Customer.create([
        { name: 'Acme Corp', tierId: goldTier._id, email: 'buyer@acme.test', company: 'Acme Corp' },
        { name: 'Beta Industries', tierId: silverTier._id, email: 'buyer@beta.test', company: 'Beta Industries' },
    ]);

    const [hardwareCategory, subscriptionCategory, servicesCategory] = await Category.create([
        { name: 'Hardware', maxAllowedDiscountPercent: 15 },
        { name: 'Subscription', maxAllowedDiscountPercent: 15 },
        { name: 'Services', maxAllowedDiscountPercent: 10 },
    ]);

    const [laptop, dock, carePlan, onsiteSetup] = await Product.create([
        {
            name: 'Laptop Pro 14"',
            categoryId: hardwareCategory._id,
            productType: 'Hardware',
            billingType: 'ONE_TIME',
            basePrice: 1200,
            costPrice: 850,
            taxPercentage: 5,
            unit: 'unit',
            isStockManaged: true,
        },
        {
            name: 'Dock Station',
            categoryId: hardwareCategory._id,
            productType: 'Hardware',
            billingType: 'ONE_TIME',
            basePrice: 180,
            costPrice: 120,
            taxPercentage: 5,
            unit: 'unit',
            isStockManaged: true,
        },
        {
            name: 'Care Plan (2yr)',
            categoryId: subscriptionCategory._id,
            productType: 'Subscription',
            billingType: 'RECURRING',
            basePrice: 46,
            costPrice: 10,
            taxPercentage: 0,
            unit: 'plan',
            isStockManaged: false,
        },
        {
            name: 'Onsite Setup Service',
            categoryId: servicesCategory._id,
            productType: 'Service',
            billingType: 'ONE_TIME',
            basePrice: 250,
            costPrice: 50,
            taxPercentage: 0,
            unit: 'service',
            isStockManaged: false,
        },
    ]);

    const [laptopVariant, dockVariant] = await ProductVariant.create([
        { productId: laptop._id, sku: 'LAPTOP-PRO-14', name: 'Standard', extraPrice: 0 },
        { productId: dock._id, sku: 'DOCK-STATION', name: 'Standard', extraPrice: 0 },
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
        quoteNumber: 'Q-DEMO-1',
        customerId: acme._id,
        salesRepId: rep._id,
        ownerId: rep._id,
        status: QUOTATION_STATUSES.CONFIRMED,
        requestedDeliveryDate: daysAgo(-14),
    });
    const [laptopLine, dockLine, carePlanLine] = await QuotationLine.create([
        buildQuotationLine({
            quotationId: quoteDemo1._id,
            productId: laptop._id,
            variantId: laptopVariant._id,
            lineType: 'ONE_TIME',
            quantity: 25,
            unitPrice: laptop.basePrice,
            costPrice: laptop.costPrice,
            discountPercent: 8,
            taxPercentage: laptop.taxPercentage,
            allowedDiscountPercent: hardwareCategory.maxAllowedDiscountPercent,
            description: laptop.name,
        }),
        buildQuotationLine({
            quotationId: quoteDemo1._id,
            productId: dock._id,
            variantId: dockVariant._id,
            lineType: 'ONE_TIME',
            quantity: 10,
            unitPrice: dock.basePrice,
            costPrice: dock.costPrice,
            discountPercent: 5,
            taxPercentage: dock.taxPercentage,
            allowedDiscountPercent: hardwareCategory.maxAllowedDiscountPercent,
            description: dock.name,
        }),
        buildQuotationLine({
            quotationId: quoteDemo1._id,
            productId: carePlan._id,
            lineType: 'RECURRING',
            quantity: 1,
            unitPrice: carePlan.basePrice,
            costPrice: carePlan.costPrice,
            discountPercent: 0,
            taxPercentage: carePlan.taxPercentage,
            allowedDiscountPercent: subscriptionCategory.maxAllowedDiscountPercent,
            description: carePlan.name,
        }),
    ]);

    // Q-DEMO-2: stalled-deal trigger (idle for 9 days, still open) and
    // delivery-slippage trigger (requested in 3 days, well inside lead time).
    const quoteDemo2 = await Quotation.create({
        quoteNumber: 'Q-DEMO-2',
        customerId: beta._id,
        salesRepId: rep._id,
        ownerId: rep._id,
        status: QUOTATION_STATUSES.APPROVED,
        requestedDeliveryDate: daysAgo(-3),
    });
    // Force updatedAt into the past without Mongoose's auto-timestamp
    // overwriting it, so the stalled-deal rule (driven off updatedAt) fires.
    await Quotation.updateOne({ _id: quoteDemo2._id }, { $set: { updatedAt: daysAgo(9) } }, { timestamps: false });

    // Rep discount history (5-8%) plus one 25% outlier -> discount-anomaly trigger.
    for (const discount of [5, 6, 8]) {
        const historicalQuote = await Quotation.create({
            quoteNumber: `Q-HIST-${discount}`,
            customerId: beta._id,
            salesRepId: rep._id,
            ownerId: rep._id,
            status: QUOTATION_STATUSES.CONFIRMED,
        });
        await QuotationLine.create(
            buildQuotationLine({
                quotationId: historicalQuote._id,
                productId: dock._id,
                variantId: dockVariant._id,
                lineType: 'ONE_TIME',
                quantity: 5,
                unitPrice: dock.basePrice,
                costPrice: dock.costPrice,
                discountPercent: discount,
                taxPercentage: dock.taxPercentage,
                allowedDiscountPercent: hardwareCategory.maxAllowedDiscountPercent,
                description: dock.name,
            })
        );
    }

    const quoteDemo3 = await Quotation.create({
        quoteNumber: 'Q-DEMO-3',
        customerId: beta._id,
        salesRepId: rep._id,
        ownerId: rep._id,
        status: QUOTATION_STATUSES.PENDING_APPROVAL,
    });
    await QuotationLine.create(
        buildQuotationLine({
            quotationId: quoteDemo3._id,
            productId: onsiteSetup._id,
            lineType: 'ONE_TIME',
            quantity: 2,
            unitPrice: onsiteSetup.basePrice,
            costPrice: onsiteSetup.costPrice,
            discountPercent: 25,
            taxPercentage: onsiteSetup.taxPercentage,
            allowedDiscountPercent: servicesCategory.maxAllowedDiscountPercent,
            description: onsiteSetup.name,
        })
    );

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
        { what: 'User (ops/finance)', id: ops._id.toString(), email: ops.email },
        { what: 'User (admin)', id: admin._id.toString(), email: admin.email },
        { what: 'Customer (Acme, Gold)', id: acme._id.toString() },
        { what: 'Customer (Beta, Silver)', id: beta._id.toString() },
        { what: 'Warehouse (Main)', id: mainWarehouse._id.toString() },
        { what: 'Warehouse (East)', id: eastDepot._id.toString() },
        { what: 'Quotation Q-DEMO-1', id: quoteDemo1._id.toString() },
        { what: '  - LAPTOP-PRO-14 line (qty 25)', id: laptopLine._id.toString() },
        { what: '  - DOCK-STATION line (qty 10)', id: dockLine._id.toString() },
        { what: '  - CARE-PLAN-2YR line (recurring)', id: carePlanLine._id.toString() },
        { what: 'Quotation Q-DEMO-2 (stalled + slippage)', id: quoteDemo2._id.toString() },
        { what: 'Quotation Q-DEMO-3 (anomaly)', id: quoteDemo3._id.toString() },
        { what: 'Subscription (Care Plan, active mid-period)', id: subscription._id.toString() },
        { what: 'SubscriptionPlan (Care Plan Monthly)', id: carePlanMonthly._id.toString() },
    ]);

    console.log(`\nAll seed users share the password: ${SEED_PASSWORD}`);
    console.log('\nLog in:');
    console.log(
        `  curl -X POST http://localhost:${process.env.PORT || 8001}/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"ops@dealflow360.dev","password":"${SEED_PASSWORD}"}'`
    );
    console.log('\nThen, e.g.:');
    console.log(
        `  curl -X POST http://localhost:${process.env.PORT || 8001}/api/v1/fulfillments -H "Authorization: Bearer <accessToken>" -H "Content-Type: application/json" -d '{"quotation_id":"${quoteDemo1._id}"}'`
    );

    await mongoose.disconnect();
    process.exit(0);
};

run().catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
});
