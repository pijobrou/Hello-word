---
description: Marketing Pro — route a marketing request through the 12-Part Strategy Flow, the 163-capability catalogue and the pre-publish gates
argument-hint: [what you want — e.g. "set up brand Acme" | "run the full engagement" | "audit our SEO" | "check this draft"]
---

Use the `marketing-pro` skill for this request: **$ARGUMENTS**

Follow its start-here sequence:

1. Read the active brand profile (`marketing/<brand>/brand-profile.md`) and the engagement's
   Living Project Instruction File first. If no profile exists, set one up from
   `.claude/skills/marketing-pro/assets/brand-profile-template.md` — at minimum the five ★
   fields, including target markets, since those drive every compliance rule.
2. Route the request via the skill's routing table, then
   `.claude/skills/marketing-pro/references/skills-catalog.md` for the full 163 capabilities.
3. State which capability you are running, whether it plans or publishes, and — for anything
   tier **E** upstream — that you are doing it analytically, with the method and its limits named.
4. Gate the output before calling it ready
   (`.claude/skills/marketing-pro/references/quality-gates.md`), and get typed confirmation
   before anything is sent, launched, or written to an external system.

With no arguments: report the active brand, where its outputs live, any run parked mid-flow,
and the three capabilities most useful next.
