---
"@radoslavirha/auth": minor
"@radoslavirha/tsed-auth": minor
---

Add the `unauthenticated` verifier type: an explicit, per-entry choice, mostly for testing, that admits every request as a configured principal (all configured roles, optional unverified `subjectHeader` label) and makes the boot summary warn.
