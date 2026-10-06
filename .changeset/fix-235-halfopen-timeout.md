---
"@radoslavirha/resilience": patch
---

A half-open circuit breaker trial that times out now keeps the breaker open instead of closing it, even when `shouldHandle` ignores timeouts.
