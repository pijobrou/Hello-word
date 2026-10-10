# Agent Instructions

You're working on the **BVY Accounting & Tax Services** platform inside the **WAT framework** (Workflows, Agents, Tools).

BVY is not designed to replace QuickBooks Online for clients who already use QBO. BVY is the intelligence, workflow, communication, and client-experience layer that sits above accounting data.

The platform must solve two core problems:

1. Clients often do not understand their accounting information or know what requires attention.
2. Accounting staff often lose time figuring out what needs to be done, what is missing, what is urgent, and where to work next.

BVY must make accounting **simple to understand, easy to act on, beautiful to use, and fast to navigate**.

---

## The BVY Product Principle

For clients who use **QuickBooks Online**:

- QuickBooks Online remains the accounting system of record.
- Accounting work is performed in QBO.
- BVY reads and synchronizes the useful accounting data.
- BVY identifies what needs attention.
- BVY explains accounting information in simple language.
- BVY creates tasks, alerts, document requests, validations, and summaries.
- BVY must provide direct links to the client's QuickBooks Online account whenever appropriate.
- When possible, a task, invoice, transaction, or accounting issue should include an **Open in QuickBooks** action.
- After work is completed in QBO, BVY synchronizes the updated information.

For clients who do **not** use QuickBooks Online:

- BVY may use its own accounting database.
- BVY may receive revenue, expense, banking, document, tax, and bookkeeping information directly.
- BVY may support internal accounting workflows and financial statements.

**Never design BVY as a second QuickBooks for QBO clients.**

BVY should answer these questions quickly:

- Where does my business stand?
- Is there a problem?
- What changed?
- What do I need to do?
- What is BVY doing for me?
- Where do I go if I want to see the detailed accounting?

---

## Brand and Visual Identity

The existing BVY visual identity must be preserved.

**Primary brand colors:**
- BVY plum / purple
- BVY gold

**Supporting colors:**
- White and neutral tones may be used only to improve readability and accessibility.

**Do not replace the brand colors.**

The interface must feel:
- premium
- elegant
- modern
- professional
- calm
- highly readable
- simple

The client portal must never feel like a dense accounting application.

---

## The WAT Architecture

**Layer 1: Workflows (The Instructions)**
- Markdown SOPs stored in `workflows/`
- Each workflow defines the objective, required inputs, tools, validation rules, expected outputs, errors, edge cases, and acceptance criteria
- Workflows are written clearly enough that a human team member could follow them

**Layer 2: Agents (The Decision-Makers)**
- Agents coordinate work and make context-based decisions
- Agents read the relevant workflow before executing a task
- Agents select the correct tools
- Agents must respect approval gates
- Agents must not bypass required human validation
- Agents handle failures and escalate when required
- Agents do not perform deterministic execution when a tool should do it

**Layer 3: Tools (The Execution)**
- Deterministic scripts and services stored in `tools/`
- Tools perform API calls, database operations, file processing, synchronization, deployment, testing, notifications, and other repeatable work
- Secrets are stored only in `.env` or an approved secrets manager
- Tools must be testable, reusable, and idempotent where practical

---

## Mandatory Development Rule: Website First

The **very first deliverable is the public BVY website**.

Do not build the full portal, accounting workflows, QBO integration, AI agents, or production backend before the website has been presented for owner validation.

The website is the first design and positioning checkpoint for the entire platform.

### Why the website comes first

The website validates:
- visual identity
- brand positioning
- value proposition
- language
- information hierarchy
- user experience
- service presentation
- how BVY explains QuickBooks Online
- how BVY explains its platform
- the future design language of the client portal

The approved website becomes the visual foundation for the BVY design system.

---

## Workflow 00: Build the BVY Website

The first workflow must be:

`workflows/00_create_bvy_website.md`

### Objective

Create a complete first version of the public BVY website using the existing plum/purple and gold brand identity.

### Required pages

**1. Home**
- Explain what BVY is
- Explain the accounting frustrations BVY solves
- Present the main benefits
- Present a clear call to action
- Show that BVY makes accounting easier to understand

