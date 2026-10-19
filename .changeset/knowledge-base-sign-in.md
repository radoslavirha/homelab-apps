---
"knowledge-base": minor
---

Sign-in through Authentik: every MCP endpoint is an OAuth resource server with a required `auth` block, and each tool declares the least role it needs. An endpoint is its knowledge base — `search` and `read` no longer take `kb`, and `list_knowledge_bases` is gone. First release deployed to production (`mcp.irha.cz/kb/development`).
