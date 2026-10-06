---
"miot-bridge-api": patch
---

Devices with repeated service types (e.g. multi-gang switches) keep every channel addressable: repeated types are keyed with their siid (`switch-2:on`, `switch-3:on`); stored subscriptions using the old colliding key (`switch:on`) no longer resolve.
