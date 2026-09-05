/**
 * Side-effect-only import of every Mongoose model in the app. Mongoose only
 * registers a model with mongoose.model() when its file is actually
 * imported; a model that's referenced solely via a string `ref` (for
 * .populate()) throws MissingSchemaError at query time if nothing ever
 * imported it. Importing this module once at boot (see app.js) guarantees
 * every model is registered before any request is handled, regardless of
 * which feature module happens to run first.
 */
import '../../modules/auth/user.model.js';
import '../../modules/_shared/audit-log/audit-log.model.js';
import '../../modules/_shared/placeholders/customer.model.js';
import '../../modules/_shared/placeholders/product.model.js';
import '../../modules/_shared/placeholders/quotation.model.js';
import '../../modules/_shared/placeholders/quotation-line.model.js';
import '../../modules/warehouses/warehouse.model.js';
import '../../modules/inventory/inventory.model.js';
import '../../modules/fulfillment/fulfillment.model.js';
import '../../modules/fulfillment/fulfillment-allocation.model.js';
import '../../modules/fulfillment/backorder.model.js';
import '../../modules/subscriptions/subscription-plan.model.js';
import '../../modules/subscriptions/subscription.model.js';
import '../../modules/subscriptions/subscription-change.model.js';
import '../../modules/invoicing/invoice.model.js';
import '../../modules/invoicing/invoice-line.model.js';
import '../../modules/invoicing/payment.model.js';
import '../../modules/invoicing/credit-note.model.js';
import '../../modules/deal-health/deal-alert.model.js';
import '../../modules/deal-health/notification.model.js';
