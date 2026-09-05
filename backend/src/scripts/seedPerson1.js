import mongoose from 'mongoose';

import '../core/config/env.js';
import connectDB from '../core/db/index.js';
import {getMongoUri} from '../core/config/database.js';
import {
    APPROVAL_STATUSES,
    CUSTOMER_STATUSES,
    PRODUCT_BILLING_TYPES,
    QUOTATION_STATUSES,
    USER_ROLES,
    USER_STATUSES
} from '../core/constants.js';
import {hashPassword} from '../modules/auth/auth.service.js';
import {ApprovalRule} from '../modules/approvals/approvalRule.model.js';
import {Category} from '../modules/categories/category.model.js';
import {CustomerTier} from '../modules/customerTiers/customerTier.model.js';
import {Customer} from '../modules/customers/customer.model.js';
import {DiscountRule} from '../modules/discountRules/discountRule.model.js';
import {PriceList} from '../modules/priceLists/priceList.model.js';
import {Product} from '../modules/products/product.model.js';
import {QuotationLine} from '../modules/quotationLines/quotationLine.model.js';
import {Quotation} from '../modules/quotations/quotation.model.js';
import {calculateLineAmounts, calculateQuotationTotals} from '../modules/quotations/quotations.service.js';
import {UpsellRule} from '../modules/recommendations/upsellRule.model.js';
import {User} from '../modules/users/user.model.js';

const passwordHash = hashPassword('Password123!');

const upsertByName = (Model, name, payload) => Model.findOneAndUpdate(
    {name},
    {$set: {name, ...payload}},
    {new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true}
);

const upsertUser = (email, payload) => User.findOneAndUpdate(
    {email},
    {$set: {email, passwordHash, status: USER_STATUSES.ACTIVE, ...payload}},
    {new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true}
);

const buildLine = ({quotation, product, quantity, discountPercent, allowedDiscountPercent}) => {
    const amounts = calculateLineAmounts({
        quantity,
        unitPrice: product.basePrice,
        costPrice: product.costPrice,
        discountPercent,
        taxPercentage: product.taxPercentage,
        allowedDiscountPercent
    });

    return {
        quotationId: quotation._id,
        productId: product._id,
        variantId: null,
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
        description: product.name
    };
};

