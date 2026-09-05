DealFlow360
Detailed Product Requirements Document (PRD)
An Intelligent, Self-Governing Sales Operations Platform
Version 1.0  |  05 September 2026  |  Status: Implementation-ready
Source basis: DealFlow360 13-page problem statement + attached End-to-End Product Flow mockup
 
0. Document Control and Source Fidelity
Purpose  This PRD converts the supplied DealFlow360 problem statement and mockup workflow into an implementation-ready specification: product scope, business rules, screens, APIs, data model, states, acceptance criteria, testing, security, and build order.

Item	Value
Product	DealFlow360
Document	Detailed Product Requirements Document
Version	1.0
Status	Implementation-ready
Primary product surface	Internal sales operations web app + restricted customer portal
Primary workflow	Quotation → governance/approval → fulfillment → negotiation → billing → payment → reporting
Core principle	Business rules must be real application logic, not hardcoded demo behavior.

0.1 Requirement Origin Legend
Origin	Meaning
PS	Explicitly required by the supplied DealFlow360 problem statement.
Mockup	Shown or described in the attached End-to-End Product Flow mockup.
PRD	Implementation decision added to remove ambiguity or make the system buildable. These decisions should be configurable where possible.

0.2 Product Decisions Used to Remove Ambiguity
Decision	PRD v1
Currency	Sample/demo data uses USD as in the mockup. Data records still carry currency_code. Multi-currency behavior is P2/bonus.
Margin cost basis	A hidden/internal unit_cost is added to product or variant. The source requires live margin impact but does not define where cost comes from; without unit cost, margin cannot be computed.
Payments	P0 uses manual “Record Payment” with amount/reference/date. A real payment gateway is out of scope unless time remains.
Upsell engine	P0 uses deterministic co-purchase/promotion/margin rules; ML/LLM ranking is optional enhancement.
Inventory	The application is the inventory source of truth for the demo. No ERP/WMS integration is required.
Negotiation binding point	Customer requests are proposals. A Sales Rep accepts/edits a proposal before it changes the commercial quote version; the new version is then re-evaluated for approval.
Shipment-aware invoicing	Stock-managed goods are invoiced only for shipped quantity. Non-stock one-time services can be invoiced on confirmation/completion. Recurring lines invoice according to billing schedule.
Recurring timing	Recurring products are billed at the beginning of the period, matching the attached mockup note.
Risk formula	The problem defines required blended behavior but not an exact equation. This PRD provides a configurable v1 formula so engineers and testers have deterministic expected results.
Customer portal auth	Implement either magic-link/token access or email/password. P0 needs one secure option, not both.

0.3 Contents
•	1. Executive Summary
•	2. Vision, Goals, Non-goals and Success Metrics
•	3. Personas, Roles and Permissions
•	4. Scope and Priority
•	5. Information Architecture and Screen Inventory
•	6. End-to-End Journeys
•	7. Functional Requirements
•	8. Business Rules and Algorithms
•	9. State Machines
•	10. Data Model
•	11. API Contract
•	12. Frontend Routes and UI States
•	13. Validation and Edge Cases
•	14. Non-functional Requirements
•	15. Security and Access Control
•	16. Analytics, Audit and Observability
•	17. Seed Data
•	18. Acceptance Test Plan
•	19. Build Plan
•	20. Five-minute Demo Script
•	21. Risks and Mitigations
•	22. Definition of Done
•	Appendix A. Requirement Traceability
•	Appendix B. Glossary
1. Executive Summary
DealFlow360 is a B2B sales-operations platform that governs a deal from quotation creation through discount approval, warehouse fulfillment, customer negotiation, hybrid one-time/recurring billing, payment, and reporting. The differentiator is not a CRM database; it is the system’s ability to enforce configurable commercial rules and automatically move the deal to the correct next stage.
•	Pricing discipline: discount limits are determined by customer tier and product category, evaluated live per line, and summarized into a blended risk level.
•	Automated governance: the application creates and routes approval steps automatically; Sales Manager and Finance involvement depends on the configured risk level.
•	Inventory-aware selling: after approval, the application recommends a warehouse allocation based on availability and shipping cost, supports manual override, and preserves backorders.
•	Living quotation: customers negotiate inside a separate restricted portal; accepted commercial changes create a new quote version and can automatically re-open approval.
•	Hybrid billing: one quote/order can contain one-time goods/services and recurring subscriptions, with proration, cancellations/credits, invoice/payment history, and shipment-aware billing.
•	Operational intelligence: Deal Health identifies stalled deals, unusual discount behavior, and delivery slippage; reports expose sales and approval performance.
 
Figure 1. End-to-end DealFlow360 product flow.
2. Vision, Goals, Non-goals and Success Metrics
2.1 Product Vision
Enable a sales team to create commercially flexible B2B deals without losing pricing control, fulfillment realism, billing correctness, or auditability. The system should automate routine governance while keeping humans in control of exceptions and high-risk decisions.
2.2 Goals
•	Provide a complete quotation-to-cash workflow across internal and customer-facing experiences.
•	Apply customer-tier and category discount rules consistently and transparently.
•	Route quotes to the correct approval level automatically and preserve every approval action in an audit trail.
•	Use live warehouse availability to generate a fulfillment recommendation and backorder any remainder.
•	Support one-time and recurring lines in a single deal, including proration and credit-note behavior.
•	Allow customers to negotiate a live quotation without exposing internal configuration or other customers’ data.
•	Give managers actionable operational visibility via Deal Health and reports.
•	Pass the problem statement’s quick test flow end to end with real business logic.
2.3 Non-goals for P0
•	Full ERP/CRM replacement
•	Multi-company consolidation
•	Full tax compliance engine by jurisdiction
•	Carrier-rate or shipping-label integrations
•	External payment gateway settlement/reconciliation
•	Production-grade ML recommendation model
•	Advanced CPQ contract generation / e-signature
•	Real WMS/ERP inventory synchronization
•	Multi-currency accounting beyond storing currency metadata
2.4 Success Metrics / Release Gates
Metric	Target for P0
Quick-test completion	100% of the official login-to-payment test flow completes without manual database edits.
Approval correctness	100% pass on boundary, single-line-overage, blended-overage, manager-only, manager+finance, return/resubmit, and negotiation reapproval test cases.
Billing correctness	No stock-managed item is invoiced above shipped quantity; recurring billing creates the expected schedule and proration amount.
Auditability	Every approval/rejection/return/resubmit, negotiation acceptance, fulfillment override, invoice and payment action is attributable to user + timestamp + reason/reference where applicable.
Authorization	A portal customer can access only their own quotation(s); unauthorized module URLs return 403/redirect.
Demoability	Two complete flows can be demonstrated in <= 5 minutes using seed data.
Performance	Core reads/actions feel immediate on demo data: p95 API response target < 500 ms excluding file export.

3. Personas, Roles and Permissions
Role	Primary Jobs	Restrictions
Sales Rep	Creates quotations, applies discounts, accepts/edits customer negotiation requests, adds upsells, tracks approvals and fulfillment.	Cannot approve their own governed quote unless explicitly granted; cannot edit global rules.
Sales Manager / Approver	Reviews manager-level approvals; approve/reject/return; configures discount tiers and approval chain; monitors deal health.	No finance-only approval if configured as separate level.
Finance / Operations	Performs second-level high-risk approvals; manages warehouse split/backorders; recurring billing/credit-note operations; invoice/payment oversight.	No admin user-management unless separately assigned.
Admin	Manages users/roles, products, price lists, categories, warehouses, subscription plans, discount/routing config and global reports.	Not required to own customer negotiation work.
Customer Portal User	Views own quotation, line comments/change requests, counter discount, requested delivery date, confirms final terms.	No access to internal margin, unit cost, risk internals, approval notes, other customers, or admin modules.

3.1 Permission Matrix
Module	Sales Rep	Sales Mgr	Finance/Ops	Admin	Customer
Dashboard	R	R	R	R	—
Products / Price Lists	R	R/U config	R	CRUD	—
Quotation	CRUD own/team	R	R	CRUD	R own
Approval	R	Approve/Return/Reject	Approve/Return/Reject finance step	CRUD config	—
Fulfillment	R	R	CRUD	CRUD	Read status only
Subscriptions	R	R	CRUD	CRUD	Read own
Invoices / Payments	R	R	CRUD	CRUD	Read own
Deal Health	R	R + actions	R + actions	R + actions	—
Reports	R scoped	R	R	R	—
Negotiation	Respond	R	R	R	Create/Confirm own
Audit trail	R deal-scoped	R	R	R	—

