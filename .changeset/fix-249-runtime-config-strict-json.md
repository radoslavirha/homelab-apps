---
"@radoslavirha/nginx-runtime": patch
---

The runtime-config guard now rejects configs that jq accepts but `JSON.parse` rejects (concatenated values, NaN/Infinity, leading zeros) and no longer misreports a top-level `null` or `false`.
