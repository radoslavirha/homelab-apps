---
"knowledge-base": patch
---

An MCP endpoint configured with a trailing slash (e.g. `/development/`) now serves its tools instead of failing every call, and two paths differing only by a trailing slash are refused at boot.
