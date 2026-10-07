---
"@radoslavirha/otel": patch
---

`withMqttConsumeSpan` now starts a new trace for a message without a `traceparent` instead of joining the active span's trace.
