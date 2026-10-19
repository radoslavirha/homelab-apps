---
"miot-bridge-api": patch
---

Properties and actions that repeat a type within one service are no longer overwritten in the simplified spec; they are keyed with their iid appended (e.g. `switch:mode-2`, `switch:mode-6`), so devices with such repeats get new command keys.
