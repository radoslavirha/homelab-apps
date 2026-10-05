---
"@radoslavirha/auth": patch
---

A token whose algorithm is not allowed for its issuer (HS256, `none`) is now reported as invalid (401) instead of indeterminate (503) on JWKS-backed issuers.