4. Scope and Priority
Priority uses P0 = required for a credible end-to-end build, P1 = high-value if time remains, P2 = future/bonus. The problem statement explicitly says the core routing, discount, warehouse split and proration logic may not be faked.
Capability	Priority
Authentication + role authorization	P0
Sales dashboard	P0
Product catalog / variants / price lists	P0
Customer tier + category discount ceilings	P0
Quotation list + builder	P0
Live line discount validation + margin	P0
Blended risk + automatic approval routing	P0
Approval list/detail + audit trail	P0
Deterministic upsell suggestion	P0
Warehouse availability + suggested split + override	P0
Backorder state + restock consolidation prompt	P1
Customer portal negotiation + reapproval	P0
Hybrid one-time/recurring billing	P0
Proration + cancellation/credit note	P0
Invoices + manual record payment	P0
Deal Health basic rules/actions	P0
Reports filters + PDF/XLS export	P1
Email/magic-link delivery	P1
Advanced multi-team behavior	P1
Multi-currency / multi-company	P2
ML recommendation/risk model	P2

5. Information Architecture and Screen Inventory
The mockup establishes a consistent internal navigation: Dashboard, Quotations, Approvals, Fulfillment, Subscriptions, Invoices, Deal Health and Reports. Entity modules use a list screen followed by a detail screen opened by clicking a row. Customer users receive a separate My Quotation / Messages / Profile navigation.
ID	Screen	Users	Purpose / Required content
1	Login / Signup	All	Entry point; internal users go to dashboard, customers to portal.
2	Sales Dashboard / Home	Internal	Pending approvals, open quotations, at-risk deals, recent activity, shortcuts.
3	Quotations List / Pipeline	Sales/Internal	Pipeline by Draft / Pending Approval / Approved / Negotiation / Confirmed; table toggle.
4	Quotation Detail / Builder	Sales/Internal	Customer/pricelist, line items, live limits/status, upsells, save/submit.
5	Approvals List	Approvers	All approval-relevant quotations; pending/returned/approved summaries.
6	Approval Detail	Approvers	Risk explanation, line overage table, timeline/audit, approve/return/reject.
7	Fulfillment & Stock List	Finance/Ops	Warehouse stock table + orders awaiting fulfillment.
8	Fulfillment Detail	Finance/Ops	Suggested split, shipment count/cost, accept or manual override, backorder prompt.
9	Subscriptions List	Finance/Ops	All recurring subscriptions with customer/plan/cycle/next bill/status.
10	Subscription / Billing Detail	Finance/Ops	Originating one-time lines, recurring lines, billing/proration history, modify/cancel.
11	Customer Portal Negotiation	Customer	Status, line comments/change requests, counter discount, requested delivery date, submit/confirm.
12	Invoices List	Finance/Ops	Invoice number/customer/amount/status/due date.
13	Invoice Detail	Finance/Ops	Lifecycle, payment/delivery reconciliation, record payment, download summary.
14	Deal Health Dashboard	Internal	Stalled deals, discount anomalies, delivery slippage; nudge/escalate.
15	Reports Dashboard	Internal	Filters Period / Sales Team / Approval Status / Product; KPIs and exports.
A	Product Catalog	Admin/Internal	Product list, counts for active products/pricelists/variants, click to detail.
B	Product + Price List Detail	Admin	General info, variants, tier/currency price rules, subscription attributes.
C	Discount Tiers + Approval Chains	Admin/Manager	Tier ceilings, category ceilings, risk-to-approval routing, save config.
D	Warehouse Setup	Admin/Ops	Warehouse records, stock, replenishment and shipping cost weighting.
E	Subscription Plan Setup	Admin/Ops	Cycle, proration, cancellation and refund rules.
F	Upsell Rule Setup	Admin (optional)	Co-purchase pairings, promotions, minimum margin thresholds.

6. End-to-End Journeys
6.1 Journey A — New Quote to Approval to Fulfillment
1.	Admin has configured products, customer tiers, category limits, approval rules, warehouses and subscription plans.
2.	Sales Rep creates a quotation, selects a customer and applicable price list.
3.	Rep adds goods/services/subscriptions, quantities and discounts. Each line is validated immediately against its allowed limit and margin updates live.
4.	Risk engine calculates the quote’s blended risk. If approval is not required, the quote can proceed. If required, an approval cycle and ordered steps are created automatically.
5.	Approver reviews the risk explanation and audit trail; approves, rejects or returns for revision. Returned quotes can be edited and resubmitted without losing the prior history.
6.	After approval, fulfillment engine evaluates inventory. It proposes the smallest/lowest-cost warehouse combination, leaving any shortage as backorder.
7.	Operations accepts the suggestion or records a reasoned manual override; inventory is reserved.
6.2 Journey B — Customer Negotiation and Reapproval
8.	Customer opens their restricted quotation portal.
9.	Customer can add line comments/change requests, propose a counter discount and/or requested delivery date, then submits the request.
10.	Sales Rep reviews the proposal. Accepting or materially editing the commercial terms creates a new quotation version.
11.	The new version recalculates allowed discounts, totals, margin and blended risk.
12.	If the new version exceeds configured thresholds, a new approval cycle is created automatically. Prior approval remains historical and cannot be reused for changed commercial terms.
13.	When the latest version is approved (or needs no approval), the customer can confirm it.
6.3 Journey C — Hybrid Billing to Payment
14.	Confirmed one-time stock goods move through shipment. Invoice quantity may not exceed shipped quantity.
15.	Non-stock one-time lines are invoiced according to the configured service billing point.
16.	Recurring lines create subscriptions and future billing schedules.
17.	Mid-cycle changes calculate a prorated charge or credit. Cancellation may create a partial refund/credit note according to plan policy.
18.	Invoices appear in the invoice module with Unpaid / Partially Paid / Paid status.
19.	Finance records payment(s); invoice paid amount/status updates and the quote/order reconciliation view stays consistent.
7. Functional Requirements
7.1 Authentication and Session Management
ID	Pri	Origin	Requirement	Acceptance / Notes
AUTH-001	P0	PS/Mockup	Internal users can sign up/log in with email and password.	Valid credentials create a session; invalid credentials show a generic error.
AUTH-002	P0	PS/Mockup	Customer access must be through a separate restricted portal using either secure magic-link/token or email/password.	Customer cannot navigate into internal modules or fetch another customer’s resources.
AUTH-003	P0	PRD	Authorization must be server-side for every protected API, not only hidden UI controls.	Direct API/URL access by an unauthorized role returns 401/403.
AUTH-004	P0	Mockup	Internal users land on Dashboard after login; customers land on My Quotation portal.	Post-login redirect is role-specific.
AUTH-005	P1	Mockup	Company/team selector can be shown for multi-team setups.	If multi-team is implemented, all list/report queries are scoped accordingly.
AUTH-006	P0	Mockup	Basic email/password validation and Forgot Password entry are presented.	Email format validated; required fields enforced; forgot-password can be stubbed safely if email not implemented.

7.2 Sales Dashboard
ID	Pri	Origin	Requirement	Acceptance / Notes
DSH-001	P0	Mockup	Show Pending Approvals count and shortcut.	Count matches approval records visible to the user.
DSH-002	P0	Mockup	Show Open Quotations count.	Excludes terminal cancelled/paid quotes per configured definition.
DSH-003	P0	Mockup	Show At-Risk Deals count.	Count is derived from active Deal Health alerts.
DSH-004	P0	Mockup	Show recent activity feed.	Actions such as approval, customer negotiation, stock update appear from audit/activity events.
DSH-005	P0	Mockup	Provide + New Quotation and View Approvals shortcuts.	Actions navigate to the expected modules.

