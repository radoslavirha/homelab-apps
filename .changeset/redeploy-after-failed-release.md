---
"knowledge-base-api": patch
"interactive-map-feeder-api": patch
"miot-bridge-api": patch
"qr-manager-api": patch
"homelab-dashboard-ui": patch
"qr-manager-ui": patch
---

Ship the previous release's changes. That release was tagged, but its run failed before any image was built (`mcp/knowledge-base` had no `deploy.json`), so it was never deployed.
