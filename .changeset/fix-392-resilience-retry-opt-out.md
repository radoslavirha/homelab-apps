---
"@radoslavirha/resilience": patch
---

`execute` takes an optional third argument: `{ retry: false }` runs the work once, whatever `retry.count` says. The circuit breaker still counts it and the timeout still bounds it.
