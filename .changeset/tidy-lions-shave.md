---
"interactive-map-feeder-api": minor
"miot-bridge-api": minor
"qr-manager-api": minor
---

Build the API images on distroless

`runtime-base` moves from `node:24-trixie-slim` to
`gcr.io/distroless/nodejs24-debian12:nonroot`: no shell, no package manager, 10 OS
packages instead of 79. Images drop ~96MB each (qr-manager-api 349MB → 253MB).

The distroless ENTRYPOINT is already the node binary, so `CMD` now carries node's
arguments and the leading `node` word is gone. The OTel preload survives that move —
verified by an OTLP sink receiving spans and by `trace_id` still appearing in logs.

Debugging has no shell: `kubectl exec <pod> -- /nodejs/bin/node -e '…'` (absolute
path), with `fs.readdirSync` / `fs.readFileSync` / `fetch` standing in for `ls` /
`cat` / `curl`, or `kubectl debug --image=busybox --target=<container>` for a real
shell without changing the image.

The image's user is UID 65532 rather than 1000. The homelab values should follow for
consistency, but they are not a hard coupling — verified that the image runs
correctly when the chart pins 1000, because the copied files stay world-readable.