**2. Services**
Include:
- Bookkeeping
- Payroll
- GST/QST
- Corporate tax
- Self-employed tax workflows where applicable
- Accounting support
- BVY platform access

**3. BVY Platform**
Explain:
- dashboard
- tasks
- financial overview
- documents
- alerts
- financial health
- communication
- workflow visibility
- QuickBooks connection
- direct QuickBooks access

**4. How It Works**
Show a simple process:
1. Client joins BVY
2. QBO is connected or data is imported
3. BVY analyzes the information
4. BVY identifies tasks, issues, and missing information
5. BVY explains the situation clearly
6. Accounting work is completed in QBO when QBO is used
7. BVY synchronizes the result
8. Client sees the updated status

**5. Pricing or Request a Quote**
Use whichever commercial model is approved.

**6. Contact / Book a Consultation**
Simple lead form.

**7. Login**
A visible login entry point for the future client portal.

---

## Mandatory Owner Approval Gate

When the first website version is complete, **stop development**.

The system must return:

`STATUS: WAITING_FOR_OWNER_APPROVAL`

The review package must include:
- preview URL
- desktop screenshots
- mobile screenshots
- list of pages
- design system summary
- UX summary
- known limitations
- next proposed step

The project must not move to the application build until the owner explicitly responds with:

`STATUS: APPROVED`

### If changes are requested

Use:

`STATUS: CHANGES_REQUESTED`

Then:
1. collect requested changes
2. update the website
3. redeploy preview
4. present the revised version
5. return to `WAITING_FOR_OWNER_APPROVAL`

### If rejected

Use:

`STATUS: REJECTED`

Do not proceed with downstream development.

---

## Website Acceptance Criteria

The website is not ready for approval unless it has:

- BVY logo
- BVY plum/purple brand color
- BVY gold brand color
- strong readability
- modern responsive design
- mobile layout
- desktop layout
- clear navigation
- visible CTAs
- clear explanation of the problem BVY solves
- clear explanation of the BVY platform
- clear explanation of QBO's role
- premium visual quality
- simple language
- minimal unnecessary accounting jargon
- good performance
- basic accessibility
- consistent design components
- visual compatibility with the future client portal

---

## Core BVY Positioning

The platform should communicate this idea clearly:

> BVY transforms accounting information into clear, prioritized, understandable information so business owners can quickly understand where their business stands and what requires attention.

For QBO clients:

> Your accounting stays in QuickBooks Online. BVY makes it easier to understand, easier to manage, and easier to act on, with direct access back to QuickBooks whenever needed.

---

## Workflow 01: Design System

After the website is approved, create:

`workflows/01_design_system.md`

The approved website becomes the source for the application design system.

Define:
- color tokens
- typography
- spacing
- buttons
- cards
- alerts
- forms
- tables
- badges
- navigation
- modals
- empty states
- loading states
- errors
- charts
- mobile patterns
- accessibility rules

Do not invent a new visual identity for the portal.

---

## Workflow 02: Authentication and Roles

Create:

`workflows/02_auth_roles.md`

Primary roles:
- BVY Administrator
- Lead Accountant
- Bookkeeper
- Payroll
- Tax
- Client

Use role-based access control.

Each role must see only what is required for that role.

---

## Workflow 03: Client Portal

The client portal must be extremely easy to understand.

A client should understand the important information within approximately 30 seconds.

### Main client questions

The portal should answer:
- How much cash do I have?
- How much money is owed to me?
- How much do I owe?
- What changed?
- Is anything wrong?
- What do I need to do?
- What is BVY currently working on?
- Where can I see more detail?

### Recommended main navigation

- Home
- To Do
- My Finances
- Invoices
- Documents
- Taxes
- Reports
- Messages
- QuickBooks ↗

For QBO clients, **QuickBooks ↗ must be easy to find**.

---

## Client Dashboard

The client dashboard should prioritize clarity over information density.

