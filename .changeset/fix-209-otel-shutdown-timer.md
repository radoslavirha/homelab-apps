---
"@radoslavirha/otel": patch
---

`shutdown()` no longer leaves its timeout timer pending, so the process exits as soon as the flush completes.
