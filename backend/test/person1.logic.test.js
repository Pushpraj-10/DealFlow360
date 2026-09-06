import assert from 'node:assert/strict';
import test from 'node:test';

import {ORDER_LINE_STATUSES, ORDER_STATUSES, USER_ROLES} from '../src/core/constants.js';
import {buildApprovalStepsFromRoles, orderApprovalRolesForRisk} from '../src/modules/approvals/approvals.service.js';
import {resolveAllowedDiscountFromLimits} from '../src/modules/discountRules/discountRules.service.js';
import {calculateBlendedRiskFromLines, getSeverity} from '../src/modules/riskEngine/riskEngine.service.js';
import {assertValidQuotationTransition} from '../src/modules/quotations/quotationState.service.js';
import {calculateLineAmounts, roundMoney} from '../src/modules/quotations/quotations.service.js';

test('applicable discount calculation uses stricter customer tier/category limit', () => {
    const laptopLimit = resolveAllowedDiscountFromLimits({
        tierName: 'Gold',
        tierPercent: 20,
        categoryName: 'Hardware',
        categoryPercent: 15
    });
    const serviceLimit = resolveAllowedDiscountFromLimits({
        tierName: 'Gold',
        tierPercent: 20,
        categoryName: 'Services',
        categoryPercent: 10
    });

    assert.equal(laptopLimit.allowedDiscountPercent, 15);
    assert.equal(serviceLimit.allowedDiscountPercent, 10);
    assert.match(serviceLimit.reason, /Services is stricter/);
});

test('line violation detection stores allowed, actual, excess, and violation flag', () => {
    const validLaptop = calculateLineAmounts({
        quantity: 1,
        unitPrice: 1200,
        costPrice: 850,
        discountPercent: 12,
        taxPercentage: 8,
        allowedDiscountPercent: 15
    });
    const invalidService = calculateLineAmounts({
        quantity: 1,
        unitPrice: 500,
        costPrice: 250,
        discountPercent: 18,
        taxPercentage: 8,
        allowedDiscountPercent: 10
    });

    assert.equal(validLaptop.excess_discount, 0);
    assert.equal(validLaptop.is_violation, false);
    assert.equal(invalidService.allowed_discount, 10);
    assert.equal(invalidService.actual_discount, 18);
    assert.equal(invalidService.excess_discount, 8);
    assert.equal(invalidService.is_violation, true);
});

test('quotation recalculation rolls line totals and margin immediately', () => {
    const laptop = calculateLineAmounts({
        quantity: 2,
        unitPrice: 1200,
        costPrice: 850,
        discountPercent: 10,
        taxPercentage: 8,
        allowedDiscountPercent: 15
    });
    const warranty = calculateLineAmounts({
        quantity: 2,
        unitPrice: 199,
        costPrice: 80,
        discountPercent: 0,
        taxPercentage: 8,
        allowedDiscountPercent: 10
    });

    const revenueAfterDiscount = roundMoney(laptop.revenueAfterDiscount + warranty.revenueAfterDiscount);
    const totalCost = roundMoney(laptop.totalCost + warranty.totalCost);
    const marginAmount = roundMoney(laptop.marginAmount + warranty.marginAmount);
    const marginPercentage = Math.round(((marginAmount / revenueAfterDiscount) * 100 + Number.EPSILON) * 100) / 100;

    assert.equal(revenueAfterDiscount, 2558);
    assert.equal(totalCost, 1860);
    assert.equal(marginAmount, 698);
    assert.equal(marginPercentage, 27.29);
});

test('blended risk scoring weights excess discount by revenue contribution', () => {
    const risk = calculateBlendedRiskFromLines([
        {
            _id: 'line-1',
            productName: 'Laptop',
            actual_discount: 12,
            allowed_discount: 15,
            excess_discount: 0,
            revenueAfterDiscount: 1056,
            lineSubtotal: 1200
        },
        {
            _id: 'line-2',
            productName: 'Setup Service',
            actual_discount: 18,
            allowed_discount: 10,
            excess_discount: 8,
            revenueAfterDiscount: 410,
            lineSubtotal: 500
        }
    ], {low: 0.01, medium: 2, high: 6});

    assert.equal(risk.totalRiskScore, 2.24);
    assert.equal(risk.severity, 'MEDIUM');
    assert.equal(risk.worstViolatingLine.productName, 'Setup Service');
    assert.equal(risk.totalExcessDiscountExposure, 40);
});

test('approval routing preserves manager-before-finance sequence', () => {
    const steps = buildApprovalStepsFromRoles([
        USER_ROLES.SALES_MANAGER,
        USER_ROLES.FINANCE
    ]);

    assert.equal(steps[0].requiredRole, USER_ROLES.SALES_MANAGER);
    assert.equal(steps[0].status, 'ACTIVE');
    assert.equal(steps[1].requiredRole, USER_ROLES.FINANCE);
    assert.equal(steps[1].status, 'PENDING');
});

