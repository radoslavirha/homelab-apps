---
"@radoslavirha/otel": patch
---

Omitting the traces or metrics section now really disables that signal instead of falling back to NodeSDK's env-based OTLP defaults.
