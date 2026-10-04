---
"@radoslavirha/auth": patch
---

Reject a bearer-jwt entry that lists the same trusted issuer twice at boot, instead of silently letting the later row replace the earlier one.
