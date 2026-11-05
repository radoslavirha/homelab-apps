---
"miot-bridge-api": patch
---

`mqtt.notifications.publishIntervalMs` defaults to 3000 instead of 1500, because Loxone processes only the newest message per 2 s and 1500 still lost messages.
