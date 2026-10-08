---
"qr-manager-api": patch
---

`GET /qr-codes/:id/image` accepts `download=1` to send `Content-Disposition: attachment` so cross-origin download links save the file.
