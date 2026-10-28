---
"knowledge-base-mcp": patch
---

`create_note`, `write_document` and `delete_document` are sent to knowledge-base-api once, never retried. A write that failed with a 5xx may already have committed, and its replay reported "already exists", "no longer exists" or "has changed" for a write that succeeded (#392). The tool descriptions now say to read before retrying after a server error as well as after a timeout.