7.3 Product Catalog, Variants and Price Lists
ID	Pri	Origin	Requirement	Acceptance / Notes
PROD-001	P0	PS/Mockup	Maintain product general information: name, category, price, unit, tax, description and active/archive status.	Product can be created, edited, listed and archived without deleting historical quote references.
PROD-002	P0	Mockup/PRD	Maintain internal unit cost used only for margin calculations.	Customer portal never exposes unit cost.
PROD-003	P0	PS/Mockup	Support product variants with attribute/value combinations and extra price.	Selected variant resolves to a stable SKU and adjusted list price.
PROD-004	P0	PS/Mockup	Support customer-tier and currency-specific price lists/rules.	Quotation resolves a deterministic unit price from customer/pricelist/product/variant.
PROD-005	P0	PS/Mockup	Support subscription flag and recurring cycle metadata for subscription-capable products.	When subscription is enabled, plan/cycle fields are available and quote line can become recurring.
PROD-006	P0	Mockup	Product catalog shows product, category, variants, price, unit, tax and status plus summary counts.	Rows open product detail.
PROD-007	P1	Mockup	Support quantity-on-hand summary on product detail.	Displayed value is derived from warehouse inventory, not independently edited.

7.4 Discount Governance and Configuration
ID	Pri	Origin	Requirement	Acceptance / Notes
DISC-001	P0	PS/Mockup	Configure maximum discount by customer tier (e.g., Bronze 5%, Silver 10%, Gold 15%).	Changes apply to newly evaluated quote versions.
DISC-002	P0	PS/Mockup	Configure maximum discount by product category (e.g., Hardware 15%, Services 10%).	Each quote line resolves its category ceiling.
DISC-003	P0	PS	When customer-tier and category ceilings both apply, line allowed discount must respect the stricter applicable ceiling.	Gold 15% + Services 10% yields 10% line limit.
DISC-004	P0	PS/Mockup	Discount validation occurs live when the rep enters/changes a line discount.	Line displays OK or OVER (+N pt) immediately.
DISC-005	P0	PS/Mockup	Calculate a blended risk level across the quote and route to the highest configured approval requirement.	One severe line can force approval; multiple smaller overages can cumulatively raise risk.
DISC-006	P0	Mockup/PRD	Risk-to-approval mapping is configurable: within limit → none; medium → Sales Manager; high → Sales Manager then Finance.	No code change required to change routing thresholds/roles.
DISC-007	P0	PS	All discount/approval configuration is application data, not hardcoded demo conditions.	Changing config changes subsequent evaluations.

7.5 Quotations and Quotation Builder
ID	Pri	Origin	Requirement	Acceptance / Notes
QUO-001	P0	PS/Mockup	List quotations and support pipeline stages Draft, Pending Approval, Approved, Negotiation and Confirmed.	Cards/rows display customer, amount and stage; clicking opens detail.
QUO-002	P0	Mockup	Quotation includes customer and selected price list.	Changing customer/pricelist re-resolves prices on user confirmation.
QUO-003	P0	PS/Mockup	Add hardware, service and subscription products; edit quantity; apply line-level or order-level discounts.	Totals, line discounts and risk are recalculated deterministically.
QUO-004	P0	PS/Mockup	Show line product, quantity, price, discount, allowed limit and status.	Over-limit line identifies exact percentage-point excess.
QUO-005	P0	PS/Mockup	Show live margin impact.	Margin uses internal cost basis and updates on price/qty/discount/upsell changes.
QUO-006	P0	Mockup	Allow Save Draft and Submit for Approval.	Draft is editable; submit locks the submitted version except through return/revision flow.
QUO-007	P0	PRD	Persist immutable quote versions for each submitted/approved commercial revision.	Historical approved values remain queryable after negotiation changes.
QUO-008	P0	PRD	Generate unique quote numbers and timestamps.	No duplicate quote number; audit links to quote/version.
QUO-009	P1	Mockup	Support pipeline/table toggle.	Both representations use the same backend records/filters.

7.6 Upsell / Cross-sell Recommendations
ID	Pri	Origin	Requirement	Acceptance / Notes
REC-001	P0	PS/Mockup	Show ranked suggestions beside the cart during quote building.	At least one deterministic suggestion can be generated from seed data.
REC-002	P0	PS/Mockup	Display suggested product, margin delta and promotion tag when applicable.	Margin delta recomputes from actual unit price/cost.
REC-003	P0	PS/Mockup	Allow Add to Quote and Dismiss.	Add creates a normal quote line and totals/margin update immediately.
REC-004	P1	PS	Admin may configure historical co-purchase pairings, promotion boosts and minimum margin thresholds.	Suggestions below minimum margin threshold do not surface.
REC-005	P2	PRD	ML ranking can replace deterministic score without changing UI/API contract.	Recommendation response remains explainable and returns score/reason.

7.7 Approval Workflow
ID	Pri	Origin	Requirement	Acceptance / Notes
APV-001	P0	PS/Mockup	Submitting a governed quote automatically creates the required approval steps; the rep does not manually choose approvers.	Approval list shows the quote immediately after submission when required.
APV-002	P0	PS/Mockup	Approval list shows quotation, customer, blended risk, stage and assignee; counters for pending/returned/approved.	Rows open full approval detail.
APV-003	P0	Mockup	Approval detail explains why the quote was flagged using line discount, allowed limit and overage.	Reviewer can trace risk to concrete quote lines.
APV-004	P0	PS/Mockup	Reviewer actions: Approve, Reject, Return for Revision.	Every action persists actor, timestamp and reason/note.
APV-005	P0	Mockup	Support ordered approval chain: Manager then Finance for high risk.	Finance step cannot complete before required Manager approval.
APV-006	P0	Mockup	Returned quote may be edited and resubmitted.	A new submitted version/cycle preserves the prior return event.
APV-007	P0	PS	All approvals, rejections and edits are logged.	Audit trail is append-only from product UI.
APV-008	P0	PRD	Approved quote becomes commercially frozen until a customer/internal commercial change creates a new version.	Changing discount/qty/price after approval invalidates prior approval for the changed version.

7.8 Warehouse, Fulfillment and Backorders
ID	Pri	Origin	Requirement	Acceptance / Notes
FUL-001	P0	PS/Mockup	Maintain warehouses and inventory by SKU with on-hand, reserved and available quantities.	available = on_hand - reserved; cannot reserve below zero.
FUL-002	P0	PS	Warehouse config includes replenishment information and shipping-cost weighting.	Fulfillment scorer reads configured weight/cost.
FUL-003	P0	PS/Mockup	After approval/no-approval path, calculate a recommended warehouse split from live stock.	Suggestion shows warehouse, qty, estimated shipment count and cost.
FUL-004	P0	PS/Mockup	Operations can Accept Suggested Split or Manual Override.	Accept reserves stock; override requires reason and cannot allocate more than available unless explicitly backordered.
FUL-005	P0	PS	Unfulfilled remainder becomes backorder.	Order status shows Backorder / Partially Fulfilled as appropriate.
FUL-006	P1	PS/Mockup	When restock can improve an open backorder, show “Consolidate Remaining Backorder” prompt.	Prompt appears from updated availability and can update remaining allocation.
FUL-007	P0	PRD/Mockup	Shipping/fulfillment status is recorded by allocated and shipped quantity per line/warehouse.	Invoice logic can query actual shipped quantity.
FUL-008	P0	Mockup	Stock list includes warehouse/product/in-stock/reserved/available and orders awaiting fulfillment.	Values are live database values.

7.9 Customer Portal and Negotiation
ID	Pri	Origin	Requirement	Acceptance / Notes
NEG-001	P0	PS	Customer portal is a real separate restricted view, not an internal screen relabeled.	Portal route/layout hides internal navigation and server rejects internal APIs.
NEG-002	P0	PS/Mockup	Display quotation details and status: Sent / Under Negotiation / Confirmed.	Customer sees only their latest allowed commercial version.
NEG-003	P0	PS/Mockup	Support line-level comments/change requests.	Request records line, customer, text, timestamp and status.
NEG-004	P0	PS/Mockup	Support counter discount proposal and requested delivery date.	Inputs are validated and stored as a negotiation request.
NEG-005	P0	Mockup/PRD	Submit Request creates a proposal; Sales Rep accepts/edits/rejects it before it becomes the next quote version.	Unaccepted proposals do not silently alter an approved quote.
NEG-006	P0	PS/Mockup	Accepted terms are automatically re-evaluated; if thresholds are exceeded, quote re-enters approval.	A new approval cycle is created and prior approval remains historical.
NEG-007	P0	PS/Mockup	Customer can Confirm Quotation when latest version is valid/approved.	Confirmation creates/activates downstream order fulfillment/billing state.

