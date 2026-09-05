import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';
import mongoose from 'mongoose';

process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'person1-e2e-secret';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

import {app} from '../src/app.js';
import {
    APPROVAL_STATUSES,
    CUSTOMER_STATUSES,
    PRODUCT_BILLING_TYPES,
    QUOTATION_STATUSES,
    USER_ROLES,
    USER_STATUSES
} from '../src/core/constants.js';
import {hashPassword} from '../src/modules/auth/auth.service.js';
import {ApprovalRule} from '../src/modules/approvals/approvalRule.model.js';
import {Category} from '../src/modules/categories/category.model.js';
import {CustomerTier} from '../src/modules/customerTiers/customerTier.model.js';
import {Customer} from '../src/modules/customers/customer.model.js';
import {DiscountRule} from '../src/modules/discountRules/discountRule.model.js';
import {PriceList} from '../src/modules/priceLists/priceList.model.js';
import {Product} from '../src/modules/products/product.model.js';
import {User} from '../src/modules/users/user.model.js';

const shouldRun = process.env.RUN_PERSON1_E2E === '1' && Boolean(process.env.TEST_MONGODB_URI);

let server;
let baseUrl;

const request = async (path, {token, method = 'GET', body} = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? {Authorization: `Bearer ${token}`} : {})
        },
        body: body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(`${response.status} ${payload.message || 'Request failed'}`);
    }

    return payload.data;
};

const login = async (email) => {
    const data = await request('/api/v1/auth/login', {
        method: 'POST',
        body: {email, password: 'Password123!'}
    });

    return data.accessToken;
};

const setupDemoData = async () => {
    await mongoose.connection.dropDatabase();

    const passwordHash = hashPassword('Password123!');
    const [salesRep, manager, customerUser] = await User.create([
        {
            fullName: 'E2E Sales Rep',
            email: 'e2e.sales@dealflow360.test',
            passwordHash,
            role: USER_ROLES.SALES_REP,
            status: USER_STATUSES.ACTIVE
        },
        {
            fullName: 'E2E Manager',
            email: 'e2e.manager@dealflow360.test',
            passwordHash,
            role: USER_ROLES.SALES_MANAGER,
            status: USER_STATUSES.ACTIVE
        },
        {
            fullName: 'E2E Customer',
            email: 'e2e.customer@dealflow360.test',
            passwordHash,
            role: USER_ROLES.CUSTOMER,
            status: USER_STATUSES.ACTIVE
        }
    ]);
    const gold = await CustomerTier.create({
        name: 'Gold',
        defaultMaxDiscountPercent: 20,
        isActive: true
    });
    const [hardware, services] = await Category.create([
        {name: 'Hardware', maxAllowedDiscountPercent: 15, isActive: true},
        {name: 'Services', maxAllowedDiscountPercent: 10, isActive: true}
    ]);
    const customer = await Customer.create({
        name: 'E2E Gold Buyer',
        email: 'e2e.customer@dealflow360.test',
        company: 'E2E Gold Co',
        tierId: gold._id,
        status: CUSTOMER_STATUSES.ACTIVE
    });

    customerUser.customerId = customer._id;
    await customerUser.save();

    const [laptop, setupService] = await Product.create([
        {
            name: 'Laptop',
            categoryId: hardware._id,
            productType: 'Hardware',
            billingType: PRODUCT_BILLING_TYPES.ONE_TIME,
            basePrice: 1200,
            costPrice: 850,
            taxPercentage: 8,
            unit: 'each',
            isActive: true
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
            isActive: true
        }
    ]);

    await PriceList.create({
        name: 'E2E Gold USD Price List',
        customerTierId: gold._id,
        currencyCode: 'USD',
        isActive: true,
        items: [
            {productId: laptop._id, unitPrice: 1200, basePriceOverride: 1200},
            {productId: setupService._id, unitPrice: 500, basePriceOverride: 500}
        ]
    });
    await DiscountRule.create([
        {name: 'E2E Gold ceiling', customerTierId: gold._id, categoryId: null, maxDiscountPercent: 20, isActive: true},
        {name: 'E2E Hardware ceiling', customerTierId: null, categoryId: hardware._id, maxDiscountPercent: 15, isActive: true},
        {name: 'E2E Services ceiling', customerTierId: null, categoryId: services._id, maxDiscountPercent: 10, isActive: true}
    ]);
    await ApprovalRule.create([
        {
            name: 'E2E Within Limit',
            minRiskScore: 0,
            maxRiskScore: 0,
            minExcessDiscountExposure: 0,
            maxExcessDiscountExposure: Number.MAX_SAFE_INTEGER,
            severity: 'NONE',
            requiredApprovalRoles: [],
            priority: 1,
            isActive: true
        },
        {
            name: 'E2E Manager Approval',
            minRiskScore: 0.01,
            maxRiskScore: 100,
            minExcessDiscountExposure: 0,
            maxExcessDiscountExposure: Number.MAX_SAFE_INTEGER,
            severity: 'MEDIUM',
            requiredApprovalRoles: [USER_ROLES.SALES_MANAGER],
            priority: 2,
            isActive: true
        }
    ]);

    return {salesRep, manager, customer, laptop, setupService};
};

