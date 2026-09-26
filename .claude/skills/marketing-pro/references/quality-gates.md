# Quality gates

A gate whose measurement is undefined does not fail — it passes on impression. Every gate below
states what is measured, in which unit, against which threshold. If you cannot measure it here,
say so and mark the criterion `N/A` **with a reason**. A bare `N/A` is a FAIL.

## The pre-publish gate (`check`)

Nothing ships without it — blog, ad, email, social, landing page, report, creative brief.
Four dimensions:

1. **Hallucination / factual grounding.** Every factual claim traces to a source in the brand
   profile, an intake artefact, or a cited external source. Untraceable claim → remove it or
   mark it as an assumption in the copy.
2. **Claim verification.** Numbers, percentages, superlatives and comparative claims need a
   source with an as-of date. A statistic you cannot source does not become "roughly" — it
   comes out.
3. **Brand voice.** Measured as a distance against the brand's four voice dimensions, on a
   0–1 scale. **Pass = distance ≤ 0.15.** Report the number, not a vibe. If the copy is out of
   tolerance, the remediation must move *toward* the brand's recorded setting — check the
   direction before rewriting (upstream shipped an inverted remediation for five releases).
4. **Structure + compliance.** Required sections present, CTA present, jurisdiction rules
   applied, disclosure clauses present where required (see `compliance.md`).

Verdicts: **PASS** · **PASS with notes** · **BLOCKED**. A CRITICAL compliance finding — e.g.
missing C2PA on an AI-flagged asset in an EU campaign — is BLOCKED, never "PASS with notes".

## The humanize gate

What it proves: a **density floor**, nothing more. It is not evidence that a piece was
humanized, and passing it is not a claim about authorship.

Gating signals (these can fail a piece):
- AI-tell density per paragraph above the brand threshold (upstream default: >10% of
  paragraphs flagged).
- **Significance markers** — "here's the thing", "that's the part that got me" and kin. These
  are **deleted, never reworded**.
- Soft-adverb clusters.

Advisory only (never gate on these — measured against hand-written copy they flag human
writing): LLM-favoured vocabulary such as "robust", "facilitate", "leverage" (ordinary
technical English, largely trained out of current models, so as a gate it can only produce
false positives); short-declarative rhythm; connective openers; participial openers;
ungrounded one-liners.

Two hard rules from upstream's own incident log:
- **Never append scan output into the file the authorship measurement reads.** It moves the
  author's word share and can deny a human author a credit they earned.
- **Bring-your-own-draft sentences are carried verbatim** — typos and all — and are exempt from
  every tell. If the author's words were paraphrased or dropped, that **blocks**: a detector
  signal is a probabilistic opinion, but "the author wrote this and it is gone" is a fact.

## Writing a scorecard criterion that can actually fail

Three failure modes to design out, each of which shipped upstream and passed everything:

- **Wrong unit.** "≤ 1.5 point deviation" against a scorer bounded at 1.0 is unfailable. State
  the threshold in the scorer's own unit.
- **Impossible criterion.** "3 internal links" on a pre-launch brand's first article cannot be
  met — it takes an `N/A` naming the reason.
- **Vacuous criterion.** "All images have alt text" passes at zero images. Same treatment.

## Re-derive "ready", never trust it

Before declaring a run ready, audit it from its artefacts rather than from its scorecard:
every numbered artefact present; the voice distance actually inside the gate; the authorship
record matching a fresh measurement; no publish-ready copy containing production
placeholders. **A scorecard that declares ready past its own recorded threshold is a FAIL,
and you quote the number.** A missing input is reported as N/A with its reason — never a
silent pass. Record the verdict beside the artefacts so the next reader sees the run was
verified rather than believed.

## Approval gates on anything that leaves the building

Sending email or SMS, launching or editing a paid campaign, writing to a CRM, importing leads,
posting to a channel, exporting data: **typed confirmation first**, every time. State exactly
what will be sent, to whom, how many recipients, and what it costs. Read operations may run
freely; write operations need the explicit go-ahead in the same turn.

Credential hygiene: confirm the active brand and credential profile before any write. A
misrouted client write is the one mistake this whole layer exists to prevent.
