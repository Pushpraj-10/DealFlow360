import { ApiError } from '../../core/utils/apiError.js';
import { ErrorCodes } from '../../core/utils/errorCodes.js';
import { computeProratedDeltaCents } from '../../core/utils/money.js';
import { logAction } from '../_shared/audit-log/audit-log.service.js';
import { CreditNote } from '../invoicing/credit-note.model.js';
import { Invoice } from '../invoicing/invoice.model.js';
import { InvoiceLine } from '../invoicing/invoice-line.model.js';
import * as subscriptionRepository from './subscription.repository.js';

const CYCLE_DAYS = { weekly: 7, monthly: 30, quarterly: 91, yearly: 365 };

const addCycle = (date, cycle) => {
    const start = new Date(date);
    const next = new Date(start);
    switch (cycle) {
        case 'weekly':
            next.setUTCDate(next.getUTCDate() + 7);
            break;
        case 'monthly':
            next.setUTCMonth(next.getUTCMonth() + 1);
            break;
        case 'quarterly':
            next.setUTCMonth(next.getUTCMonth() + 3);
            break;
        case 'yearly':
            next.setUTCFullYear(next.getUTCFullYear() + 1);
            break;
        default:
            next.setUTCDate(next.getUTCDate() + CYCLE_DAYS.monthly);
    }
    return next;
};

const listPlans = (filter = {}) => subscriptionRepository.findPlans(filter);

const createPlan = async ({ name, cycle, proration_policy, cancellation_policy, active }) => {
    if (!name || !cycle) {
        throw new ApiError(400, 'name and cycle are required', [], '', ErrorCodes.VALIDATION_ERROR);
    }
    return subscriptionRepository.createPlan({ name, cycle, proration_policy, cancellation_policy, active });
};

const listSubscriptions = ({ customer_id, status } = {}) => {
    const filter = {};
    if (customer_id) filter.customer_id = customer_id;
    if (status) filter.status = status;
    return subscriptionRepository.findSubscriptions(filter);
};

const listSubscriptionsByQuoteLineIds = (quoteLineIds) => {
    if (!quoteLineIds?.length) return [];
    return subscriptionRepository.findSubscriptionsByQuoteLineIds(quoteLineIds);
};

const getSubscriptionOrThrow = async (id) => {
    const subscription = await subscriptionRepository.findSubscriptionById(id);
    if (!subscription) {
        throw new ApiError(404, 'Subscription not found', [], '', ErrorCodes.NOT_FOUND);
    }
    return subscription;
};

const createSubscription = async (data, actorId) => {
    const { customer_id, originating_quote_line_id, plan_id, qty, recurring_unit_price_cents, start_date } = data;

    if (!customer_id || !originating_quote_line_id || !plan_id || !recurring_unit_price_cents) {
        throw new ApiError(
            400,
            'customer_id, originating_quote_line_id, plan_id and recurring_unit_price_cents are required',
            [],
            '',
            ErrorCodes.VALIDATION_ERROR
        );
    }

    const plan = await subscriptionRepository.findPlanById(plan_id);
    if (!plan) {
        throw new ApiError(404, 'Subscription plan not found', [], '', ErrorCodes.NOT_FOUND);
    }

    const start = start_date ? new Date(start_date) : new Date();
    const periodEnd = addCycle(start, plan.cycle);

    const subscription = await subscriptionRepository.createSubscription({
        customer_id,
        originating_quote_line_id,
        plan_id,
        qty: qty || 1,
        recurring_unit_price_cents,
        start_date: start,
        current_period_start: start,
        current_period_end: periodEnd,
        next_bill_date: periodEnd,
        status: 'ACTIVE',
    });

    await logAction({
        actorId,
        action: 'SUBSCRIPTION_CREATED',
        entityType: 'Subscription',
        entityId: subscription._id,
    });

    return subscription;
};

/**
 * PRD section 8.8 - subscription proration v1. Pure calculation, no writes;
 * shared by the dry-run endpoint and the actual modify/cancel actions so
 * the numbers are guaranteed identical.
 */
const calculateProration = (subscription, { newQty, newUnitPriceCents }, effectiveAt = new Date()) => {
    const newQtyResolved = newQty ?? subscription.qty;
    const newUnitPriceCentsResolved = newUnitPriceCents ?? subscription.recurring_unit_price_cents;

    const proratedDeltaCents = computeProratedDeltaCents({
        oldUnitPriceCents: subscription.recurring_unit_price_cents,
        oldQty: subscription.qty,
        newUnitPriceCents: newUnitPriceCentsResolved,
        newQty: newQtyResolved,
        periodStart: subscription.current_period_start,
        periodEnd: subscription.current_period_end,
        effectiveAt,
    });

    return { newQtyResolved, newUnitPriceCentsResolved, proratedDeltaCents };
};

const dryRunProration = async ({ subscriptionId, newQty, newUnitPriceCents }) => {
    const subscription = await getSubscriptionOrThrow(subscriptionId);
    const { proratedDeltaCents } = calculateProration(subscription, {
        newQty: newQty !== undefined ? Number(newQty) : undefined,
        newUnitPriceCents: newUnitPriceCents !== undefined ? Number(newUnitPriceCents) : undefined,
    });
    return { subscriptionId, proratedDeltaCents };
};

