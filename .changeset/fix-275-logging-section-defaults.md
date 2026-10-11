---
"@radoslavirha/tsed-http-provider": patch
---

Outbound HTTP logging sections (headers, query, request, response) stay disabled unless switched on, so a `logging` block with only `enabled`/`stack` no longer logs payloads unredacted.
