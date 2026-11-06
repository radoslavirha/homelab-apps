---
"knowledge-base-api": minor
---

`GET /conventions?kb=` serves a knowledge base's house rules: the file its new optional `knowledgeBases[].conventionsPath` names (e.g. `README.md`), read live from the source, so it need not be indexed. Unset answers `200` with nulls.
