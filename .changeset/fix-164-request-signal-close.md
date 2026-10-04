---
"@radoslavirha/tsed-resilience": patch
---

`@RequestSignal()` no longer aborts early on POST/PUT/PATCH requests once the body has been read; it aborts only when the client actually disconnects.