const modifySubscription = async (subscriptionId, { newQty, newUnitPriceCents, newPlanId, reason }, actorId) => {
    if (newQty === undefined && newUnitPriceCents === undefined && newPlanId === undefined) {
        throw new ApiError(400, 'Nothing to change', [], '', ErrorCodes.VALIDATION_ERROR);
    }

    const subscription = await getSubscriptionOrThrow(subscriptionId);
    if (subscription.status !== 'ACTIVE') {
        throw new ApiError(409, 'Only an active subscription can be modified', [], '', ErrorCodes.VALIDATION_ERROR);
    }

    const { newQtyResolved, newUnitPriceCentsResolved, proratedDeltaCents } = calculateProration(subscription, {
        newQty,
        newUnitPriceCents,
    });

    let creditNote = null;
    let invoice = null;

    if (proratedDeltaCents > 0) {
        invoice = await Invoice.create({
            invoice_no: `INV-SUB-${Date.now()}`,
            customer_id: subscription.customer_id,
            subscription_id: subscription._id,
            status: 'UNPAID',
            due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            subtotal_cents: proratedDeltaCents,
            tax_cents: 0,
            total_cents: proratedDeltaCents,
        });
        await InvoiceLine.create({
            invoice_id: invoice._id,
            source_type: 'subscription',
            source_id: subscription._id,
            description: 'Mid-cycle subscription upgrade proration',
            qty: 1,
            unit_price_cents: proratedDeltaCents,
            amount_cents: proratedDeltaCents,
        });
    } else if (proratedDeltaCents < 0) {
        creditNote = await CreditNote.create({
            customer_id: subscription.customer_id,
            amount_cents: Math.abs(proratedDeltaCents),
            reason: reason || 'Mid-cycle subscription downgrade proration',
            status: 'ISSUED',
        });
    }

    const change = await subscriptionRepository.createSubscriptionChange({
        subscription_id: subscription._id,
        old_qty: subscription.qty,
        new_qty: newQtyResolved,
        old_plan_id: subscription.plan_id?._id || subscription.plan_id,
        new_plan_id: newPlanId || subscription.plan_id?._id || subscription.plan_id,
        old_unit_price_cents: subscription.recurring_unit_price_cents,
        new_unit_price_cents: newUnitPriceCentsResolved,
        prorated_delta_cents: proratedDeltaCents,
        credit_note_id: creditNote?._id || null,
        reason: reason || '',
    });

    if (creditNote) {
        creditNote.subscription_change_id = change._id;
        await creditNote.save();
    }

    const updated = await subscriptionRepository.updateSubscription(subscriptionId, {
        qty: newQtyResolved,
        recurring_unit_price_cents: newUnitPriceCentsResolved,
        ...(newPlanId ? { plan_id: newPlanId } : {}),
    });

    await logAction({
        actorId,
        action: 'SUBSCRIPTION_MODIFIED',
        entityType: 'Subscription',
        entityId: subscriptionId,
        reason,
        metadata: { proratedDeltaCents, changeId: change._id },
    });

    if (creditNote) {
        await logAction({
            actorId,
            action: 'CREDIT_NOTE_CREATED',
            entityType: 'CreditNote',
            entityId: creditNote._id,
            reason,
        });
    }

    return { subscription: updated, change, invoice, creditNote };
};

const cancelSubscription = async (subscriptionId, { reason }, actorId) => {
    const subscription = await getSubscriptionOrThrow(subscriptionId);
    if (subscription.status === 'CANCELLED') {
        throw new ApiError(409, 'Subscription is already cancelled', [], '', ErrorCodes.VALIDATION_ERROR);
    }

    const plan = subscription.plan_id;
    const policy = plan?.cancellation_policy || 'credit_remaining';

    let creditNote = null;
    let creditAmountCents = 0;

    if (policy === 'full_refund') {
        creditAmountCents = subscription.recurring_unit_price_cents * subscription.qty;
    } else if (policy === 'credit_remaining') {
        const delta = computeProratedDeltaCents({
            oldUnitPriceCents: subscription.recurring_unit_price_cents,
            oldQty: subscription.qty,
            newUnitPriceCents: 0,
            newQty: 0,
            periodStart: subscription.current_period_start,
            periodEnd: subscription.current_period_end,
            effectiveAt: new Date(),
        });
        creditAmountCents = Math.abs(delta);
    }

    if (creditAmountCents > 0) {
        creditNote = await CreditNote.create({
            customer_id: subscription.customer_id,
            amount_cents: creditAmountCents,
            reason: reason || `Subscription cancelled (${policy})`,
            status: 'ISSUED',
        });
    }

    const change = await subscriptionRepository.createSubscriptionChange({
        subscription_id: subscription._id,
        old_qty: subscription.qty,
        new_qty: 0,
        old_plan_id: subscription.plan_id?._id || subscription.plan_id,
        new_plan_id: subscription.plan_id?._id || subscription.plan_id,
        old_unit_price_cents: subscription.recurring_unit_price_cents,
        new_unit_price_cents: 0,
        prorated_delta_cents: -creditAmountCents,
        credit_note_id: creditNote?._id || null,
        reason: reason || `Cancellation (${policy})`,
    });

    if (creditNote) {
        creditNote.subscription_change_id = change._id;
        await creditNote.save();
    }

    const updated = await subscriptionRepository.updateSubscription(subscriptionId, { status: 'CANCELLED' });

    await logAction({
        actorId,
        action: 'SUBSCRIPTION_MODIFIED',
        entityType: 'Subscription',
        entityId: subscriptionId,
        reason: reason || `Cancelled per policy ${policy}`,
        metadata: { cancelled: true, policy, creditAmountCents },
    });

    if (creditNote) {
        await logAction({
            actorId,
            action: 'CREDIT_NOTE_CREATED',
            entityType: 'CreditNote',
            entityId: creditNote._id,
            reason,
        });
    }

    return { subscription: updated, change, creditNote };
};

export {
    listPlans,
    createPlan,
    listSubscriptions,
    listSubscriptionsByQuoteLineIds,
    getSubscriptionOrThrow,
    createSubscription,
    dryRunProration,
    modifySubscription,
    cancelSubscription,
};
