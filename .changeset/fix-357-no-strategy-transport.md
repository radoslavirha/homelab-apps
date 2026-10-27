---
"@radoslavirha/http-provider": patch
---

An `auth` block without a strategy (or `strategy: none`) now rejects credential transport entries at config load instead of failing every request.
