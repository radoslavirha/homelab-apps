---
"qr-manager-ui": patch
"homelab-dashboard-ui": patch
---

Listen on IPv6 as well as IPv4

Both nginx images now declare an explicit `listen [::]:<port> default_server;`
alongside the existing IPv4 listener, in every `nginx.conf` and
`nginx.conf.template`. Previously nginx only bound `0.0.0.0`, so `localhost`
and `[::1]` failed inside the container even though the app answered fine on
the pod's IPv4 address.

Not a production defect today — the kubelet probes the pod IP, which is
IPv4-only on these clusters — but it made the frontend health-check spec's own
verification commands fail, and it would break liveness outright if a cluster
ever becomes dual-stack. The base image's own
`10-listen-on-ipv6-by-default.sh` cannot fix this: it patches the stock
`default.conf` before our own template overwrites it via envsubst, so the
listener has to be declared in our own config.
