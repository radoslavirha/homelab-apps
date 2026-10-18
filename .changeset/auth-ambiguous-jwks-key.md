---
"@radoslavirha/auth": minor
---

Verify a token with no `kid` against a JWKS holding several matching keys (as during key rotation) by trying each candidate key, instead of refusing it as `invalid`. Adds `AmbiguousKeyError`, an `UnresolvableKeyError` that carries the candidate keys.
