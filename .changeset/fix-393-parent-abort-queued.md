---
"@radoslavirha/resilience": patch
---

A parent abort now rejects a call queued behind the half-open circuit-breaker trial immediately instead of after the trial settles.
