---
"@radoslavirha/tsed-auth": minor
---

`PrincipalService` lets any provider read the current request's principal (`current()`, or `require()`, which throws `Unauthorized`), so a controller no longer has to pass it down through every handler.
