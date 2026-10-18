---
"knowledge-base-api": patch
---

A failed file read during indexing now stops the other fetch workers instead of leaving them reading the rest of the tree.
