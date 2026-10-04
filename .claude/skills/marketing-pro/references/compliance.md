# Compliance and market reality

Every figure and rule below carries upstream's as-of date (Digital Marketing Pro v3.31.1,
August 2026). **Re-verify anything you are about to put in front of a client or a regulator.**
Quote it with its date, or not at all.

## Jurisdictions (16)

Rules auto-apply from the brand profile's declared target markets. If the profile declares no
market, ask — do not assume the US.

EU (GDPR + AI Act) · US Federal (CAN-SPAM) · California (CCPA/CPRA) · 20+ other US state
privacy laws · Canada (CASL + PIPEDA) · Brazil (LGPD) · UK (UK GDPR + PECR) · Australia
(Privacy Act + Spam Act) · Singapore (PDPA) · China (PIPL) · India (DPDPA) · Japan (APPI) ·
South Korea (PIPA) · Saudi Arabia (PDPL) · UAE (Federal Decree-Law No. 45) · Thailand (PDPA)

## EU AI Act Article 50 — applicable 2 August 2026

For AI-generated or AI-modified marketing assets in EU campaigns:

- **C2PA content provenance signing is required before delivery.** Upstream signs via
  `scripts/embed-c2pa.py` / the `c2pa-metadata` skill. That script is not bundled here — so
  either run the real plugin for signing, or treat the asset as **not deliverable to an EU
  campaign** and say so. Do not paper over a missing signature.
- The pre-publish gate treats a missing signature on an AI-flagged asset in an EU campaign as
  **CRITICAL → BLOCKED**.
- The final Article 50 Guidelines and the final Code of Practice on Transparency of
  AI-Generated Content (10 June 2026) govern the disclosure wording.
- Production certificates come from a CAI-recognised authority — Adobe Content Credentials,
  Truepic, Numbers Protocol, or Microsoft Azure Confidential Ledger. A self-signed test
  certificate is for testing, never for delivery.

## Other regulatory updates in force (2026)

- **NY synthetic-performer disclosure law** (live June 2026): $1K–$5K per violation, $10K
  repeat. Applies to synthetic influencers and AI endorsements.
- **FTC endorsement guidance (May 2026)**: covers synthetic influencers, AI testimonials, and
  AI-edited creator content.
- **CJEU ruling (March 2026)**: pseudonymized cookie IDs are personal data where
  re-identification is feasible.
- **CCPA ADMT amendments (January 2026)** plus AI-derived sensitive-data classification.
- **India DPDP Phase II**: consent-manager registration opens November 2026.

Every AI creative brief carries a deepfake-disclosure clause. Every influencer brief carries
the disclosure the target market requires.

## Channel mechanics that change the work

- **LinkedIn** (March 2026 algorithm shift): external links and engagement bait penalised ~60%.
  A **Depth Score** measures dwell time. Follower count no longer guarantees reach — optimise
  for relevance and dwell.
- **Email**: Apple MPP affects ~64% of B2C opens, so **open rate is dead as a primary KPI** —
  do not build a plan on it. DMARC + RFC 8058 one-click POST unsubscribe are mandatory;
  non-compliant bulk mail to Gmail / Yahoo / Microsoft draws permanent 550 rejections. Spam
  complaint threshold: <0.10%.
- **TikTok** (post 22 Jan 2026 USDS joint venture): US data and algorithm under USDS LLC,
  ByteDance retains <20%. AI-generated creators require a disclosure label; AI content is
  excluded from the Creator Rewards Program; daily shoppable-post limits since 11 May 2026.
- **Meta**: Advantage+ Leads global (May 2026); Threads ads global, image-only; brand-safety
  inventory tiers — Expanded / Moderate / Limited, where Limited costs ~30% of reach.
- **WhatsApp**: per-message pricing since 1 July 2025 (India marketing template ≈ USD 0.0118
  per message); 72-hour free service window opened by CTWA ads or Page CTAs.
- **Third-party cookies**: deprecation was **cancelled**. First-party data is the strategic
  priority; attribution defaults to first-party + MMM + incrementality, not last-click.
- **AI video models**: the OpenAI consumer Sora app was discontinued 26 April 2026 and the Sora
  API on 24 September 2026. Creative briefs default to Veo 3.1, Kling v3.0 Pro, Runway Gen-4,
  Gemini Omni. Never write a brief against a retired model.

## AEO / GEO — the six-surface standard

Audit all six as distinct surfaces: **ChatGPT · Perplexity · Google AI Mode · Google AI
Overviews · Gemini · Microsoft Copilot**. AI Mode is not AI Overviews — it became the default
conversational search experience for opted-in users at I/O 2026 (19 May 2026) and needs its
own read.

Context as of upstream's stamp: AI Overviews appear on ~55% of Google searches (Seer
Interactive, Sept 2025); organic CTR on those queries fell ~61% (1.76% → 0.61%); ~58% of
Google searches are zero-click; ChatGPT search ~883M MAU; Perplexity skews citations heavily to
Reddit (~47% of factual cites); Wikipedia drives ~48% of ChatGPT citations.

Schema: Google's March 2026 core update demoted FAQ / Review / HowTo schema on non-primary
pages. Prefer entity-rich JSON-LD (Article + Organization + Person + Product). An LLMs.txt is
optional — Google states it is not required for AI-features eligibility.

Track citations across all six surfaces and report **Share of AI Voice** as a first-class
metric alongside rankings.

## Model ids

Never hardcode a model id into a deliverable or a brief. Resolve by capability at the time of
writing ("current balanced Anthropic model", "current Google video model"), and if you must
name one, name its as-of date. Frontier ids change roughly every six weeks and a deprecated id
in a client document is a silent 404 later.
