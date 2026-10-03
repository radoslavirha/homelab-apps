---
"miot-bridge-api": minor
---

Remove the outbound HTTP notification transport. Property-change notifications are now published over MQTT only, and controllers talk to the bridge over REST and MQTT. UDP is used solely for the MIoT protocol to the devices.

The `http.notifications` config key is no longer read. A config that still carries it keeps booting — the key is ignored — so the ConfigMap can be cleaned up after the rollout.
