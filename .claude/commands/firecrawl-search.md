---
description: Firecrawl — search the web (optionally with full page content) and save the results under .firecrawl/
argument-hint: [query — e.g. "best Chrome extensions to translate video audio"]
---

Use the `firecrawl-search` skill for this search: **$ARGUMENTS**

Save the results under `.firecrawl/`, check they are not empty, then answer from them with the
source URLs. Use the Firecrawl MCP tools if the `firecrawl` CLI is not installed. Never print or
write the value of `FIRECRAWL_API_KEY`.
