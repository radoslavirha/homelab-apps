---
"@radoslavirha/tsed-http-provider": patch
---

Outbound logging now redacts credentials injected through `auth.transport` headers and query params, and `x-api-key` by default.
