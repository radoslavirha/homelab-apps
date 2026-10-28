---
"knowledge-base-api": patch
---

A document holding a NUL byte (e.g. a UTF-16 markdown file) is skipped and logged with its path instead of failing every knowledge base run; any other storage error still fails the run.
