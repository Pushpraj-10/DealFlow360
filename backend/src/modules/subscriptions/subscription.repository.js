import { SubscriptionPlan } from './subscription-plan.model.js';
import { Subscription } from './subscription.model.js';
import { SubscriptionChange } from './subscription-change.model.js';

const findPlans = (filter = {}) => SubscriptionPlan.find(filter).sort({ name: 1 });

const findPlanById = (id) => SubscriptionPlan.findById(id);

const createPlan = (data) => SubscriptionPlan.create(data);

const findSubscriptions = (filter = {}) => Subscription.find(filter).populate('plan_id').sort({ created_at: -1 });

const findSubscriptionsByQuoteLineIds = (quoteLineIds) =>
    Subscription.find({ originating_quote_line_id: { $in: quoteLineIds } }).populate('plan_id');

const findSubscriptionById = (id) => Subscription.findById(id).populate('plan_id');

const createSubscription = (data) => Subscription.create(data);

const updateSubscription = (id, data) =>
    Subscription.findByIdAndUpdate(id, data, { new: true, runValidators: true });

const createSubscriptionChange = (data) => SubscriptionChange.create(data);

const findChangesBySubscriptionId = (subscriptionId) =>
    SubscriptionChange.find({ subscription_id: subscriptionId }).sort({ created_at: -1 });

export {
    findPlans,
    findPlanById,
    createPlan,
    findSubscriptions,
    findSubscriptionsByQuoteLineIds,
    findSubscriptionById,
    createSubscription,
    updateSubscription,
    createSubscriptionChange,
    findChangesBySubscriptionId,
};
