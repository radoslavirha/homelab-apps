---
"knowledge-base-api": patch
---

Ollama embed calls opt in to retry, so they are still retried now that http-provider no longer retries a `POST` by default.
