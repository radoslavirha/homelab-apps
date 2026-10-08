---
"@radoslavirha/resilience": patch
---

A call that started before the circuit breaker opened no longer reopens a half-open breaker when its client cancels or it times out.