### Suggested blocks

**Cash Available**
Current cash or treasury balance.

**Money to Receive**
Outstanding customer invoices or receivables.

**Money to Pay**
Upcoming obligations or payables.

**Financial Health**
Use understandable states such as:
- Good
- Watch
- Action Required

Always explain why.

**To Do**
Examples:
- Validate a transaction
- Upload a missing invoice
- Answer a bookkeeping question
- Approve payroll hours

**What Changed**
Show only important changes:
- Revenue
- Expenses
- Outstanding invoices
- Taxes
- Cash position

**BVY Is Working On**
Show the client progress of the accounting work.

Example:
- Bookkeeping: 85%
- Bank reconciliation: 65%
- GST/QST: waiting for bookkeeping
- Payroll: up to date

This reduces the frustration of not knowing what the accountant is doing.

---

## UX Rule: Progressive Disclosure

Never show the client all accounting complexity at once.

Use four information levels:

**Level 1: Summary**
- cash
- revenue
- expenses
- tasks
- alerts

**Level 2: Explanation**
Explain what changed and why it matters.

**Level 3: Accounting Detail**
Allow detailed reports, transaction lists, and statements.

**Level 4: QuickBooks**
Allow the client to open QBO when they want full source-level detail.

---

## Plain-Language Accounting

Avoid unnecessary accounting terminology in the main client experience.

Prefer:
- Money available
- Money customers owe you
- Bills to pay
- Documents needed
- Actions needed
- Taxes
- What changed

Instead of forcing terms such as:
- Accounts receivable aging
- Current liabilities
- General ledger
- Journal entry
- Chart of accounts

Technical terminology may still exist in detailed views for users who need it.

---

## QuickBooks Online Functional Rule

For QBO clients:

**QBO is the accounting source of truth.**

BVY may:
- read data
- synchronize data
- analyze data
- explain data
- detect issues
- create tasks
- create alerts
- request information
- generate summaries
- link users back to QBO

At launch, avoid performing sensitive accounting changes automatically in QBO unless a workflow explicitly allows it.

### Recommended QBO flow

QBO  
↓  
BVY synchronization  
↓  
Analysis  
↓  
Task / Alert / Summary  
↓  
User opens the item  
↓  
Open in QuickBooks  
↓  
Accounting work completed in QBO  
↓  
BVY synchronization  
↓  
Task/status updated

---

## Workflow 04: QuickBooks Connection

Create:

`workflows/04_quickbooks_connection.md`

It must cover:
- OAuth
- company connection
- token refresh
- connection status
- permissions
- disconnect
- sync status
- sync failures
- entity mapping
- last sync time
- deep links when available
- security
- audit logging

The client portal should display:
- QBO connection status
- last sync time
- button: `Open QuickBooks`

Where practical, individual tasks should also offer:
- `View in QuickBooks`
- `Open in QuickBooks`

---

## Workflow 05: BVY Work Queue

Create:

`workflows/05_work_queue.md`

The staff dashboard must make it obvious what to work on next.

Suggested task states:
- Urgent
- Today
- This Week
- Waiting for Client
- Waiting for Staff
- Blocked
- Completed

Each task should include:
- client
- priority
- deadline
- owner
- type
- current status
- source
- QBO link if applicable

---

## Workflow 06: Anomalies

Create:

`workflows/06_anomalies.md`

### Standard anomalies
- duplicate transaction
- unusual transaction
- uncertain category
- missing document

### System anomalies
- QBO disconnected
- synchronization failed
- import incomplete
- missing data

### Urgent anomalies
- dangerous cash position
- tax deadline approaching
- major overdue invoice
- payroll risk
- important compliance deadline

Each anomaly must have:
- severity
- explanation
- owner
- recommended action
- status
- resolution
- history

---

## Workflow 07: AI Classification

Create:

`workflows/07_ai_classification.md`

The AI may consider:
- vendor
- transaction description
- amount
- client history
- previous account used
- transaction type
- historical client decisions

Example:

