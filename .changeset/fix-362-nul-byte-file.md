---
"knowledge-base-api": patch
---

A document Postgres cannot store (e.g. a NUL byte) is skipped and logged with its path instead of failing the whole knowledge base run.
