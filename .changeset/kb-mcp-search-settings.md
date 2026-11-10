---
"knowledge-base-mcp": minor
---

Search settings per endpoint: an optional `mcpServers.<KEY>.search` block sets the default and maximum `limit`, the embedding model and the RRF weights sent to knowledge-base-api, so a model or a blend can be tried through config and a restart. The `search` tool's `limit` now accepts up to 50, lowered to the endpoint's `maxLimit` (default 50).
