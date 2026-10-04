---
"homelab-dashboard-ui": patch
---

The nginx proxy now forwards only read requests for the static DNS endpoint with the UniFi API key; every other path and method under /proxy/network/ is refused.
