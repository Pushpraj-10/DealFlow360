# CLAUDE.md

## Project Development Rules

This project uses a **feature/module-based architecture**.

The primary goal is to keep each feature self-contained, easy to understand, and easy to modify.

Do not overengineer the application. Build the simplest implementation that satisfies the requirement.

---

# 1. Feature-Based Structure

Every major application feature MUST live inside its own directory under:

```text
src/modules/
```

Each feature should follow this structure:

```text
src/
└── modules/
    ├── feature1/
    │   ├── feature1.router.js
    │   ├── feature1.controller.js
    │   ├── feature1.service.js
    │   └── feature1.repository.js
    │
    ├── feature2/
    │   ├── feature2.router.js
    │   ├── feature2.controller.js
    │   ├── feature2.service.js
    │   └── feature2.repository.js
    │
    └── feature3/
        ├── feature3.router.js
        ├── feature3.controller.js
        ├── feature3.service.js
        └── feature3.repository.js
```

Replace `feature1`, `feature2`, etc. with the actual feature name.

For example:

```text
src/
└── modules/
    ├── auth/
    │   ├── auth.router.js
    │   ├── auth.controller.js
    │   ├── auth.service.js
    │   └── auth.repository.js
    │
    ├── users/
    │   ├── users.router.js
    │   ├── users.controller.js
    │   ├── users.service.js
    │   └── users.repository.js
    │
    └── deals/
        ├── deals.router.js
        ├── deals.controller.js
        ├── deals.service.js
        └── deals.repository.js
```

---

# 2. Responsibility of Each File

Each layer has a specific responsibility.

## Router

```text
feature.router.js
```

Responsible for:

* Defining HTTP routes.
* Connecting routes to controllers.
* Applying route-specific middleware.
* Request validation middleware when appropriate.

The router should NOT contain business logic.

Example:

```javascript
router.post("/", validateDeal, dealController.createDeal);
router.get("/", dealController.getDeals);
router.get("/:id", dealController.getDeal);
```

---

## Controller

```text
feature.controller.js
```

Responsible for:

* Receiving HTTP requests.
* Reading params, query, body, and authenticated user information.
* Calling the appropriate service.
* Returning HTTP responses.
* Translating service errors into appropriate HTTP responses when necessary.

Controllers should remain thin.

Do NOT put business logic inside controllers.

Example:

```javascript
async function createDeal(req, res) {
    const deal = await dealService.createDeal(req.body, req.user);

    return res.status(201).json(deal);
}
```

---

## Service

```text
feature.service.js
```

Responsible for:

* Business logic.
* Business rules.
* Orchestrating repositories and other services.
* Validating business-level conditions.
* Coordinating multiple operations.

Example:

```javascript
async function createDeal(data, user) {
    const existingDeal = await dealRepository.findByName(data.name);

    if (existingDeal) {
        throw new Error("Deal already exists");
    }

    return dealRepository.create({
        ...data,
        createdBy: user.id
    });
}
```

The service should NOT deal directly with HTTP request/response objects.

---

## Repository

```text
feature.repository.js
```

Responsible for:

* Database operations.
* Queries.
* Persistence.
* Fetching and storing data.

Example:

```javascript
async function findById(id) {
    return Deal.findById(id);
}

async function create(data) {
    return Deal.create(data);
}
```

The repository should NOT contain business rules.

---

# 3. Dependency Direction

Prefer this dependency flow:

```text
Router
   ↓
Controller
   ↓
Service
   ↓
Repository
   ↓
Database
```

Do not reverse these dependencies.

For example:

```text
Repository → Service
```

should generally NOT happen.

Similarly:

```text
Service → Controller
Controller → Router
Repository → Controller
```

should NOT happen.

---

# 4. Feature Isolation

A feature should contain everything primarily related to that feature.

For example:

```text
modules/
└── deals/
    ├── deals.router.js
    ├── deals.controller.js
    ├── deals.service.js
    └── deals.repository.js
```

Avoid scattering deal-related logic across unrelated directories.

Prefer:

```text
modules/deals/deals.service.js
```

over:

```text
services/dealService.js
```

when the service is only used by the deals feature.

---

# 5. Shared Code

Not everything needs to be inside a feature.

Application-wide functionality can live under:

```text
src/
├── modules/
├── middleware/
├── config/
├── utils/
└── ...
```

Examples:

```text
src/
├── config/
│   └── database.js
│
├── middleware/
│   ├── auth.middleware.js
│   └── error.middleware.js
│
├── utils/
│   ├── logger.js
│   └── response.js
│
└── modules/
    ├── auth/
    ├── users/
    └── deals/
```

Only create shared code when it is genuinely shared.

Do NOT move code into `utils`, `helpers`, `common`, or `shared` just because it is convenient.

---

# 6. Don't Overengineer

This is a hackathon project.

The priority is:

```text
Working Feature
      ↓
Demo-Ready
      ↓
Readable
      ↓
Maintainable
      ↓
Highly Optimized
```

Do NOT optimize for hypothetical future requirements.

Avoid creating:

