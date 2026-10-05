---
"@radoslavirha/http-provider": patch
---

Concurrent 401s for the same expired token now share one credential refresh instead of each starting their own.
