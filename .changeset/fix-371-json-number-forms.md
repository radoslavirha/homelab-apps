---
"@radoslavirha/nginx-runtime": patch
---

The runtime-config guard now rejects numbers JSON.parse rejects (`.5`, `1.`, `+1`, `-.5`) instead of starting nginx with a config the browser cannot load.
