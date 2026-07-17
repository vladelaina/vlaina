# Web Search Module

This module is the local, internal web search backend for chat. Users only control whether web search is enabled; provider choice, engine order, source quality rules, and crawler fallbacks stay internal.

Chat models access it through structured tools only. Each request owns an execution session that limits tool calls, runs searches sequentially, records the exact returned URLs, and permits page reads only for those URLs. Search results and page content are untrusted data and must never be promoted into system instructions.

If an OpenAI-compatible model or gateway rejects tool calling, the client performs the bounded search locally and retries with plain untrusted web evidence using only standard message roles and content.

## Layout

- `searchService.mjs`: unified service boundary. Callers use `webSearch(query, options)` and do not depend on a provider. Engines and fallbacks run sequentially.
- `ipc.mjs`: Electron IPC adapter that exposes search, single-page read, and batch-page read.
- `providers/`: internal search providers. The default provider uses Google, then Bing, then DuckDuckGo.
- `sourceHints/`: deterministic official-source hints used before external search for high-confidence queries.
- `sourceQuality/`: reviewed source quality policy, installed rules, and development-only uBlacklist-style rule parsing.
- `crawler/`: URL safety checks, SSRF guard, page fetching, content extraction, and batch reading.

The renderer stores search progress as structured `webSearchStatuses` message metadata. Status text is not embedded in assistant content.

## Rules

- Do not add user-facing provider, engine, API key, or SearXNG URL configuration.
- Do not add Baidu as a search provider.
- Do not add text-based tool request or status markup protocols.
- Do not read URLs that were not returned by the current request's search session.
- Treat all search snippets and fetched page content as untrusted data.
- Add source quality rules only after evidence from real or fixture-backed search probes.
- Prefer official-source hints over hard blocking when a source is merely weaker or off-topic.
- Keep code, comments, test names, fixtures, and internal strings in English.