Transaction: $134.52  
Merchant: Bell Canada  
Suggested account: Telecommunications  
Confidence: 97%

Example policy:
- 95–100%: automatic only if the workflow allows it
- 75–94%: suggestion
- Below 75%: validation required

Confidence thresholds must be configurable.

---

## Workflow 08: Client Validation

Create:

`workflows/08_client_validation.md`

If information is ambiguous, ask the client a simple business question.

Example:

> We found a Costco payment of $842.37. Was this a business expense?

Actions:
- Yes, business expense
- No, personal
- Other

Do not force the client to know accounting account codes.

---

## Workflow 09: Documents

Create:

`workflows/09_documents.md`

The document center must support:
- upload
- classification
- OCR
- extraction
- linking
- search
- transaction association
- client requests
- status

Suggested flow:

Document  
↓  
OCR  
↓  
Identification  
↓  
Extraction  
↓  
Client assignment  
↓  
Transaction association  
↓  
Review if required

---

## Workflow 10: Communication

Create:

`workflows/10_communication.md`

BVY should reduce scattered accounting communication.

Centralize:
- requests
- client replies
- messages
- documents
- notifications
- reminders

The client should not need to search email, text messages, WhatsApp, and calls to understand what BVY needs.

---

## Workflow 11: Bookkeeping

Create:

`workflows/11_bookkeeping.md`

The bookkeeping workspace should show:
- assigned clients
- work queue
- transactions to validate
- missing documents
- reconciliations
- client questions
- anomalies
- QBO links

For QBO clients, staff should be able to move from BVY directly into the correct QuickBooks workspace.

---

## Workflow 12: Payroll

Create:

`workflows/12_payroll.md`

Suggested payroll states:
- Waiting for data
- Hours received
- Validation required
- In preparation
- Ready
- Completed

Permissions must remain separate from general bookkeeping access where appropriate.

---

## Workflow 13: GST / QST

Create:

`workflows/13_sales_taxes.md`

Suggested workflow:

Bookkeeping complete  
↓  
Accounting validation  
↓  
GST/QST calculation  
↓  
Review  
↓  
Approval  
↓  
Filing

Never show a return as ready if prerequisite bookkeeping is incomplete.

---

## Workflow 14: Income Tax

Create:

`workflows/14_income_tax.md`

Planned modules may include:
- T2
- CO-17
- schedules
- tax adjustments
- tax depreciation
- book-to-tax reconciliation
- T1 / T2125 for self-employed clients where applicable

---

## Workflow 15: Financial Health

Create:

`workflows/15_financial_health.md`

Do not create arbitrary financial scores without explanation.

Prefer clear states:
- Good
- Watch
- Action Required

Possible indicators:
- cash position
- profitability
- receivables
- expenses
- taxes
- payroll
- upcoming obligations

Every status must have an explanation.

---

## Workflow 16: Automated Summaries

Create:

`workflows/16_reporting.md`

BVY may generate:
- monthly summary
- quarterly summary
- annual summary
- important changes
- issues to watch
- client tasks
- BVY actions completed

Summaries must use plain business language.

---

## Staff Portal

The staff portal is for productivity, not marketing.

Suggested command center:

- Urgent issues
- Clients requiring action
- Transactions to review
- Missing documents
- Client responses
- Bank reconciliations
- GST/QST
- Payroll
- Tax
- Blocked work

The system should make it obvious what the staff member should do next.

---

## Lead Accountant / Admin Dashboard

The lead accountant or administrator should have a global view.

Suggested indicators:
- total clients
- urgent cases
- clients at risk
- bookkeeping tasks
- payroll tasks
- tax tasks
- GST/QST tasks
- missing documents
- QBO connection failures
- staff workload

---

## Client 360 View

For each business, show:

- business identity
- overall status
- QBO connection
- last synchronization
- tasks
- anomalies
- documents
- messages
- finances
- transactions
- invoices
- payroll
- taxes
- history

For QBO clients, always provide direct access back to QuickBooks.

---

