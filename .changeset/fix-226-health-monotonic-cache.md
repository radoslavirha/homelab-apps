---
"@radoslavirha/health": patch
---

Health result cache now expires on a monotonic clock, so a backwards wall-clock step no longer serves a stale readiness result.
