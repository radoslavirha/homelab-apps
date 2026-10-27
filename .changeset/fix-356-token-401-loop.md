---
"@radoslavirha/http-provider": patch
---

A 401 from a token-exchange endpoint now rejects the caller's request once instead of replaying the token request in an endless loop.