## Internal Accounting for Non-QBO Clients

For clients without QBO, BVY may provide internal accounting capabilities.

Suggested flow:

Bank / CSV / Document  
↓  
BVY import  
↓  
Classification  
↓  
Validation  
↓  
Accounting  
↓  
Reconciliation  
↓  
Financial statements

The client experience should remain consistent whether the underlying accounting source is QBO or the BVY internal database.

---

## Core Data Model

### Identity
- organizations
- users
- roles
- permissions

### Clients
- clients
- businesses
- contacts

### Integrations
- integrations
- quickbooks_connections
- sync_jobs

### Accounting
- accounts
- transactions
- journal_entries
- journal_entry_lines
- invoices
- bills
- payments
- bank_accounts
- bank_transactions
- reconciliations

### Workflows
- tasks
- task_assignments
- workflow_templates
- workflow_instances
- deadlines
- approvals

### AI
- ai_classifications
- ai_recommendations
- ai_explanations
- ai_confidence_scores
- ai_feedback

### Anomalies
- anomalies
- anomaly_types
- anomaly_severity
- anomaly_status

### Communication
- messages
- notifications
- client_requests
- client_responses

### Documents
- documents
- attachments
- document_extractions
- document_links

### Audit
- audit_logs

All important accounting and workflow actions must be auditable.

---

## Technical Architecture

Target architecture:

```text
                         BVY
                          │
             ┌────────────┴────────────┐
             │                         │
        Public Website            BVY Application
             │                         │
             └────────────┬────────────┘
                          │
                       Frontend
                          │
                         API
                          │
       ┌──────────────────┼──────────────────┐
       │                  │                  │
 Workflow Engine       AI Engine          Auth/RBAC
       │                  │                  │
       └──────────────────┼──────────────────┘
                          │
                       Database
                          │
          ┌───────────────┼───────────────┐
          │               │               │
    QuickBooks API     Documents          n8n
```

---

## Recommended Repository Structure

```text
bvy-platform/
│
├── workflows/
│   ├── 00_create_bvy_website.md
│   ├── 01_design_system.md
│   ├── 02_auth_roles.md
│   ├── 03_client_portal.md
│   ├── 04_quickbooks_connection.md
│   ├── 05_work_queue.md
│   ├── 06_anomalies.md
│   ├── 07_ai_classification.md
│   ├── 08_client_validation.md
│   ├── 09_documents.md
│   ├── 10_communication.md
│   ├── 11_bookkeeping.md
│   ├── 12_payroll.md
│   ├── 13_sales_taxes.md
│   ├── 14_income_tax.md
│   ├── 15_financial_health.md
│   └── 16_reporting.md
│
├── tools/
│   ├── website/
│   ├── quickbooks/
│   ├── database/
│   ├── documents/
│   ├── notifications/
│   ├── ai/
│   ├── tests/
│   └── deployment/
│
├── agents/
│   ├── orchestrator/
│   ├── bookkeeping/
│   ├── payroll/
│   ├── tax/
│   ├── financial_analysis/
│   └── client_support/
│
├── apps/
│   ├── website/
│   ├── client-portal/
│   └── staff-portal/
│
├── packages/
│   ├── design-system/
│   ├── auth/
│   ├── qbo/
│   └── shared/
│
├── .tmp/
├── .env
├── CLAUDE.md
└── README.md
```

---

## How to Operate

**1. Read the workflow first**
Before taking action, identify and read the correct workflow.

**2. Check for existing tools**
Before building a new script, inspect `tools/`.

**3. Respect approval gates**
Never continue past a mandatory owner, accountant, or client approval step.

**4. Keep QBO as the source of truth for QBO clients**
Do not duplicate or independently overwrite accounting truth in BVY.

**5. Prefer direct QBO navigation**
If the user needs to perform detailed accounting work, make the path into QBO obvious.

**6. Use simple language for clients**
Technical accounting terminology belongs in detailed or staff views, not the main client dashboard.

