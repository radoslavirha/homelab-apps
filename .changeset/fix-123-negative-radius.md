---
"interactive-map-feeder-api": patch
---

Reject a negative or oversized `radius` query parameter with 400 instead of returning NaN (null) city colours.
