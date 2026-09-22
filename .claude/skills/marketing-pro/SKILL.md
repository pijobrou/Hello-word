---
name: marketing-pro
description: >-
  Marketing Pro — run marketing work the way an agency does: brand setup, the 12-Part Strategy
  Flow (Stone vs Opinion intake → research → Four Core Documents → client validation → Growth
  Plan + yearly planner → channel fan-out), campaign and media plans, content production with a
  pre-publish quality gate, SEO plus six-surface AEO/GEO audits, attribution and performance
  reporting, and 16-jurisdiction compliance including EU AI Act Article 50 / C2PA. Use for
  "build a marketing strategy", "set up a brand", "run a full engagement", "write a campaign
  plan", "audit our SEO", "are we visible in ChatGPT and AI Overviews", "write this blog post /
  ad / email sequence", "check this before we publish", "is this GDPR / AI Act compliant",
  "quarterly marketing report", "competitor analysis", "which marketing skill should I use".
  Carries a catalogue of 163 marketing capabilities and 24 specialist roles.
---

# Marketing Pro

Marketing methodology, routing layer and quality gates distilled from **Digital Marketing Pro
v3.31.1** (MIT, © Indranil Banerjee — see § Provenance). The point of it is consistency: every
brand runs the same parts in the same order, so depth is comparable across brands and handoffs
work.

## Start here, every time

1. **Identify the brand.** Read `<workspace>/marketing/<brand>/brand-profile.md` and the
   engagement's **Living Project Instruction File** before anything else. No profile yet → run
   the brand-setup path with `assets/brand-profile-template.md` and get at least the five ★
   fields, target markets included.
2. **Announce the brand you are working on** when it changes, record the previous slug, and
   print the way back. Silently repointing every task at a new brand is how client work gets
   mixed up.
3. **Route the request** — § Routing below, then `references/skills-catalog.md` for the full 163.
4. **Do the work at the stated depth**, honouring § What is and isn't bundled.
5. **Gate the output** before it is called ready (`references/quality-gates.md`). Anything
   leaving the building needs typed confirmation first.

## Routing

| The user wants | Capability | Depth |
|---|---|---|
| A brand set up, or its profile fixed | `brand-setup`, `validate-profile` | `assets/brand-profile-template.md` |
| The full engagement, end to end | `engagement-workflow` | `references/strategy-flow.md` |
| Part 3 — the strategic spine | `four-core-documents` (61 steps) | `references/strategy-flow.md` |
| Part 5 — findings put to the client | `client-validation-document` | It is a **stop**, not a checkpoint |
| Part 8 — the flagship deliverable | `growth-plan`, `yearly-planner` | 11 sections + 12-month calendar |
| A campaign, budget and timeline | `campaign-plan`, `media-plan`, `budget-optimizer` | Plan only — it publishes nothing |
| Content drafted | `content-brief` → `content-engine` → `check` | Never skip the gate |
| An SEO programme | `seo-plan` (dispatcher), `seo-audit`, `keyword-cluster`, `backlink-gap` | `references/strategy-flow.md` § chains |
| AI-search visibility | `aeo-audit`, `aeo-geo`, `geo-monitor`, `entity-audit` | Six surfaces — `references/compliance.md` |
| Numbers explained | `analytics-insights`, `attribution-model`, `performance-report` | Name the data window and its gaps |
| A competitor read | `competitor-analysis` (snapshot), `competitor-monitor` (standing) | Set chosen once, reused downstream |
| A pre-publish check | `check`, `verify-claims`, `validate-output` | `references/quality-gates.md` |
| A compliance answer | `check` + jurisdiction rules | `references/compliance.md` |
| Something actually sent or launched | `launch-campaign`, `send-email-campaign`, `crm-sync`, … | **Typed approval, every time** |
| To know what this can do | this file + `references/skills-catalog.md` | 163 capabilities, 7 families |

