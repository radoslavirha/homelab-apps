---
"miot-bridge-api": patch
---

Abort outbound HTTP notification POSTs after 10 seconds so an unresponsive sink no longer leaks pending requests.
