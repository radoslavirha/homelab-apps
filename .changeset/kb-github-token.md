---
"knowledge-base-api": minor
---

The git source can authenticate with a GitHub token (a fine-grained personal access token) as well as a GitHub App: `github` and `git.github` take `type: token` with the token from a file or a value. A knowledge base on a token must set `git.repository`. Existing App configs parse unchanged.