Upstream addresses these as `/digital-marketing-pro:<name>`; here `<name>` is the capability
name in the catalogue. Both spellings mean the same work.

## Non-negotiables

- **Stone vs Opinion.** Tag every intake fact. An Opinion is a research question, never a
  premise you build on.
- **v1 is never deleted.** Keep the unbiased view alongside the client-validated one; operating
  decisions cite v2, ideation cites both.
- **Part 5 stops the flow.** No Part 6+ on assumed answers.
- **The Update-Back Rule.** Corrections go into the source document with a version bump and
  propagate from the instruction file — not patched into whichever downstream file you noticed
  it in.
- **Numbers carry provenance.** A figure enters a deliverable with a source and an as-of date,
  or it does not enter. Everything in `references/compliance.md` is stamped August 2026:
  re-verify before quoting.
- **No hardcoded model ids** in briefs or deliverables. Resolve by capability; if you must name
  one, date it.
- **Consent and credentials before any write.** Confirm the active brand, the consent basis, and
  the recipient count.
- **Plan-only skills publish nothing.** Say which mode you are in, so nobody thinks a plan went
  live.

## What is and isn't bundled

Bundled: the methodology, the 24 role contracts, the routing catalogue for all 163 capabilities
with their upstream depth tier and gates, the compliance and channel reality (stamped), the
brand-profile template, and the quality-gate definitions with their real thresholds.

**Not bundled: upstream's 93 Python scripts, 169 in-skill reference files, and its MCP connector
catalogue.** 108 of the 163 capabilities are tier **E** upstream — they run a script (sample-size
calculators, SERP-overlap clustering, AI-tell scanning, C2PA signing, HTTP connector execution).
Here, do that work analytically, **name the method you used and its limits**, and never present
an estimate as a measurement. Where the real thing matters — C2PA signing for an EU campaign,
firing a live API call, a statistical test you cannot compute by hand — say what is needed and
point at the upstream plugin:

```
/plugin marketplace add indranilbanerjee/neels-plugins
/plugin install digital-marketing-pro@neels-plugins
```

Connectors are opt-in there too; nothing auto-connects. This repo ships no MCP config, so any
"send" or "launch" here is a plan plus the exact request you would make — never a silent no-op
reported as done.

## Output discipline

```
<workspace>/marketing/<brand>/<workflow>/<YYYY-MM-DD>/
  00-run.md   part status table, updated as each part finishes
  01-….md …   numbered artefacts — downstream reads these, so any step can be re-run alone
  PLAN.md     the deliverable
  scorecard.md the gate verdict that allowed PLAN.md to be called ready
```

Long flows: write the status table as you go, and resume from the first un-checkpointed part.
Before fanning out expensive parallel steps, name them and their cost and ask —
Confirm-Then-Dispatch.

## References

- `references/strategy-flow.md` — the 12 parts, the five architectural rules, worked chains
- `references/skills-catalog.md` — all 163 capabilities by family, with tier, triggers, gates
- `references/agents.md` — the 24 specialist role contracts
- `references/compliance.md` — 16 jurisdictions, Article 50 / C2PA, 2026 channel mechanics, AEO/GEO
- `references/quality-gates.md` — the pre-publish gate, the humanize gate, writing a criterion that can fail
- `assets/brand-profile-template.md` — the file every capability reads first
- `assets/skills-index.json` — upstream's machine-readable index, verbatim (grep it)

## Provenance

Distilled from Digital Marketing Pro v3.31.1 — 163 skills, 24 agents, MIT-licensed, no
telemetry — by Indranil Banerjee (<https://indranil.in>,
<https://github.com/indranilbanerjee/digital-marketing-pro>), part of the Neelverse Marketing
Suite. Upstream ships the executable layer; this skill carries the methodology and the routing.
Sources: the plugin's `AGENTS.md`, `README.md` and `skills-index.json` as of August 2026.
