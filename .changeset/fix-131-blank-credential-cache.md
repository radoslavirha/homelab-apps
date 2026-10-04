---
"@radoslavirha/http-provider": patch
---

A blank token from a token endpoint no longer leaves the provider failing until restart; credentials are re-fetched on the next request.