7.10 Subscription and Hybrid Billing
ID	Pri	Origin	Requirement	Acceptance / Notes
SUB-001	P0	PS	Single quote/order supports one-time and recurring lines simultaneously.	Billing separates one-time invoiceable lines from recurring schedule without duplicating the order.
SUB-002	P0	PS/Mockup	Subscription plans support at least monthly, quarterly and yearly cycles; weekly may be supported from mockup.	Plan stores cycle and billing rules.
SUB-003	P0	Mockup	Recurring billing is at beginning of period for configured subscription product.	Initial/next invoice dates reflect period-start rule.
SUB-004	P0	PS/Mockup	Subscription list shows customer, plan, cycle, next bill date and status Active/Paused/Cancelled.	Rows open billing detail.
SUB-005	P0	PS	Mid-cycle quantity/plan changes calculate proration.	Charge/credit is deterministic and appears in proration history.
SUB-006	P0	PS	Cancellation/partial refund rules can generate a credit note.	Credit amount links back to subscription change and invoice/customer.
SUB-007	P0	Mockup	Subscription detail shows recurring lines and originating one-time lines for context.	Origin quote/order remains navigable.
SUB-008	P0	Mockup	Allow Modify Subscription and Cancel Subscription.	Actions update status/schedule and create appropriate financial adjustment.
SUB-009	P1	PRD	Background job can generate due recurring invoices.	Job is idempotent; rerun does not duplicate invoice for same period.

7.11 Invoices, Shipment Reconciliation and Payments
ID	Pri	Origin	Requirement	Acceptance / Notes
INV-001	P0	PS/Mockup	Invoice list shows invoice number, customer, amount, status and due date.	Rows open invoice detail.
INV-002	P0	Mockup	Invoice detail shows Order Confirmed → Shipped → Invoiced → Paid lifecycle.	Timeline derives from actual events.
INV-003	P0	Mockup	Partial invoicing stays reconciled with partial delivery; stock goods are not billed before shipment.	Sum invoiced qty for a stock line never exceeds shipped qty.
INV-004	P0	PRD	Invoice statuses: Draft, Unpaid, Partially Paid, Paid, Voided/Credited as needed.	paid_amount and status remain consistent after each payment/credit.
INV-005	P0	Mockup/PRD	Record Payment captures amount, date, reference/method and actor.	Partial payment updates remaining balance; full payment marks Paid.
INV-006	P0	PS	Recurring billing and credit notes remain reconcilable to originating order/subscription.	Invoice lines store source type/source id.
INV-007	P1	Mockup	Download invoice/payment summary.	Generated file contains invoice, customer, lines, totals and payment history.

7.12 Deal Health and Anomaly Dashboard
ID	Pri	Origin	Requirement	Acceptance / Notes
HLT-001	P0	PS/Mockup	Flag stalled deals after configurable inactivity threshold.	Example seed: quote idle 7+ days is flagged; last_activity_at is event-derived.
HLT-002	P0	PS/Mockup	Flag discount anomaly when a quote’s discount is materially above the Sales Rep’s historical average.	Threshold is configurable; example 22% vs 8% average flags.
HLT-003	P0	PS/Mockup	Flag delivery promise slippage when promised date is earlier than realistic fulfillment estimate.	Alert points to the related quote/order.
HLT-004	P0	PS/Mockup	Clicking alert opens related quotation.	Deep link resolves.
HLT-005	P0	PS/Mockup	Allow Nudge Rep and Escalate actions.	Action is logged and changes alert/action history.
HLT-006	P0	PRD	Alert lifecycle: Open, Acknowledged, Resolved, Dismissed.	Resolved alerts no longer count as active at-risk deals.

7.13 Reporting and Exports
ID	Pri	Origin	Requirement	Acceptance / Notes
RPT-001	P0	PS/Mockup	Report filters include Period, Sales Team/Rep, Approval Status and Product/Category.	Filter changes all displayed KPIs consistently.
RPT-002	P0	Mockup	Show at least Quotes Created, Average Approval Time and Top Upsold Product.	Values are computed from live data, not constants.
RPT-003	P1	PS/Mockup	Export report to PDF and XLS.	Export reflects active filters and generation timestamp.
RPT-004	P1	PRD	Useful additional KPIs: conversion rate, average discount, approval rate, recurring revenue, fulfillment split rate.	Only include if data is available and formula is documented.

7.14 Audit, Activity and Notifications
ID	Pri	Origin	Requirement	Acceptance / Notes
AUD-001	P0	PS	Maintain immutable audit events for approval actions, quote edits and other sensitive changes.	Audit row contains actor, action, entity, version, timestamp and reason/metadata.
AUD-002	P0	Mockup	Recent Activity reuses system events.	No separate manually maintained feed.
AUD-003	P0	PRD	In-app notification for new approval assignment, quote returned/rejected, customer negotiation, and restock/backorder opportunity.	Unread/read status available.
AUD-004	P1	PRD	Email notifications may be added through an adapter without changing domain workflow.	Failed email does not roll back the underlying business transaction.

8. Business Rules and Algorithms
Important  Sections 8.4 and parts of 8.7 are PRD-defined deterministic v1 algorithms because the source specifies behavior but not exact mathematics. Keep thresholds/config values in database/configuration so the team can tune them without rewriting the workflow.

8.1 Price Resolution
Resolve quote line list price in this order: product/variant base price → applicable price-list adjustment for customer tier/currency → explicit approved manual price override (if supported). Store the resolved price on the immutable quote version so future master-data changes do not rewrite historical deals.
resolved_unit_price = (product.base_price + variant.extra_price) adjusted_by price_list_rule
8.2 Margin Calculation
net_unit_price = resolved_unit_price × (1 - discount_pct / 100)
line_revenue = net_unit_price × qty
line_cost = unit_cost × qty
line_margin = line_revenue - line_cost
line_margin_pct = line_margin / line_revenue × 100
Quote margin is the sum of line margin. Subscription suggestions can show immediate margin delta and/or recurring contribution; the UI should label which measure is displayed.
8.3 Allowed Discount per Line
tier_limit = customer_tier.max_discount_pct
category_limit = product_category.max_discount_pct
allowed_discount_pct = min(tier_limit, category_limit)
overage_points = max(0, applied_discount_pct - allowed_discount_pct)
This matches the supplied Gold-customer / Services example: Gold allows 15%, Services allows 10%, therefore a service line is limited to 10%.
8.4 Blended Discount Risk — Proposed v1
The source requires the score to detect both one severe line and a pattern of several smaller violations. The following v1 makes that behavior deterministic while leaving thresholds configurable.
max_overage = max(line.overage_points)
weighted_overage = Σ(pre_discount_line_value × overage_points) / Σ(pre_discount_line_value)
violating_lines = count(overage_points > 0)
Risk	Default condition	Approval
NONE / LOW	No violating lines.	No approval.
MEDIUM	Any violation AND max_overage <= 5 pp AND weighted_overage <= 3 pp.	Sales Manager.
HIGH	max_overage > 5 pp OR weighted_overage > 3 pp OR >= 3 violating lines.	Sales Manager → Finance.

