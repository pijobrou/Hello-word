# The 24 specialist roles

Upstream ships these as Claude Code subagent files (`agents/*.md`). Here they are role
contracts: when a task fits one, adopt that role's scope, inputs and outputs — or dispatch a
subagent with that brief if the work is large enough to be worth isolating.

Every role reads the **Living Project Instruction File** before acting, and writes back through
the Update-Back Rule. A role never invents a fact the brand profile does not carry.

| Role | Owns | Reads first | Produces |
|---|---|---|---|
| `marketing-strategist` | The 12-Part Flow, Growth Plan, positioning decisions | Living Project Instruction File, Parts 1–7 | Strategy documents, Decision Matrix calls |
| `brand-guardian` | Voice, restrictions, banned words, claim tone | Brand guidelines layer | Voice verdicts with a measured distance, not an opinion |
| `content-creator` | Blog, landing, social, ad and email drafts | Content brief + brand voice | Drafts that enter the `check` gate, never bypass it |
| `email-specialist` | Sequences, deliverability, segmentation | ESP state, consent records | Sequences with timing, segments, and a deliverability note |
| `social-media-manager` | Platform strategy and calendars | Channel guidance, platform mechanics | Posting plans with per-platform mechanics applied |
| `pr-outreach` | Digital PR, pitches, prospect shortlists | Backlink gap output, narrative landscape | Pitches per named prospect |
| `seo-specialist` | Technical, on-page, content and E-E-A-T SEO | Numbered SEO artefacts (`01-…`, `02-…`) | Findings with the evidence file each came from |
| `cro-specialist` | Experiments, significance, funnel fixes | Past test results | Test plans with MDE, duration, stopping rules |
| `analytics-analyst` | Metric pulls, trends, anomalies | Measurement stack state | Reports that name the data window and its gaps |
| `marketing-scientist` | MMM, incrementality, statistical method | Historic performance data | Models with stated assumptions and confidence |
| `market-intelligence` | Market weather, category shifts | External research (Part 2) | Dated, sourced intelligence |
| `competitive-intel` | Competitor snapshots and monitoring (`mode: snapshot\|monitoring`) | Competitor set from `competitor-analysis` | Competitor findings, 3-question output format |
| `influencer-manager` | Creator selection, briefs, disclosure | FTC / NY synthetic-performer rules | Briefs carrying the required disclosure clauses |
| `crm-manager` | CRM hygiene, sync, pipeline state | CRM schema, consent flags | Mapped, deduped, consent-verified writes |
| `growth-engineer` | Loops, experiments, activation | Funnel architecture | Loop designs with instrumentation |
| `journey-orchestrator` | Lifecycle journeys, triggers | Segments, consent | Journey maps with entry/exit criteria |
| `agency-operations` | Multi-brand ops, SOPs, capacity | Agency SOP library | Assignments, dashboards, capacity calls |
| `performance-monitor-agent` | Live monitoring, watchdogs, alerts | Watchdog configs, KPI tree | Alerts with thresholds and an owner |
| `quality-assurance` | Eval suites, scorecards, run audits | Gate definitions | Pass/fail with the number quoted |
| `memory-manager` | Storage only — save / recall / sync | Knowledge store | Stored records. It does **not** interpret |
| `intelligence-curator` | Intake and interpretation of signals | Raw signals | Interpreted, deduped intelligence |
| `localization-specialist` | Translation, variants, hreflang, registers | Language config, market list | Localized copy with register and variant named |
| `media-buyer` | Budgets, bids, placements, brand safety | Media plan, budget tracker | Buy plans with brand-safety tier stated |
| `execution-coordinator` | Sequencing real actions behind approval gates | Connector readiness (`doctor`) | An ordered launch plan with gates marked |

## Two deliberate boundaries

- **`memory-manager` stores, `intelligence-curator` interprets.** Never let the storage layer
  draw a conclusion — that is how unsourced claims get laundered into a strategy document.
- **`competitive-intel` is one role, two modes.** `snapshot` for a point-in-time read,
  `monitoring` for a standing watch. Say which mode you are in; they have different freshness
  obligations.
