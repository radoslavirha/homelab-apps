# Filing a bug in toolkit-hub
Use this when a bug's root cause is in a toolkit-hub package — an
`@radoslavirha/*` dependency from GitHub Packages, not a member of this repo —
so the fix belongs in radoslavirha/toolkit-hub. `gh` can write there.

1. Deduplicate in toolkit-hub first: search its issues and PRs, open and closed,
   by file path and symptom (`gh search issues --repo radoslavirha/toolkit-hub ...`).
   If one covers it, link that instead of filing, and skip to step 5.
2. Read toolkit-hub's finder prompt for its issue format:
     gh api repos/radoslavirha/toolkit-hub/contents/.github/claude/bug-finder.md --jq .content | base64 -d
3. Write the issue in that format, about toolkit-hub's code: `## Location` is a
   path in toolkit-hub. Read the source in a shallow clone
   (`gh repo clone radoslavirha/toolkit-hub /tmp/toolkit-hub -- --depth 1`), not
   in node_modules. Include a failing test in toolkit-hub's style if you can
   write one; otherwise give the reproduction from this repo and say so — its
   resolver writes the test. End the body with:
     ## Origin
     radoslavirha/homelab-apps#<N> — the member affected and how it shows here.
   Leave out `## Origin` if there is no issue here (a finder filing directly).
4. File it labeled `agent-found` — toolkit-hub's resolver picks it up:
     gh issue create -R radoslavirha/toolkit-hub --title ... --body-file ... --label agent-found
5. If there is an issue here (#<N>): comment the toolkit-hub issue link on it,
   add `agent-upstream`, and remove `agent-in-progress` / `agent-needs-human` /
   `agent-cannot-reproduce`. The resolver leaves it until the upstream fix is
   released, then bumps the dependency here.
