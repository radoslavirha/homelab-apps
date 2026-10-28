---
"@radoslavirha/http-provider": patch
---

`resilience.retry` no longer replays a `POST` or `PATCH`: a request that failed may still have written upstream, and sending it again is a second write. Idempotent methods (`GET`, `HEAD`, `OPTIONS`, `QUERY`, `PUT`, `DELETE`) are retried as before. A new per-call option, `retry`, overrides that: `false` sends a request once whatever its method, `true` lets a `POST` that is safe to repeat be retried. The token-exchange request is still retried, and the 401 credential refresh still replays any request once.