Default thresholds are a PRD decision and should be stored in ApprovalRule configuration. Example: a service line at 18% where limit is 10% has max_overage = 8 pp, therefore HIGH, consistent with the mockup’s Q-1042 behavior.
8.5 Approval Routing Rules
•	Evaluate the submitted quotation version once and persist the resulting risk snapshot.
•	Map risk level to ordered required roles from ApprovalRule configuration.
•	Create one ApprovalCycle per submitted version/cycle and one ApprovalStep per required role.
•	Return for Revision terminates the current cycle as Returned; resubmission creates a new version/cycle.
•	Reject terminates the cycle and blocks fulfillment until the quote is revised/resubmitted.
•	Approved quote may proceed only when every required step is approved.
8.6 Quote Versioning and Negotiation Reapproval
•	Draft edits can mutate the current draft version.
•	On Submit for Approval, persist a snapshot version with line price/discount/limits/totals/risk.
•	After approval, changes to price, discount, quantity, product mix, requested delivery date (if operationally relevant), or accepted customer counter terms create a new version.
•	Previous ApprovalCycle remains attached to previous version and is never “moved” to the new version.
•	New version runs discount/risk evaluation; if no approval is needed it can become valid immediately, otherwise create a new cycle.
8.7 Warehouse Split — Proposed v1
Only stock-managed physical lines participate. Services/subscriptions bypass warehouse allocation. The desired objective from the source is to minimize shipment count while using shipping-cost weighting.
•	Compute available quantity = on_hand - reserved for each warehouse/SKU.
•	First check whether a single warehouse can satisfy all stock-managed lines. If yes, select the lowest configured shipping-cost candidate.
•	Otherwise evaluate warehouse subsets (practical for small demo warehouse counts) and choose the smallest subset that maximizes fulfilled quantity; among equal subset sizes choose the lowest weighted shipping cost.
•	Allocate line quantities across chosen warehouses without exceeding available stock.
•	Any remainder becomes backorder.
•	Accepting the suggestion reserves allocated stock in a single database transaction. Manual override uses the same availability validation and records a reason.
8.8 Subscription Proration — Proposed v1
Use actual calendar days in the current billing period for the demo implementation. For a mid-cycle change, calculate only the delta between old and new recurring amount for remaining days.
remaining_fraction = remaining_days_in_period / total_days_in_period
prorated_delta = (new_period_amount - old_period_amount) × remaining_fraction
Positive delta creates an additional charge; negative delta creates a credit note. Round monetary results to currency precision only at the final money boundary.
8.9 Shipment-aware Invoice Rule
•	For stock-managed goods: invoiceable_qty = shipped_qty - already_invoiced_qty.
•	Never create an invoice line where cumulative invoiced_qty > cumulative shipped_qty.
•	For partial shipment, invoice only shipped quantity; later shipments can generate additional invoice lines/invoices.
•	For recurring lines, invoices follow subscription schedule independent of warehouse shipping.
•	Credits/voids reduce net invoiced financial amount but do not alter shipped quantity.
8.10 Deal Health Rules
Alert type	Default P0 rule	Config
Stalled	Open quote with no meaningful activity for >= 7 days.	stalled_days
Discount anomaly	Quote effective discount >= rep rolling historical average + configured delta (example +10 pp).	anomaly_delta_pp, lookback window
Delivery slippage	requested/promised delivery date < estimated feasible fulfillment date.	grace days optional

9. State Machines
9.1 Quotation Commercial State
DRAFT → PENDING_APPROVAL → APPROVED → SENT/NEGOTIATION → CONFIRMED
      ↘ (no approval required) APPROVED
PENDING_APPROVAL → RETURNED → DRAFT/RESUBMITTED
PENDING_APPROVAL → REJECTED
APPROVED/NEGOTIATION + changed accepted terms → new version → PENDING_APPROVAL or APPROVED
9.2 Approval Cycle State
PENDING → IN_REVIEW → APPROVED
                   ↘ RETURNED
                   ↘ REJECTED
9.3 Fulfillment State
NOT_READY → SPLIT_PROPOSED → RESERVED → PARTIALLY_SHIPPED → SHIPPED
                                  ↘ BACKORDER / PARTIAL_BACKORDER
9.4 Subscription State
DRAFT/CREATED → ACTIVE ↔ PAUSED → CANCELLED
ACTIVE → MODIFIED (change event) → ACTIVE
9.5 Invoice / Payment State
DRAFT → UNPAID → PARTIALLY_PAID → PAID
           ↘ CREDITED / VOIDED where applicable
10. Data Model
 
Figure 2. Simplified relationship view. Detailed entities below.
Entity	Key fields	Constraints / notes
User	id, name, email, password_hash/auth_id, role, team_id, status	email unique; role required
Customer	id, name, tier_id, portal_user_id, currency_code, contact fields, status	portal user scoped to customer
CustomerTier	id, name, max_discount_pct	name unique
Category	id, name, max_discount_pct	name unique
Product	id, sku/base_sku, name, category_id, base_price, unit_cost, unit, tax_pct, description, is_subscription, status	archive rather than hard-delete referenced products
ProductVariant	id, product_id, sku, attributes_json, extra_price, status	sku unique
PriceList	id, name, tier_id nullable, currency_code, status	supports rules/overrides
PriceListItem	id, pricelist_id, product/variant_id, rule_type, rule_value	one active rule per intended scope
ApprovalRule	id, risk_level, min/max thresholds, ordered_required_roles, active	configuration-driven routing
Warehouse	id, name, shipping_cost_weight/default_cost, active	name unique
Inventory	id, warehouse_id, sku, on_hand, reserved, restock_at	unique warehouse+sku; available derived
SubscriptionPlan	id, name, cycle, proration_policy, cancellation_policy, active	cycle monthly/quarterly/yearly; weekly optional
Quotation	id, quote_no, customer_id, owner_id, pricelist_id, status, current_version_id, requested_delivery_date, last_activity_at	quote_no unique
QuotationVersion	id, quotation_id, version_no, subtotal, discount_total, net_total, margin, weighted_overage, max_overage, risk_level, created_by, created_at	unique quote+version; immutable after submission
QuotationLine	id, version_id, product/variant_id, qty, resolved_unit_price, unit_cost_snapshot, discount_pct, allowed_discount_pct, overage_points, tax, line totals, billing_type	all commercial values snapshotted
Recommendation	id, quote_version/draft_id, suggested_product_id, score, reason, margin_delta, status	optional persistence
ApprovalCycle	id, quotation_version_id, risk_level, status, created_at, completed_at	one/more cycles across revisions
ApprovalStep	id, cycle_id, sequence, required_role, assignee_id, status, acted_by, acted_at, reason	ordered steps
AuditLog	id, actor_id, action, entity_type, entity_id, version/ref, timestamp, reason, metadata_json	append-only
NegotiationRequest	id, quotation_id, base_version_id, customer_user_id, counter_discount, requested_delivery_date, status, created_at	proposal until accepted
NegotiationLineComment	id, request_id, line_id, comment, requested_change_json	line-specific proposal
Fulfillment	id, quotation_id, status, proposed_at, accepted_at	one logical fulfillment per confirmed quote/order
FulfillmentAllocation	id, fulfillment_id, quote_line_id, warehouse_id, allocated_qty, shipped_qty, est_cost, status	allocation + shipment truth
Backorder	id, fulfillment_line/ref, qty, status, created_at, resolved_at	shortage history
Subscription	id, customer_id, originating_quote_line_id, plan_id, status, start_date, next_bill_date, qty, recurring_unit_price	links to originating deal
SubscriptionChange	id, subscription_id, effective_at, old/new qty/plan/price, prorated_delta, credit_note_id	proration history
Invoice	id, invoice_no, customer_id, quotation_id, subscription_id nullable, status, issue_date, due_date, currency, subtotal, tax, total, paid_amount	invoice_no unique
InvoiceLine	id, invoice_id, source_type, source_id, description, qty, unit_price, tax, amount	source_type shipment/service/subscription/credit
Payment	id, invoice_id, amount, paid_at, method, reference, recorded_by	idempotency/reference recommended
CreditNote	id, customer_id, invoice_id/subscription_change_id, amount, reason, status	financial adjustment
DealAlert	id, quotation_id, type, severity, status, details_json, created_at, resolved_at	active alert indexed
Notification	id, user_id, type, entity_ref, read_at, created_at	in-app notification

