---
"@radoslavirha/health": patch
---

Reject a `checkTimeoutMs` above 2^31 - 1 ms at boot instead of silently turning it into a 1 ms deadline.
