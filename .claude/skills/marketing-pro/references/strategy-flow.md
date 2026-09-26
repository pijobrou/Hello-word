# The 12-Part Strategy Flow

The methodology is the product. Every engagement runs the same 12 parts, produces the same
files in the same order, with explicit dependency rules between them — that is what makes
depth consistent across brands and handoffs auditable.

Full run: ~50–60 canonical files. On an Opus-class model a complete engagement is roughly a
60-minute session of sustained work. Do not promise that number to a client as a guarantee —
it is upstream's measurement (Opus 4.8), not a benchmark reproduced here.

## The parts

| Part | Name | Output |
|---|---|---|
| 1 | Client Inputs | Stone vs Opinion intake — what the client knows for certain vs what they believe |
| 2 | External Research | Unbiased market research. **No client documents are read in this part.** |
| 3 | **Four Core Documents** | 61 explicit steps: Business & SBU Analysis (18), Segmentation Framework (15), Brand Positioning & Communications (19), DMFlow (9) |
| 4 | Competitive + Customer + Market | 4 unbiased analysis documents (4.1–4.4) |
| 5 | **Client Validation Document** | The one true stop. 12–25 evidence-cited finding blocks, each awaiting ACCEPT / REJECT / EDIT / DEFER |
| 6 | Selective v2 Re-runs | The subset of Part 3 + Part 4 documents the Decision Matrix says must be re-run |
| 7 | Preparation Documents | Internal operating layer — campaign architecture, KPI tree, content pillars, asset inventory, approval chains |
| 8 | **Growth Plan + Yearly Planner** | The flagship deliverable: 11-section client-facing strategy (20–30 pages) + 12-month operational calendar |
| 9 | Channel Strategy Fan-out | Up to 17 channel documents in 7 families |
| 10 | Execution Artefacts | Ad copy, post copy, headlines, CTAs |
| 11 | AI Creative Instructions | Visual asset briefs carrying C2PA + EU AI Act Article 50 clauses |
| 12 | **Continuous Improvement Loop** | Quarterly brief feeding signals back into product and offering decisions |

## The five architectural rules

1. **Two-Views Model.** Every engagement carries v1 (unbiased market view) and v2
   (client-validated view) after Part 5. Operating decisions reference v2; ideation
   references both. **v1 is never deleted** — the point is that you never lose the original
   market read when the client pushes back.
2. **Stone vs Opinion.** Every fact captured at intake is tagged. *Stone* = the client knows
   it for certain. *Opinion* = the client believes it, which makes it a research question,
   not ground truth. Never silently promote an Opinion to a premise.
3. **Decision Matrix.** Maps each validation response in Part 5 to the v1 documents that need
   a v2 re-run. It exists to stop both over-running (wasted hours) and under-running (a
   strategy with a contradiction inside it).
4. **Update-Back Rule.** Live operations surface corrections → source documents get versioned
   (v2.1, v2.2 …) → the Living Project Instruction File propagates the change downstream.
5. **Living Project Instruction File.** One source of truth per engagement. Read it first,
   before any other file, at the start of every task.

## Part 5 is a stop, not a checkpoint

Do not run Part 6 onwards on assumed answers. If the client has not responded, produce the
validation document, say plainly that the engagement is parked at Part 5, and stop. Work that
depends on unvalidated findings is work you will throw away.

## Resumability and output layout

Long flows checkpoint per part so an interrupted run resumes at the next un-checkpointed part
instead of restarting at Part 1. Workflows that checkpoint upstream: `engagement`,
`campaign-plan`, `content-engine`, `seo-audit`, `competitor-analysis`, `campaign-audit`,
`launch-campaign`, plus a `custom` slot.

Without the upstream Python layer, keep the same discipline by hand:

```
<workspace>/marketing/<brand>/<workflow>/<YYYY-MM-DD>/
  00-run.md          run id, inputs, part status table (pending / done), resume point
  01-….md 02-….md    numbered artefacts, one per step — downstream steps read these,
                     never the endpoint, so any single step can be re-run
  PLAN.md            the endpoint deliverable
  scorecard.md       the quality gate verdict that let PLAN.md be called ready
```

Write the part status table **as you finish each part**, not at the end. A run that dies at
Part 7 with no status table has lost seven parts of work.

## Worked chains

Each chain is sequential unless marked parallel. Ask before fanning out expensive steps —
upstream calls this Confirm-Then-Dispatch, and it applies here: name the steps and their cost
before running them, never silently re-run a specialist.

**New-client onboarding (agency, week 1)**
```
brand-setup → competitor-analysis → [parallel: tech-seo-audit · aeo-audit · backlink-gap ·
gsc-ai-performance] → keyword-cluster → seo-plan (dispatcher: scores 4 pillars; the weakest
pillar drives Q1's lead theme)
```

**Quarterly business review**
```
gsc-ai-performance → seo-drift → branch by finding:
  high decline    → seo-audit + content-decay-scan
  high reshuffle  → aeo-geo (intent realignment)
  high growth     → content-engine (amplification briefs)
→ seo-plan (re-run with fresh inputs; the lead theme may shift pillar)
```

**Content production**
```
keyword-cluster → content-brief → content-engine → check (pre-publish gate)
→ publish-blog → c2pa-metadata (if EU markets are targeted and AI images accompany)
```

**Backlink campaign**
```
competitor-analysis → backlink-gap → digital-pr → pr-pitch
```

**Pre-publish, every time**
```
check → fix → check again. No exceptions for "small" assets.
```