10.1 Critical Database Constraints
•	Unique: user.email, quotation.quote_no, invoice.invoice_no, product/variant SKU, inventory(warehouse_id, sku).
•	Check: quantity/amount/discount values are non-negative; discount normally 0–100.
•	Transactional reservation: inventory reservation + fulfillment allocation must commit atomically.
•	Immutable submitted QuoteVersion commercial fields; corrections use a new version.
•	Foreign-key protection: historical quote/invoice references cannot be broken by deleting master data; archive instead.
•	Idempotent recurring invoice generation keyed by subscription + billing period.
•	Use optimistic locking/version column on quotation draft and inventory rows if concurrent updates are possible.
11. API Contract (Reference REST Surface)
Exact framework is open. The API contract below is a reference implementation boundary; GraphQL or server actions are acceptable if they preserve the same business operations and authorization.
Method	Endpoint	Role	Purpose
POST	/auth/login	All	Authenticate and create session/token.
POST	/auth/signup	All	Create eligible internal/customer account.
POST	/auth/logout	All	End session.
GET/POST	/products	Internal/Admin	List/create products.
GET/PATCH	/products/{id}	Internal/Admin	Product detail/update/archive.
GET/POST	/pricelists	Admin	List/create price lists/rules.
GET/PUT	/config/discounts	Manager/Admin	Tier/category ceilings + risk mapping.
GET/POST	/warehouses	Admin/Ops	Warehouse setup.
GET/PATCH	/inventory	Admin/Ops	Stock update/list.
GET/POST	/subscription-plans	Admin/Ops	Recurring plan config.
GET/POST	/quotations	Sales/Internal	List/create quotation.
GET/PATCH	/quotations/{id}	Sales/Internal	Read/edit current draft.
POST	/quotations/{id}/lines	Sales	Add/update line.
POST	/quotations/{id}/evaluate	Sales	Return pricing/limits/margin/risk preview.
POST	/quotations/{id}/submit	Sales	Freeze version and auto-route approval.
POST	/quotations/{id}/send	Sales	Expose latest valid version to portal.
POST	/quotations/{id}/confirm	Sales/Admin	Internal confirm where allowed.
GET	/approvals	Approvers	Approval queue.
GET	/approvals/{cycleId}	Approvers	Risk detail and audit.
POST	/approvals/{cycleId}/actions	Approvers	Approve/return/reject with reason.
GET	/fulfillments	Ops	Stock + awaiting orders.
POST	/fulfillments/{id}/suggest	Ops	Compute suggested split.
POST	/fulfillments/{id}/accept	Ops	Reserve suggested split.
POST	/fulfillments/{id}/override	Ops	Save manual split + reason.
POST	/fulfillments/{id}/ship	Ops	Record shipped qty.
GET	/portal/quotations/{tokenOrId}	Customer	Read own portal quote.
POST	/portal/quotations/{id}/requests	Customer	Submit negotiation request.
POST	/portal/quotations/{id}/confirm	Customer	Confirm latest valid terms.
POST	/quotations/{id}/negotiations/{requestId}/accept	Sales	Accept proposal, create new version, re-evaluate.
GET	/subscriptions	Finance/Ops	List subscriptions.
GET	/subscriptions/{id}	Finance/Ops	Billing/proration detail.
POST	/subscriptions/{id}/modify	Finance/Ops	Apply mid-cycle change + proration.
POST	/subscriptions/{id}/cancel	Finance/Ops	Cancel + credit per policy.
GET	/invoices	Finance/Internal	List invoices.
GET	/invoices/{id}	Finance/Internal	Invoice/payment/delivery reconciliation.
POST	/invoices/{id}/payments	Finance	Record payment.
GET	/deal-health	Internal	Active alerts / metrics.
POST	/deal-health/{alertId}/nudge	Internal	Nudge rep.
POST	/deal-health/{alertId}/escalate	Internal	Escalate.
GET	/reports/sales	Internal	Filtered report metrics.
GET	/reports/sales/export	Internal	PDF/XLS export.
GET	/dashboard	Internal	Home KPIs + activity.

11.1 API Error Contract
Recommended  Use stable error codes such as VALIDATION_ERROR, FORBIDDEN, QUOTE_VERSION_CONFLICT, APPROVAL_NOT_READY, INSUFFICIENT_STOCK, INVALID_SHIPMENT_QTY, DUPLICATE_BILLING_PERIOD, PAYMENT_EXCEEDS_BALANCE. UI should map these to human-readable messages.

12. Frontend Routes and UI States
Route	Mockup	Access
/login	Screen 1	Public
/dashboard	Screen 2	Internal
/quotations	Screen 3	Internal
/quotations/{id}	Screen 4	Internal
/approvals	Screen 5	Approvers
/approvals/{cycleId}	Screen 6	Approvers
/fulfillment	Screen 7	Ops
/fulfillment/{id}	Screen 8	Ops
/subscriptions	Screen 9	Finance/Ops
/subscriptions/{id}	Screen 10	Finance/Ops
/portal/quotation/{id|token}	Screen 11	Customer
/invoices	Screen 12	Finance/Internal
/invoices/{id}	Screen 13	Finance/Internal
/deal-health	Screen 14	Internal
/reports	Screen 15	Internal
/admin/products	Screen A	Admin
/admin/products/{id}	Screen B	Admin
/admin/discounts	Screen C	Admin/Manager
/admin/warehouses	Screen D	Admin/Ops
/admin/subscription-plans	Screen E	Admin/Ops

12.1 Required UI States
•	Loading: skeleton/spinner without stale actions.
•	Empty: meaningful empty-state with next action (e.g., “No pending approvals”).
•	Error: user-readable message + retry for recoverable requests.
•	Forbidden: no data leakage; redirect/403 state.
•	Saving: disable duplicate submit/approve/payment actions while request is in flight.
•	Success: toast/inline confirmation and refreshed server truth.
•	Conflict: if draft/version changed elsewhere, prompt user to reload rather than overwrite silently.
•	Long list: pagination or reasonable client-side pagination for demo seed size; filters preserved in URL where practical.
13. Validation, Edge Cases and Failure Handling
Edge case	Required behavior
Quote discount exactly equals limit	Allowed; no overage from that line.
Order-level discount + line discount	Define composition explicitly; recommended effective discount from final line price, and evaluate that effective percentage against limit.
Product archived after quote created	Historical version remains valid; cannot add archived product to new quote.
Customer tier changed after approval	Approved version keeps old snapshot; next new version uses current tier.
Price list changed after approval	Approved version keeps resolved historical unit price.
Approver returns then rep changes product mix	Create new version; risk recalculated; prior cycle remains Returned.
Finance step pending and customer negotiates	Do not mutate in-flight approved commercial snapshot; new accepted negotiation creates new version/cycle.
Stock changes after suggestion but before acceptance	Revalidate inside acceptance transaction; show INSUFFICIENT_STOCK and recompute.
Manual override exceeds available stock	Reject excess allocation; allow remainder as backorder.
Partial shipment	Invoice only shipped qty; remaining allocation/backorder stays open.
Payment greater than invoice balance	Reject or require explicit overpayment workflow; P0 reject.
Recurring job retried	No duplicate invoice for same subscription+billing period.
Subscription downgrade mid-cycle	Negative proration creates credit note.
Customer opens expired/invalid portal token	Show secure invalid-link state; do not reveal quote existence.
Discount anomaly with no rep history	Do not flag until minimum sample size; use configurable fallback.
Deleted/disabled user with historical approvals	Historical audit retains user display snapshot/id.
Network fails after action click	Server transaction is source of truth; UI retry must be idempotent for payment/billing/approval actions.

14. Non-functional Requirements
ID	Pri	Origin	Requirement	Acceptance / Notes
NFR-001	P0	PRD	Correctness over visual complexity for financial, approval and inventory operations.	Automated tests cover business-rule boundaries and transactional invariants.
NFR-002	P0	PRD	Core UI should be usable on standard laptop widths; customer portal responsive for mobile.	No horizontal overflow for primary forms/tables at target widths; tables may scroll on small screens.
NFR-003	P0	PRD	p95 normal API response < 500 ms on demo data; page navigation < 2 s perceived.	Measured locally/staging during final test.
NFR-004	P0	PRD	Server actions that affect money/inventory/approval are transactional.	No partial state such as reserved inventory without accepted allocation.
NFR-005	P0	PRD	Audit records retained for the life of demo/project data.	No UI hard-delete of audit.
NFR-006	P0	PRD	Monetary calculations use decimal/fixed-point, not binary floating point.	No cent-level drift in totals/proration.
NFR-007	P0	PRD	Timestamps stored in UTC and displayed in user locale/timezone.	Audit order deterministic.
NFR-008	P1	PRD	Exports and recurring jobs may run asynchronously.	UI can show processing state; job retries are idempotent.
NFR-009	P0	PRD	Basic accessibility: labels, keyboard reachable controls, visible focus, semantic tables/headings, adequate contrast.	No critical workflow requires mouse-only interaction.

