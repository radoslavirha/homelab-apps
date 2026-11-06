---
"knowledge-base-mcp": minor
---

New read-only `conventions` tool returns the knowledge base's own rules, and every endpoint sends MCP server `instructions` (new optional `mcpServers.<KEY>.instructions`, with a generic default) telling agents to call it before writing or preparing files. `write_document` now spells out the frontmatter it requires, including the allowed `status` values.
