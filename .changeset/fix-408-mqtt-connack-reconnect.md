---
"miot-bridge-api": patch
---

Keep reconnecting to the MQTT broker after it refuses a CONNACK (e.g. while it restarts) instead of staying off MQTT until the pod is restarted.
