---
"@radoslavirha/tsed-health": patch
---

`/health/ready` now runs each health check once per request (not twice) when `cacheTtlMs` is 0, so the status code and body can no longer disagree.
