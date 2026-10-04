---
"@radoslavirha/auth": patch
---

JwtVerifier now rejects bearer tokens that carry no `exp` claim instead of accepting them as never-expiring.