if (shouldRun) {
    before(async () => {
        await mongoose.connect(process.env.TEST_MONGODB_URI);
        server = app.listen(0);
        await new Promise((resolve) => server.once('listening', resolve));
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    after(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
        await new Promise((resolve) => server.close(resolve));
    });
}

test('Person 1 end-to-end quotation approval negotiation handoff flow', {skip: shouldRun ? false : 'Set RUN_PERSON1_E2E=1 and TEST_MONGODB_URI to run'}, async () => {
    const {customer, laptop, setupService} = await setupDemoData();
    const salesToken = await login('e2e.sales@dealflow360.test');
    const managerToken = await login('e2e.manager@dealflow360.test');
    const customerToken = await login('e2e.customer@dealflow360.test');

    const draft = await request('/api/v1/quotations', {
        token: salesToken,
        method: 'POST',
        body: {customerId: customer._id, currencyCode: 'USD'}
    });
    const quotationId = draft.quotation._id;

    await request(`/api/v1/quotations/${quotationId}/lines`, {
        token: salesToken,
        method: 'POST',
        body: {productId: laptop._id, quantity: 1, discountPercent: 12}
    });
    const serviceLineAdd = await request(`/api/v1/quotations/${quotationId}/lines`, {
        token: salesToken,
        method: 'POST',
        body: {productId: setupService._id, quantity: 1, discountPercent: 18}
    });
    const serviceLine = serviceLineAdd.lines.find((line) => line.productId._id.toString() === setupService._id.toString());

    assert.equal(serviceLine.is_violation, true);
    assert.equal(serviceLine.excess_discount, 8);

    const firstRisk = await request(`/api/v1/quotations/${quotationId}/risk`, {token: salesToken});
    assert.equal(firstRisk.risk.severity, 'MEDIUM');

    const submitted = await request(`/api/v1/quotations/${quotationId}/submit`, {
        token: salesToken,
        method: 'POST',
        body: {}
    });
    assert.equal(submitted.approval.approvalRequired, true);
    assert.equal(submitted.quotation.status, QUOTATION_STATUSES.PENDING_APPROVAL);

    const firstApprovalRequestId = submitted.approval.approvalRequest._id;
    const approved = await request(`/api/v1/approvals/requests/${firstApprovalRequestId}/approve`, {
        token: managerToken,
        method: 'POST',
        body: {reason: 'Manager approved first version'}
    });
    assert.equal(approved.quotation.status, QUOTATION_STATUSES.APPROVED);

    const sent = await request(`/api/v1/quotations/${quotationId}/send`, {
        token: salesToken,
        method: 'POST',
        body: {reason: 'Sent to customer'}
    });
    assert.equal(sent.quotation.status, QUOTATION_STATUSES.SENT_TO_CUSTOMER);

    await request(`/api/v1/negotiations/quotations/${quotationId}/discount-proposals`, {
        token: customerToken,
        method: 'POST',
        body: {
            scope: 'LINE',
            quotationLineId: serviceLine._id,
            proposedDiscountPercent: 25,
            message: 'Please improve the setup service discount'
        }
    });

    const negotiations = await request(`/api/v1/negotiations/quotations/${quotationId}`, {token: salesToken});
    const submittedNegotiation = negotiations.negotiations.find((item) => item.status === 'SUBMITTED');
    assert.ok(submittedNegotiation);

    const accepted = await request(`/api/v1/negotiations/${submittedNegotiation._id}/accept`, {
        token: salesToken,
        method: 'POST',
        body: {reason: 'Accepted customer counter discount'}
    });
    assert.equal(accepted.quotation.currentVersion, 2);
    assert.equal(accepted.approvalDecision.approvalRequired, true);
    assert.equal(accepted.quotation.status, QUOTATION_STATUSES.PENDING_APPROVAL);

    const pendingApprovals = await request('/api/v1/approvals/pending', {token: managerToken});
    const reapprovalRequest = pendingApprovals.approvalRequests.find(
        (item) => item.quotationId._id.toString() === quotationId.toString()
    );
    assert.ok(reapprovalRequest);
    assert.equal(reapprovalRequest.quotationVersion, 2);

    const reapproved = await request(`/api/v1/approvals/requests/${reapprovalRequest._id}/approve`, {
        token: managerToken,
        method: 'POST',
        body: {reason: 'Manager approved negotiated version'}
    });
    assert.equal(reapproved.quotation.status, QUOTATION_STATUSES.APPROVED);

    const confirmed = await request(`/api/v1/quotations/${quotationId}/confirm`, {
        token: customerToken,
        method: 'POST',
        body: {reason: 'Customer confirmed final terms'}
    });
    assert.equal(confirmed.quotation.status, QUOTATION_STATUSES.CONFIRMED);
    assert.equal(confirmed.quotation.confirmedVersion, 2);

    const handoff = await request(`/api/v1/quotations/${quotationId}/order-snapshot`, {token: salesToken});
    assert.equal(handoff.snapshot.quotationVersion, 2);
    assert.equal(handoff.snapshot.customerId.toString(), customer._id.toString());
    assert.equal(handoff.snapshot.lines.length, 2);
    assert.equal(Object.hasOwn(handoff.snapshot.lines[0], 'costPrice'), false);
    assert.equal(Object.hasOwn(handoff.snapshot.lines[0], 'marginAmount'), false);
    assert.equal(Object.hasOwn(handoff.snapshot, 'riskScore'), false);
});
