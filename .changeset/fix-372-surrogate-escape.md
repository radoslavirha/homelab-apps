---
"@radoslavirha/nginx-runtime": patch
---

The runtime-config guard accepts a config holding an unpaired UTF-16 surrogate escape (e.g. `"\ud800"`), which `JSON.parse` accepts, instead of aborting the nginx start.
