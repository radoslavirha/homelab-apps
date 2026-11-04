---
"miot-bridge-api": patch
---

Notifications are published one at a time, at least `mqtt.notifications.publishIntervalMs` apart (default 1500), so a burst no longer loses values in Loxone.
