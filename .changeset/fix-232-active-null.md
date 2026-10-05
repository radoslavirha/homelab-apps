---
"qr-manager-api": patch
---

PUT /qr-codes/:id now returns 400 for a `null` field instead of silently deactivating the QR code.