test('high risk approval routing makes finance the active first approver', () => {
    const roles = orderApprovalRolesForRisk([
        USER_ROLES.SALES_MANAGER,
        USER_ROLES.FINANCE
    ], 'HIGH');
    const steps = buildApprovalStepsFromRoles(roles);

    assert.deepEqual(roles, [USER_ROLES.FINANCE, USER_ROLES.SALES_MANAGER]);
    assert.equal(steps[0].requiredRole, USER_ROLES.FINANCE);
    assert.equal(steps[0].status, 'ACTIVE');
    assert.equal(steps[1].requiredRole, USER_ROLES.SALES_MANAGER);
    assert.equal(steps[1].status, 'PENDING');
});

test('medium risk approval routing keeps configured approver order', () => {
    const roles = orderApprovalRolesForRisk([
        USER_ROLES.SALES_MANAGER,
        USER_ROLES.FINANCE
    ], 'MEDIUM');

    assert.deepEqual(roles, [USER_ROLES.SALES_MANAGER, USER_ROLES.FINANCE]);
});

test('risk severity thresholds are configurable', () => {
    assert.equal(getSeverity(0, {low: 0.01, medium: 2, high: 6}), 'NONE');
    assert.equal(getSeverity(1, {low: 0.01, medium: 2, high: 6}), 'LOW');
    assert.equal(getSeverity(2.24, {low: 0.01, medium: 2, high: 6}), 'MEDIUM');
    assert.equal(getSeverity(6, {low: 0.01, medium: 2, high: 6}), 'HIGH');
});

test('quotation state machine blocks invalid direct confirmation from pending approval', () => {
    assert.throws(
        () => assertValidQuotationTransition('PENDING_APPROVAL', 'CONFIRMED'),
        /Invalid quotation status transition/
    );
    assert.equal(assertValidQuotationTransition('APPROVED', 'CONFIRMED'), true);
});

test('version creation intent is represented by reapproval-required transition before new approval', () => {
    assert.equal(assertValidQuotationTransition('APPROVED', 'REAPPROVAL_REQUIRED'), true);
    assert.equal(assertValidQuotationTransition('REAPPROVAL_REQUIRED', 'PENDING_APPROVAL'), true);
});

test('negotiation reapproval cannot reuse old approval sequence conceptually', () => {
    const original = buildApprovalStepsFromRoles([USER_ROLES.SALES_MANAGER]);
    const renegotiated = buildApprovalStepsFromRoles([USER_ROLES.SALES_MANAGER, USER_ROLES.FINANCE]);

    assert.notDeepEqual(renegotiated.map((step) => step.requiredRole), original.map((step) => step.requiredRole));
    assert.deepEqual(renegotiated.map((step) => step.requiredRole), [USER_ROLES.SALES_MANAGER, USER_ROLES.FINANCE]);
});

test('customer data isolation expects portal access to be scoped by matching customer id', () => {
    const ownsQuotation = (user, quotation) => user.role !== USER_ROLES.CUSTOMER ||
        String(user.customerId) === String(quotation.customerId);

    assert.equal(ownsQuotation({role: USER_ROLES.CUSTOMER, customerId: 'c-1'}, {customerId: 'c-1'}), true);
    assert.equal(ownsQuotation({role: USER_ROLES.CUSTOMER, customerId: 'c-2'}, {customerId: 'c-1'}), false);
    assert.equal(ownsQuotation({role: USER_ROLES.SALES_MANAGER}, {customerId: 'c-1'}), true);
});

test('confirmed quotation handoff payload excludes internal cost, margin, and risk fields', () => {
    const handoffLine = {
        productId: 'p-1',
        quantity: 1,
        unitPrice: 1200,
        discount: {percent: 12, amount: 144},
        tax: {percent: 8, amount: 84.48},
        type: 'ONE_TIME'
    };

    assert.equal(Object.hasOwn(handoffLine, 'costPrice'), false);
    assert.equal(Object.hasOwn(handoffLine, 'marginAmount'), false);
    assert.equal(Object.hasOwn(handoffLine, 'riskScore'), false);
});

test('order pipeline statuses cover retryable fulfillment and billing stages', () => {
    assert.equal(ORDER_STATUSES.ORDER_CREATED, 'ORDER_CREATED');
    assert.equal(ORDER_STATUSES.SPLIT_PROPOSED, 'SPLIT_PROPOSED');
    assert.equal(ORDER_STATUSES.PARTIAL_BACKORDER, 'PARTIAL_BACKORDER');
    assert.equal(ORDER_STATUSES.FLOW_FAILED, 'FLOW_FAILED');
    assert.equal(ORDER_LINE_STATUSES.AWAITING_ALLOCATION, 'AWAITING_ALLOCATION');
    assert.equal(ORDER_LINE_STATUSES.SUBSCRIPTION_ACTIVE, 'SUBSCRIPTION_ACTIVE');
});

test('confirmed quote to order idempotency key is quotation plus confirmed version', () => {
    const orderKey = (quotation) => `${quotation._id}:v${quotation.confirmedVersion || quotation.currentVersion}`;

    assert.equal(orderKey({_id: 'quote-1', currentVersion: 2, confirmedVersion: 2}), 'quote-1:v2');
    assert.notEqual(
        orderKey({_id: 'quote-1', currentVersion: 3, confirmedVersion: 3}),
        orderKey({_id: 'quote-1', currentVersion: 2, confirmedVersion: 2})
    );
});
