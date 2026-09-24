# Agent context — Hello-word

## Marketing Pro skill

This repository carries one Agent Skill: **Marketing Pro**, at
`.claude/skills/marketing-pro/SKILL.md`. It is the marketing methodology, routing layer and
quality gates distilled from Digital Marketing Pro v3.31.1 (MIT, © Indranil Banerjee).

Non-Claude runtimes (OpenAI Codex, Cursor, GitHub Copilot CLI, Google Antigravity, Gemini CLI
and other Agent Skills hosts) auto-load this file. The skill itself is byte-portable — read
`SKILL.md` and follow it; there is nothing Claude-specific in it. Claude Code additionally
exposes `/marketing-pro` from `.claude/commands/marketing-pro.md`.

**Use it for:** brand setup, the 12-Part Strategy Flow, campaign and media plans, content
production, SEO and six-surface AEO/GEO audits, attribution and reporting, and 16-jurisdiction
compliance including EU AI Act Article 50 / C2PA.

**Before doing marketing work:** read the active brand profile and the engagement's Living
Project Instruction File; tag intake facts Stone vs Opinion; never delete the v1 view; treat
Part 5 (client validation) as a hard stop; gate every output before calling it ready; get typed
confirmation before anything is sent, launched or written to an external system.

**What is not here:** upstream's 93 Python scripts and connector catalogue. 108 of the 163
catalogued capabilities execute a script upstream — do that work analytically here, name the
method and its limits, and never present an estimate as a measurement. For the executable layer
install the upstream plugin (`indranilbanerjee/neels-plugins` →
`digital-marketing-pro@neels-plugins`).

Reference files: `references/strategy-flow.md`, `references/skills-catalog.md` (all 163),
`references/agents.md` (24 specialist roles), `references/compliance.md`,
`references/quality-gates.md`, `assets/brand-profile-template.md`, `assets/skills-index.json`.

## Firecrawl skills (web search)

`.claude/skills/firecrawl-search/SKILL.md` (web search, optional page content; `/firecrawl-search`)
and `.claude/skills/firecrawl-build-search/SKILL.md` (integrating Firecrawl `/search` into product
code), from <https://github.com/firecrawl/skills>. The Firecrawl MCP server is declared in
`.mcp.json` and reads `FIRECRAWL_API_KEY` from the environment. Never write the key into a file of
this repository. Search output goes to `.firecrawl/` (git-ignored).
