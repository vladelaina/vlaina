# Web Search Module

This module is the local, internal web search backend for chat. Users only control whether web search is enabled; provider choice, engine order, source quality rules, and crawler fallbacks stay internal.

## Layout

- `searchService.mjs`: unified service boundary. Callers use `webSearch(query, options)` and do not depend on a provider.
- `ipc.mjs`: Electron IPC adapter that exposes search, single-page read, and batch-page read.
- `providers/`: internal search providers. The default provider uses Google, then Bing, then DuckDuckGo.
- `sourceHints/`: deterministic official-source hints used before external search for high-confidence queries.
- `sourceQuality/`: reviewed source quality policy, installed rules, and development-only uBlacklist-style rule parsing.
- `crawler/`: URL safety checks, SSRF guard, page fetching, content extraction, and batch reading.
- Root `*.mjs` files with matching names are compatibility exports for existing imports and tests.

## Rules

- Do not add user-facing provider, engine, API key, or SearXNG URL configuration.
- Do not add Baidu as a search provider.
- Add source quality rules only after evidence from real or fixture-backed search probes.
- Prefer official-source hints over hard blocking when a source is merely weaker or off-topic.
- Keep code, comments, test names, fixtures, and internal strings in English.
