---
"knowledge-base-api": patch
---

A write refused by GitHub for a stale version (`409`) is no longer retried, so the `409` with the current document answers at once instead of after 14 s of backoff.
