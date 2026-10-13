# @radoslavirha/health

## 0.1.3

### Patch Changes

- [#237](https://github.com/radoslavirha/homelab-apps/pull/237) [`d70f9b3`](https://github.com/radoslavirha/homelab-apps/commit/d70f9b3cfe3a59f1bad19bd0d7cc92837254df6b) Thanks [@claude-agent-irha](https://github.com/apps/claude-agent-irha)! - The health report now lists every check even when two checks share a name; later duplicates appear as `name#2`, `name#3`, so a failing check is no longer hidden.
- Updated dependencies [[`663d4c8`](https://github.com/radoslavirha/homelab-apps/commit/663d4c8d756157cf23296c89ac1820ce0cb10971), [`b5893aa`](https://github.com/radoslavirha/homelab-apps/commit/b5893aa9e781fbd6d8dc89cb2bcaa12687462c47)]:
  - @radoslavirha/resilience@0.2.3

## 0.1.2

### Patch Changes

- [#228](https://github.com/radoslavirha/homelab-apps/pull/228) [`042c72c`](https://github.com/radoslavirha/homelab-apps/commit/042c72c36f8e1e1bebff82a3c201eb828fe6dea3) Thanks [@claude-agent-irha](https://github.com/apps/claude-agent-irha)! - A check throwing an error with a non-string name no longer makes every later health evaluation reject.

- [#231](https://github.com/radoslavirha/homelab-apps/pull/231) [`1746391`](https://github.com/radoslavirha/homelab-apps/commit/1746391b5e6af6f10a1f8b98f173ad73ababd4e2) Thanks [@claude-agent-irha](https://github.com/apps/claude-agent-irha)! - Health result cache now expires on a monotonic clock, so a backwards wall-clock step no longer serves a stale readiness result.

- [`824756b`](https://github.com/radoslavirha/homelab-apps/commit/824756b4d472000c8654370be46e29dba41be49c) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Update dependencies
- Updated dependencies [[`824756b`](https://github.com/radoslavirha/homelab-apps/commit/824756b4d472000c8654370be46e29dba41be49c)]:
  - @radoslavirha/resilience@0.2.2

## 0.1.1

### Patch Changes

- [`8046bc5`](https://github.com/radoslavirha/iot-miniservers/commit/8046bc5e20911838609caef053f1a5d209c3cd82) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Update dependencies
- Updated dependencies [[`8046bc5`](https://github.com/radoslavirha/iot-miniservers/commit/8046bc5e20911838609caef053f1a5d209c3cd82)]:
  - @radoslavirha/resilience@0.2.1