15. Security and Access Control
•	Hash passwords with an industry-standard adaptive password hash or delegate to trusted auth provider.
•	Use secure, httpOnly, sameSite session cookies or properly protected bearer tokens.
•	Every resource query is scoped by role/team/customer ownership on the server.
•	Customer portal never returns internal fields such as unit_cost, gross margin, approval reasons, rep historical averages, or other customers.
•	Magic-link tokens, if used, must be high entropy, expiry-bound and optionally single-use/revocable.
•	Rate-limit login and portal-token endpoints where practical.
•	Validate/normalize all money, percentage, quantity and date inputs server-side.
•	Escape/sanitize user comments in negotiation/audit displays.
•	Do not log passwords/tokens or unnecessary PII.
•	Approval/payment/fulfillment override actions require authenticated actor and are audit logged.
16. Analytics, Audit and Observability
16.1 Domain Events to Capture
Event	Minimum metadata
USER_LOGGED_IN	actor/system, entity id, quote/customer context, timestamp, before/after or reason where relevant
QUOTE_CREATED	actor/system, entity id, quote/customer context, timestamp, before/after or reason where relevant
QUOTE_LINE_CHANGED	actor/system, entity id, quote/customer context, timestamp, before/after or reason where relevant
DISCOUNT_CHANGED	actor/system, entity id, quote/customer context, timestamp, before/after or reason where relevant
RISK_EVALUATED	actor/system, entity id, quote/customer context, timestamp, before/after or reason where relevant
QUOTE_SUBMITTED	actor/system, entity id, quote/customer context, timestamp, before/after or reason where relevant
APPROVAL_REQUESTED	actor/system, entity id, quote/customer context, timestamp, before/after or reason where relevant
APPROVAL_APPROVED	actor/system, entity id, quote/customer context, timestamp, before/after or reason where relevant
APPROVAL_RETURNED	actor/system, entity id, quote/customer context, timestamp, before/after or reason where relevant
APPROVAL_REJECTED	actor/system, entity id, quote/customer context, timestamp, before/after or reason where relevant
NEGOTIATION_SUBMITTED	actor/system, entity id, quote/customer context, timestamp, before/after or reason where relevant
NEGOTIATION_ACCEPTED	actor/system, entity id, quote/customer context, timestamp, before/after or reason where relevant
QUOTE_CONFIRMED	actor/system, entity id, quote/customer context, timestamp, before/after or reason where relevant
FULFILLMENT_SUGGESTED	actor/system, entity id, quote/customer context, timestamp, before/after or reason where relevant
FULFILLMENT_ACCEPTED	actor/system, entity id, quote/customer context, timestamp, before/after or reason where relevant
FULFILLMENT_OVERRIDDEN	actor/system, entity id, quote/customer context, timestamp, before/after or reason where relevant
SHIPMENT_RECORDED	actor/system, entity id, quote/customer context, timestamp, before/after or reason where relevant
BACKORDER_CREATED	actor/system, entity id, quote/customer context, timestamp, before/after or reason where relevant
SUBSCRIPTION_CREATED	actor/system, entity id, quote/customer context, timestamp, before/after or reason where relevant
SUBSCRIPTION_MODIFIED	actor/system, entity id, quote/customer context, timestamp, before/after or reason where relevant
CREDIT_NOTE_CREATED	actor/system, entity id, quote/customer context, timestamp, before/after or reason where relevant
INVOICE_CREATED	actor/system, entity id, quote/customer context, timestamp, before/after or reason where relevant
PAYMENT_RECORDED	actor/system, entity id, quote/customer context, timestamp, before/after or reason where relevant
DEAL_ALERT_CREATED	actor/system, entity id, quote/customer context, timestamp, before/after or reason where relevant
DEAL_ALERT_NUDGED	actor/system, entity id, quote/customer context, timestamp, before/after or reason where relevant
DEAL_ALERT_ESCALATED	actor/system, entity id, quote/customer context, timestamp, before/after or reason where relevant

16.2 Operational Logging
•	Structured server logs with request id/correlation id.
•	Business-rule errors include stable error code and entity id; avoid secrets.
•	Background job logs include job key, start/end, generated records and retry status.
•	Health endpoint reports application + database connectivity.
17. Seed Data for Development and Demo
Use deterministic seed data so the full demo can be reset quickly. The values below mirror the attached mockup where possible and fill implementation gaps needed for margin/routing tests.
Customer	Tier	Currency
Acme Corp	Gold	USD
Beta Industries	Silver	USD
Nova Retail	Bronze	USD
Zenith Co	Silver	USD
Orion Ltd	Gold	USD
Delta LLC	Bronze	USD

Product	Category	Price	Unit cost (demo)	Category limit	Billing
Laptop Pro 14	Hardware	$1,200	$850	15%	One-time
Onsite Setup Service	Services	$450	$220	10%	One-time service
Docking Station	Hardware	$180	$120	15%	One-time
Extended Warranty	Services	$180	$70	10% or configured	One-time/service
Care Plan 2yr	Subscription	$46 / month	$12	per configured category	Recurring
Support SLA	Subscription	$300 / quarter	$110	per configured category	Recurring
Wireless Mouse	Hardware	$35	$17	15%	Upsell

17.1 Q-1042 Canonical Approval Test
Line	Qty	Price	Discount	Allowed	Expected
Laptop Pro 14	2	$1,200	12%	15%	OK
Onsite Setup Service	1	$450	18%	10%	OVER +8 pp
Extended Warranty	1	$180	10%	configured limit	OK if within limit

Expected blended risk: HIGH under default v1 because max overage is 8 percentage points. Expected chain: Sales Manager → Finance. Use an approval audit history similar to Submitted → Returned (“Requested justification”) → Resubmitted (“Added margin note”) → Approved.
17.2 Warehouse Seed
Warehouse	SKU	On hand	Reserved	Available
Main Warehouse	Laptop Pro 14	40	18	22
East Depot	Laptop Pro 14	10	6	4
Main Warehouse	Docking Station	65	12	53

17.3 Billing / Health Seed
•	Acme Corp Care Plan 2yr: Monthly, next bill Sep 15, Active.
•	INV-1042: Acme Corp, $2,730, Unpaid, due Sep 10.
•	INV-1043 (Recurring): Acme Corp, $46, Paid, due/billed Sep 15.
•	Deal Health: Zenith Co idle 9 days → Nudge; Delta LLC discount 22% vs rep avg 8% → Escalate; three delivery promise dates at risk.
18. Acceptance Test Plan
18.1 Official Quick-test Flow
Step	Action	Pass criteria
1	Login and configure a discount tier, warehouse and subscription plan.	Configuration persists and is used by later calculations.
2	Create quote with product discount above allowed limit.	Line shows OVER immediately.
3	Submit quote.	System automatically creates Manager approval without rep manually selecting approver.
4	Accept an upsell suggestion.	Quote total/margin update immediately.
5	Approve quote and inspect fulfillment.	Stock comes from correct warehouse(s); split occurs if one warehouse cannot satisfy.
6	Include one-time + recurring lines.	One-time and recurring billing are separated but reconciled to same deal.
7	Customer requests larger discount in portal.	Accepted terms create new version and automatically re-enter approval if threshold exceeded.
8	Confirm, record payment, inspect invoice.	Invoice/payment status updates correctly; partial-delivery invoicing invariant holds.

18.2 Business-rule Test Matrix
Test	Scenario	Expected result
DISC-01	Gold 15%, Hardware 15%, discount 15%	No overage; no approval from this line.
DISC-02	Gold 15%, Services 10%, discount 18%	Overage 8 pp; default HIGH.
DISC-03	Three lines each 2–3 pp over	Blended logic detects cumulative risk; at least Manager approval.
APV-01	Medium risk submit	Manager step only.
APV-02	High risk submit	Manager then Finance; Finance blocked until Manager approves.
APV-03	Return + resubmit	Old cycle preserved; new version/cycle created.
NEG-01	Approved quote; customer proposes higher discount; rep accepts	Risk recalculated; new approval cycle if over threshold.
FUL-01	One warehouse has all stock	Suggest one warehouse with lowest cost.
FUL-02	No single warehouse enough but two together are	Suggest 2-warehouse split.
FUL-03	Insufficient total stock	Allocate available and create backorder remainder.
FUL-04	Stock changed before split acceptance	Revalidate; reject stale allocation and recompute.
INV-01	Ship 6 of 10 units	Maximum invoiceable stock qty = 6.
INV-02	Record partial payment	Status Partially Paid; remaining balance correct.
SUB-01	Upgrade mid-month	Positive prorated delta.
SUB-02	Downgrade/cancel mid-month	Negative adjustment/credit per policy.
SUB-03	Recurring billing job retried	No duplicate billing period invoice.
SEC-01	Customer calls internal approval API	403; no internal data returned.
SEC-02	Customer A guesses Customer B quote id	404/403 without existence leakage.
HLT-01	Quote idle beyond threshold	Stalled alert created once and counted.
HLT-02	Rep discount 22% vs avg 8% over configured delta	Discount anomaly alert created.