* Abstract base classes.
* Unnecessary interfaces.
* Factories without a real need.
* Dependency injection frameworks.
* Multiple abstraction layers.
* Generic repositories.
* Generic services.
* Event buses when direct calls are sufficient.
* Microservices.
* Separate infrastructure for simple functionality.
* Complex design patterns just to follow a pattern.

If a feature can be implemented cleanly in four files, use four files.

---

# 7. File Creation Rules

When creating a new feature, start with:

```text
src/modules/<feature>/
├── <feature>.router.js
├── <feature>.controller.js
├── <feature>.service.js
└── <feature>.repository.js
```

However, do NOT blindly create every file if a layer is genuinely unnecessary.

For example, if a simple feature has no database interaction:

```text
src/modules/health/
├── health.router.js
├── health.controller.js
└── health.service.js
```

is preferable to creating an empty repository.

Likewise, don't create a service containing one trivial line merely to satisfy the architecture.

The architecture is a guideline for separation of responsibilities, not a requirement to create meaningless files.

---

# 8. Adding a New Feature

When implementing a new feature:

### Step 1 — Create the module

```text
src/modules/<feature>/
```

### Step 2 — Create the necessary layers

```text
<feature>.router.js
<feature>.controller.js
<feature>.service.js
<feature>.repository.js
```

Only create layers that are actually needed.

### Step 3 — Implement bottom-up

Prefer:

```text
Repository
    ↓
Service
    ↓
Controller
    ↓
Router
```

### Step 4 — Register the router

Register the feature router in the application's routing layer.

For example:

```javascript
app.use("/api/deals", dealsRouter);
```

---

# 9. Naming Convention

Use consistent naming.

Directories:

```text
kebab-case
```

or project-established naming conventions.

Files:

```text
<feature>.router.js
<feature>.controller.js
<feature>.service.js
<feature>.repository.js
```

Examples:

```text
deal-flow/
deal-flow.router.js
deal-flow.controller.js
deal-flow.service.js
deal-flow.repository.js
```

Use descriptive names.

Avoid:

```text
helper.js
common.js
misc.js
stuff.js
manager.js
handler.js
```

unless the responsibility is genuinely clear from the name.

---

# 10. Cross-Feature Dependencies

Features may use functionality from another feature when necessary.

Example:

```text
deals.service.js
      ↓
users.service.js
```

However, avoid creating tightly coupled features.

If multiple features repeatedly need the same functionality, consider extracting the genuinely shared functionality into an appropriate shared module.

Do not prematurely create shared abstractions.

---

# 11. Database Access

Database access should normally happen through repositories.

Prefer:

```text
controller
    ↓
service
    ↓
repository
    ↓
database
```

Avoid database queries directly inside controllers.

Avoid database queries directly inside routers.

Business rules should remain in services rather than repositories.

---

# 12. Error Handling

Use the project's existing error-handling mechanism.

Do not create a new error-handling architecture for every feature.

Prefer a centralized error middleware when using Express:

```text
controller
    ↓
throw/forward error
    ↓
central error middleware
    ↓
HTTP response
```

Keep error handling simple and consistent.

---

# 13. Validation

Validate input at the appropriate boundary.

Basic request validation should generally happen before business logic executes.

For example:

```text
Request
   ↓
Validation
   ↓
Controller
   ↓
Service
   ↓
Repository
```

Do not duplicate the same validation unnecessarily across every layer.

Business-critical rules should still be enforced by the service.

---

# 14. AI Features

For AI/LLM functionality, keep the implementation simple.

Do not create an elaborate agent architecture unless the feature actually requires it.

Prefer:

```text
AI feature
    ↓
AI service
    ↓
LLM provider
```

If multiple AI operations belong to one feature, keep them inside that feature initially.

Only extract a shared AI abstraction when there is a concrete need.

---

# 15. Existing Code Comes First

Before creating new architecture:

1. Inspect the existing project.
2. Understand the current conventions.
3. Reuse existing utilities and patterns.
4. Follow the established structure where reasonable.
5. Avoid refactoring unrelated code.

Do not rewrite the project architecture simply because a different architecture looks cleaner.

---

# 16. Implementation Strategy

When asked to implement a feature:

1. Understand the requirement.
2. Inspect relevant existing code.
3. Identify the affected module.
4. Create only the necessary files.
5. Implement the smallest working solution.
6. Integrate it with the application.
7. Test the critical path.
8. Fix obvious issues.
9. Stop.

Do not continue refactoring after the feature works unless the refactoring is necessary for correctness or maintainability.

---

# 17. Definition of Done

A feature is considered done when:

* The requested functionality works.
* The main user flow works end-to-end.
* The code follows the module structure.
* There are no obvious runtime errors.
* Basic error handling exists.
* Critical input is validated.
* The feature is integrated into the application.
* The project builds/runs successfully.

Perfect architecture is NOT a requirement.

---

# Core Principle

> **Build the solution, not the architecture around the solution.**

Use good engineering practices, but do not build abstractions for problems that do not exist.

Prefer:

```text
Simple + Working + Understandable
```

over:

```text
Complex + Generic + Future-Proof
```

The architecture should help us move faster, not slow us down.
