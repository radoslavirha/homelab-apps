---
"@radoslavirha/otel": minor
"interactive-map-feeder-api": patch
"knowledge-base-api": patch
"miot-bridge-api": patch
"qr-manager-api": patch
"knowledge-base-mcp": patch
---

New `otel.resourceAttributes` config key: extra resource attributes (string, number or boolean) on every span, metric and log record. `service.name` and `service.version` stay app-owned and are rejected.