19. Build Plan and Dependency Order
 
Figure 3. Recommended implementation architecture; stack is technology-agnostic.
19.1 Recommended Technical Shape (Non-binding)
•	Frontend: modern SSR/SPA web framework; separate internal and portal layouts.
•	Backend: API/service layer that owns business-rule calculations and authorization.
•	Database: relational transactional database recommended because quotes, versions, approvals, inventory, subscriptions, invoices and audit have strong relationships/invariants.
•	Background jobs: recurring billing and periodic Deal Health scans; can be a simple scheduled process for hackathon scope.
•	File generation: PDF/XLS export service or server-side generation.
•	Notifications: in-app persistence first; email adapter optional.
19.2 Dependency Order
20.	Schema + seed + auth/RBAC
21.	Product/category/tier/pricelist/warehouse/plan configuration
22.	Quotation builder + price/margin/line-limit engine
23.	Blended risk + approval routing + audit/versioning
24.	Upsell panel
25.	Fulfillment suggestion/reservation/backorder
26.	Customer portal + negotiation + reapproval
27.	Hybrid billing + subscription/proration + invoice/payment
28.	Deal Health + dashboard/reporting
29.	Full acceptance run, polish, demo reset script
19.3 24-hour Sprint Template
Hours	Primary outcome
0–2	Project skeleton, DB schema/migrations, seed script, auth/RBAC, shared navigation.
2–6	Products/config + quotation list/detail + pricing/margin/discount limit.
6–9	Blended risk, approval list/detail, actions, audit/versioning.
9–12	Warehouse stock, suggestion, accept/override, shipment/backorder basics.
12–15	Customer portal negotiation, new quote version, reapproval.
15–18	Subscriptions, hybrid billing, proration, invoice/payment.
18–21	Dashboard, Deal Health, minimum reports, upsell polish.
21–24	Automated/manual acceptance tests, bug fixing, seeded demo reset, 5-minute rehearsal.

If time slips  Protect the vertical slice: quote → live discount violation → automatic approval → fulfillment split → customer counter → reapproval → invoice/payment. Reduce visual polish or optional exports before weakening this core workflow.

20. Five-minute Demo Script
Time	Demo action
0:00–0:30	Login as Sales Rep; dashboard shows pending approvals/open/at-risk. Open Q-1042 or create it.
0:30–1:15	In quotation builder, show Laptop 12% vs 15% OK and Setup Service 18% vs 10% OVER +8 pp. Add an upsell and show margin update.
1:15–2:00	Submit. Switch to Sales Manager approval detail; show “why flagged,” HIGH risk and audit. Approve Manager, then Finance.
2:00–2:40	Open Fulfillment. Show Main + East stock and recommended split; accept. If shortage scenario is seeded, show backorder.
2:40–3:35	Open customer portal. Request a larger discount and delivery change. As rep, accept proposal; show new version automatically re-enter approval.
3:35–4:20	Confirm latest terms. Show one-time and Care Plan recurring billing in same deal; demonstrate next bill date/proration entry.
4:20–4:45	Open invoice detail, show shipment-aware invoice and Record Payment; status changes.
4:45–5:00	Close on Deal Health/Reports: stalled, discount anomaly, delivery slippage; summarize “self-governing deal engine.”

21. Risks and Mitigations
Risk	Impact	Mitigation
Scope explosion	Many modules can become half-built.	Implement the single vertical slice first; P1/P2 are explicitly cuttable.
Ambiguous blended score	Different developers may implement different logic.	Use Section 8.4 v1 + configuration + tests.
Historical data corruption	Editing price/tier/quote after approval could rewrite past decisions.	Snapshot QuoteVersion commercial values and approval cycles.
Inventory race	Two orders can reserve same stock.	Reserve in transaction with revalidation/locking.
Billing inconsistency	Partial shipment or retry can over-invoice/duplicate.	Shipment invoice invariant + idempotency key per recurring period.
Portal data leak	Customer sees internal quote/risk data.	Dedicated DTO/API and ownership checks; never reuse internal response wholesale.
Fake-looking AI/intelligence	A chatbot distracts from core business logic.	Keep deterministic governance primary; add AI only as explainability/ranking enhancement.
Demo instability	Stateful flows hard to reset.	Seed/reset script and a canonical Q-1042 scenario; rehearse from clean database.

22. Definition of Done
•	☐ All P0 requirements implemented or explicitly waived with rationale.
•	☐ Quick-test flow passes from a clean seeded database.
•	☐ Q-1042 high-risk scenario produces expected Manager → Finance routing.
•	☐ Customer negotiation accepted after approval can create a new version and reapproval.
•	☐ Warehouse split uses actual availability; override/audit works; stock reservation cannot go negative.
•	☐ One-time and recurring lines stay linked to one deal; proration test produces expected adjustment.
•	☐ Stock goods cannot be invoiced above shipped quantity.
•	☐ Record Payment correctly drives Partially Paid/Paid state.
•	☐ Deal Health alerts derive from actual quote/activity data.
•	☐ Role/ownership authorization tests pass, especially customer portal isolation.
•	☐ Audit log is present for approvals, revisions, overrides, negotiation acceptance, invoice/payment actions.
•	☐ No core business result is a static demo constant tied to a specific customer/quote id.
•	☐ Five-minute demo has been rehearsed and a reset/seed command is documented.
•	☐ Architecture diagram and future-roadmap note are ready as hackathon deliverables.
Appendix A. Problem Statement → PRD Traceability
Source requirement	PRD coverage
Multi-tier discount governance + automated approval	DISC, APV, QUO, Section 8.3–8.5
Live upsell/cross-sell + margin impact	REC, QUO, Section 8.2
Multi-warehouse split + backorders	FUL, Section 8.7
Hybrid one-time + recurring billing	SUB, INV, Section 8.8–8.9
Deal health / anomaly alerts	HLT, Section 8.10
Customer portal negotiation	NEG, Section 8.6
Backend product/price list/config	PROD, DISC, FUL, SUB
Approval audit trail	APV, AUD
Proration / cancellation / credit	SUB
Dashboard/report filters and exports	DSH, RPT
Separate restricted customer portal	AUTH, NEG, SEC/NFR sections
Core logic not hardcoded/faked	Sections 4, 8, 18, 22
Working app + seed data	Sections 17, 22
Five-minute two-flow demo	Section 20
One-page architecture diagram	Figure 3 / Section 19

Appendix B. Glossary
Term	Definition
Quotation / Quote	Commercial proposal containing customer, products/services, quantities, prices, discounts and terms.
Quotation Version	Immutable snapshot of commercial terms used for approval/history.
Customer Tier	Commercial segment such as Bronze/Silver/Gold with a discount ceiling.
Category Ceiling	Maximum discount allowed for a product category.
Overage Points	Applied discount percentage minus allowed percentage, minimum zero; measured in percentage points.
Blended Risk	Quote-level risk derived from both severe individual overages and cumulative overage pattern.
Approval Cycle	Approval workflow attached to one submitted quotation version.
Fulfillment Split	Allocation of physical quantities across warehouses.
Backorder	Quantity not currently fulfillable from available stock.
Hybrid Billing	One logical order containing both one-time and recurring billable lines.
Proration	Charge/credit for a recurring plan change effective partway through a billing period.
Credit Note	Negative financial adjustment linked to invoice/subscription change.
Deal Health	Operational signals for stalled, unusually discounted or delivery-risk deals.
MRR	Monthly recurring revenue; useful future/reporting metric, not required core field.

End of PRD — DealFlow360 v1.0