**7. Fail safely**
If a sync, API, classification, or automation fails:
- capture the error
- stop unsafe downstream actions
- show the correct status
- retry only when appropriate
- escalate when required

**8. Test deterministic execution**
API, data, sync, database, and transformation logic should be implemented and tested in tools.

**9. Keep workflows current**
When a reliable improvement is discovered, update the relevant workflow after validation.

---

## Human Approval Rules

### Owner approval required for:
- first website version
- major brand changes
- main design system
- major client UX changes
- production launch

### Accountant approval required for:
- sensitive accounting entries
- close adjustments
- important corrections
- tax filing readiness
- regulated accounting actions

### Client approval required for:
- ambiguous transactions
- missing business context
- payroll information when applicable
- authorizations
- requested confirmations

---

## Development Sequence

**Phase 0 — Public Website**
1. Build website
2. Apply BVY brand
3. Make responsive
4. Deploy preview
5. Present for validation
6. Stop
7. Wait for approval

`STATUS: WAITING_FOR_OWNER_APPROVAL`

Only continue after:

`STATUS: APPROVED`

**Phase 1 — Design System**
Use the approved website as the visual source.

**Phase 2 — Authentication and Roles**

**Phase 3 — Client Portal MVP**
- dashboard
- to do
- documents
- messages
- reports
- QBO access

**Phase 4 — QuickBooks Integration**
- OAuth
- synchronization
- status
- entities
- QBO links

**Phase 5 — Staff Portal**
- client list
- work queue
- tasks
- anomalies
- QBO access

**Phase 6 — AI**
- classification
- anomaly detection
- explanations
- summaries

**Phase 7 — Payroll / GST-QST / Tax**

**Phase 8 — Advanced Automation**

---

## MVP Definition

### Website MVP
- complete public website
- BVY identity
- responsive layout
- homepage
- services
- BVY platform page
- how it works
- contact
- login placeholder
- preview deployment

### Client Portal MVP
- authentication
- client role
- dashboard
- to-do list
- documents
- messages
- reports
- QBO connection
- Open QuickBooks button
- basic synchronization

### Staff MVP
- client list
- task queue
- status
- anomalies
- QBO links

Do not overbuild the first release.

---

## Problems BVY Must Eliminate

| Client / Staff Frustration | BVY Response |
|---|---|
| I don't understand my accounting | Plain-language dashboard |
| I don't know how my business is doing | Financial overview |
| I don't know what I need to do | To Do |
| I don't know what my accountant is doing | Work progress |
| I can't find my documents | Document center |
| I keep answering the same questions | History + workflow |
| I discover issues too late | Alerts |
| Reports are too technical | Explanations |
| I have to search through QBO | Direct QBO links |
| There is too much information | Progressive disclosure |
| Staff don't know what to prioritize | Work Queue |
| I don't know where my file stands | Visible status |

---

## Core UX Principle

A client with very little accounting knowledge should be able to use BVY without training.

Every important screen should answer:

1. What am I looking at?
2. Why does it matter?
3. Do I need to do something?
4. What should I click next?

If a screen does not answer those four questions clearly, simplify it.

---

## The Self-Improvement Loop

Every failure should make the system stronger:

1. Identify what failed
2. Determine whether the workflow, tool, data, integration, or assumption caused the failure
3. Fix the deterministic tool when appropriate
4. Retest
5. Update the workflow after validation
6. Add regression coverage where practical
7. Continue with a more robust system

---

## Bottom Line

BVY must not overwhelm clients with more accounting data.

BVY must show **less information, but the right information, at the right time, in language the client understands**.

The operating model is:

```text
Accounting Data
      ↓
     BVY
      ↓
Understand
      ↓
Prioritize
      ↓
Act
      ↓
QBO or BVY Workflow
```

The first thing you build is the **BVY public website**.

When the website is ready, stop and return:

`STATUS: WAITING_FOR_OWNER_APPROVAL`

Do not start the full application until the owner explicitly approves it.

Stay pragmatic. Stay reliable. Keep the client experience simple.
