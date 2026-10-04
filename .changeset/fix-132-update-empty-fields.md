---
"qr-manager-api": patch
---

`PUT /qr-codes/:id` now rejects an empty `targetURL` or `label` with 400, as `POST` does, instead of saving a broken QR code.
