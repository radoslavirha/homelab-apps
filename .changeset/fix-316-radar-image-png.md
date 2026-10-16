---
"interactive-map-feeder-api": patch
---

`GET /data-sources/:dataSource/image` now sends PNG bytes to match its declared `image/png`. Before, it sent the JPEG format of the ČHMÚ surface map.