const seed = async () => {
    getMongoUri();

    await connectDB();

    const [bronze, silver, gold] = await Promise.all([
        upsertByName(CustomerTier, 'Bronze', {defaultMaxDiscountPercent: 5, description: 'Entry customer tier', isActive: true}),
        upsertByName(CustomerTier, 'Silver', {defaultMaxDiscountPercent: 10, description: 'Growth customer tier', isActive: true}),
        upsertByName(CustomerTier, 'Gold', {defaultMaxDiscountPercent: 20, description: 'Strategic customer tier', isActive: true})
    ]);

    const [hardware, services, subscription] = await Promise.all([
        upsertByName(Category, 'Hardware', {description: 'Physical devices and equipment', maxAllowedDiscountPercent: 15, isActive: true}),
        upsertByName(Category, 'Services', {description: 'Implementation and professional services', maxAllowedDiscountPercent: 10, isActive: true}),
        upsertByName(Category, 'Subscription', {description: 'Recurring software and support plans', maxAllowedDiscountPercent: 12, isActive: true})
    ]);

    const [salesRep, salesManager, finance, admin] = await Promise.all([
        upsertUser('sales.rep@dealflow360.test', {fullName: 'Sam Sales Rep', role: USER_ROLES.SALES_REP}),
        upsertUser('sales.manager@dealflow360.test', {fullName: 'Maya Sales Manager', role: USER_ROLES.SALES_MANAGER}),
        upsertUser('finance@dealflow360.test', {fullName: 'Finn Finance', role: USER_ROLES.FINANCE}),
        upsertUser('admin@dealflow360.test', {fullName: 'Ada Admin', role: USER_ROLES.ADMIN})
    ]);

    const customer = await Customer.findOneAndUpdate(
        {email: 'customer@acme.test', company: 'Acme Corp'},
        {
            $set: {
                name: 'Acme Buyer',
                email: 'customer@acme.test',
                company: 'Acme Corp',
                tierId: gold._id,
                status: CUSTOMER_STATUSES.ACTIVE,
                phone: '+1-555-0100',
                contactPerson: 'Acme Buyer',
                address: {
                    street: '100 Market Street',
                    city: 'San Francisco',
                    state: 'CA',
                    postalCode: '94105',
                    country: 'USA'
                }
            }
        },
        {new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true}
    );

    await upsertUser('customer@acme.test', {
        fullName: 'Acme Buyer',
        role: USER_ROLES.CUSTOMER,
        customerId: customer._id
    });

    const products = {};
    for (const payload of [
        {
            name: 'Laptop',
            categoryId: hardware._id,
            productType: 'Hardware',
            billingType: PRODUCT_BILLING_TYPES.ONE_TIME,
            basePrice: 1200,
            costPrice: 850,
            taxPercentage: 8,
            unit: 'each',
            description: 'Business laptop'
        },
        {
            name: 'Setup Service',
            categoryId: services._id,
            productType: 'Service',
            billingType: PRODUCT_BILLING_TYPES.ONE_TIME,
            basePrice: 500,
            costPrice: 250,
            taxPercentage: 8,
            unit: 'project',
            description: 'Deployment and setup'
        },
        {
            name: 'Extended Warranty',
            categoryId: services._id,
            productType: 'Service',
            billingType: PRODUCT_BILLING_TYPES.ONE_TIME,
            basePrice: 199,
            costPrice: 80,
            taxPercentage: 8,
            unit: 'each',
            description: 'Additional warranty coverage'
        },
        {
            name: 'Support Plan',
            categoryId: subscription._id,
            productType: 'Subscription',
            billingType: PRODUCT_BILLING_TYPES.RECURRING,
            recurringPlanReference: 'support-plan-monthly',
            basePrice: 99,
            costPrice: 35,
            taxPercentage: 8,
            unit: 'month',
            description: 'Monthly support plan'
        }
    ]) {
        products[payload.name] = await Product.findOneAndUpdate(
            {name: payload.name, categoryId: payload.categoryId},
            {$set: {...payload, isActive: true}},
            {new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true}
        );
    }

    for (const tier of [bronze, silver, gold]) {
        await PriceList.findOneAndUpdate(
            {name: `${tier.name} USD Price List`},
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
                        validTo: null
                    }))
                }
            },
            {new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true}
        );
    }

    for (const rule of [
        {name: 'Gold tier ceiling', customerTierId: gold._id, categoryId: null, maxDiscountPercent: 20},
        {name: 'Hardware category ceiling', customerTierId: null, categoryId: hardware._id, maxDiscountPercent: 15},
        {name: 'Services category ceiling', customerTierId: null, categoryId: services._id, maxDiscountPercent: 10},
        {name: 'Subscription category ceiling', customerTierId: null, categoryId: subscription._id, maxDiscountPercent: 12}
    ]) {
        await DiscountRule.findOneAndUpdate(
            {name: rule.name},
            {$set: {...rule, isActive: true}},
            {new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true}
        );
    }

    for (const rule of [
        {name: 'Within Limit', minRiskScore: 0, maxRiskScore: 0, severity: 'NONE', requiredApprovalRoles: [], priority: 1},
        {name: 'Medium Risk Manager Approval', minRiskScore: 0.01, maxRiskScore: 5.99, severity: 'MEDIUM', requiredApprovalRoles: [USER_ROLES.SALES_MANAGER], priority: 10},
        {name: 'High Risk Manager Finance Approval', minRiskScore: 6, maxRiskScore: 100, severity: 'HIGH', requiredApprovalRoles: [USER_ROLES.SALES_MANAGER, USER_ROLES.FINANCE], priority: 20}
    ]) {
        await ApprovalRule.findOneAndUpdate(
            {name: rule.name},
            {$set: {...rule, minExcessDiscountExposure: 0, maxExcessDiscountExposure: Number.MAX_SAFE_INTEGER, isActive: true}},
            {new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true}
        );
    }

    await UpsellRule.findOneAndUpdate(
        {sourceProductId: products.Laptop._id},
        {
            $set: {
                sourceProductId: products.Laptop._id,
                suggestedProductIds: [products['Extended Warranty']._id, products['Support Plan']._id],
                coPurchaseScore: 80,
                promotionBoost: 10,
                minimumRequiredMarginPercent: 20,
                isActive: true
            }
        },
        {new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true}
    );

    const quotation = await Quotation.findOneAndUpdate(
        {quoteNumber: 'Q-SEED-GOLD-DISCOUNT-SCENARIO'},
        {
            $set: {
                quoteNumber: 'Q-SEED-GOLD-DISCOUNT-SCENARIO',
                customerId: customer._id,
                salesRepId: salesRep._id,
                ownerId: salesRep._id,
                status: QUOTATION_STATUSES.DRAFT,
                currencyCode: 'USD',
                approvalStatus: APPROVAL_STATUSES.NOT_REQUIRED,
                currentVersion: 1
            }
        },
        {new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true}
    );

    await QuotationLine.deleteMany({quotationId: quotation._id});
    await QuotationLine.insertMany([
        buildLine({quotation, product: products.Laptop, quantity: 1, discountPercent: 12, allowedDiscountPercent: 15}),
        buildLine({quotation, product: products['Setup Service'], quantity: 1, discountPercent: 18, allowedDiscountPercent: 10})
    ]);

    const totals = await calculateQuotationTotals(quotation._id);
    await Quotation.findByIdAndUpdate(quotation._id, {$set: totals}, {runValidators: true});

    console.log('Person 1 seed data complete.');
    console.log('Password for all seed users: Password123!');

    await mongoose.disconnect();
};

seed().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
});
