---
"miot-bridge-api": patch
---

Notifications wait in the queue while the MQTT client is offline and stay paced after a reconnect, instead of being flushed together as a burst that Loxone partly loses.
