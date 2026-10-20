---
"miot-bridge-api": minor
---

Stop commands timing out on a stale stamp: the device clock is tracked by time instead of counted per call, and a new device instance handshakes on its first command. `stamp` and `stampUpdatedAt` are removed from the device record, the `/devices` responses and the default `redactPaths`; documents registered earlier keep the two fields in MongoDB, unread. This removes the 10 s timeout plus re-handshake that hit polling every few minutes and the first command after every restart. The `miot action` span now carries the device's answer (`miot.action.result`, and its code on `rpc.response.status_code`).
