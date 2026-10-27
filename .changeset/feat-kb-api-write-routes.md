---
"knowledge-base-api": minor
---

Write routes: `POST /notes` (a `raw/` note rendered from fields), `PUT /documents` (a whole `work/` spec or plan) and `DELETE /documents`, each one commit through GitHub's contents API as the App, for the user named in the `On-Behalf-Of` header. They need the new `knowledge-base-api.editor` role, enforce the knowledge base's area, format and naming rules, refuse anything that looks like a secret, run one at a time, answer a stale `version` with `409` and the document as it is now (the `CURRENT` entry of `errors`), and start an incremental indexing run. A document's `version` is now the file's blob SHA instead of the indexed commit. **After deploying, run `POST /reindex?full=true` once** so every stored version becomes a blob SHA (unchanged documents are not embedded again).
