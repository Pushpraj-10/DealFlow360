import { SubscriptionPlan } from './subscription-plan.model.js';
import { Subscription } from './subscription.model.js';
import { SubscriptionChange } from './subscription-change.model.js';

const findPlans = (filter = {}) => SubscriptionPlan.find(filter).sort({ name: 1 });

const findPlanById = (id) => SubscriptionPlan.findById(id);

const createPlan = (data) => SubscriptionPlan.create(data);

const updatePlanById = (id, data) =>
    SubscriptionPlan.findByIdAndUpdate(id, data, { new: true, runValidators: true });

const populateSubscriptionRefs = (query) =>
    query
        .populate('plan_id')
        .populate('customer_id', 'name company email')
        .populate('order_id', 'orderNumber status');

const findSubscriptions = (filter = {}) => populateSubscriptionRefs(Subscription.find(filter)).sort({ created_at: -1 });

const findSubscriptionsByQuoteLineIds = (quoteLineIds) =>
    populateSubscriptionRefs(Subscription.find({ originating_quote_line_id: { $in: quoteLineIds } }));

const findSubscriptionByQuoteLineId = (quoteLineId) =>
    populateSubscriptionRefs(Subscription.findOne({ originating_quote_line_id: quoteLineId }));

const findSubscriptionById = (id, session) => {
    const query = populateSubscriptionRefs(Subscription.findById(id));
    return session ? query.session(session) : query;
};

const createSubscription = (data) => Subscription.create(data);

const updateSubscription = (id, data, session) =>
    Subscription.findByIdAndUpdate(id, data, { new: true, runValidators: true, session });

const createSubscriptionChange = async (data, session) => {
    const [change] = await SubscriptionChange.create([data], { session });
    return change;
};

const findChangesBySubscriptionId = (subscriptionId) =>
    SubscriptionChange.find({ subscription_id: subscriptionId }).sort({ created_at: -1 });

export {
    findPlans,
    findPlanById,
    createPlan,
    updatePlanById,
    findSubscriptions,
    findSubscriptionsByQuoteLineIds,
    findSubscriptionByQuoteLineId,
    findSubscriptionById,
    createSubscription,
    updateSubscription,
    createSubscriptionChange,
    findChangesBySubscriptionId,
};
