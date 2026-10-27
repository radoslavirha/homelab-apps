---
"knowledge-base-api": minor
---

At boot, a knowledge base that is no longer in `knowledgeBases[]` is deleted with its documents, chunks and vectors, and a `DB_MIGRATION` warning names it with the counts. Removing or renaming a knowledge base is now a config change alone: a renamed one starts empty and is built by `POST /reindex?full=true`. Before, its rows stayed in the database, unused.
