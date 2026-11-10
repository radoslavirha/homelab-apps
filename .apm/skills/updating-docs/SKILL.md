---
name: updating-docs
description: Regenerate agent-consumable README.md for apps, regenerate each backend's CONFIGURATION.md, and rebuild docs/KNOWLEDGE.md. Use when: new app added, controller/service/config changed (a config schema or a shared package's schema), a CONFIGURATION.md snapshot test fails, or onboarding-to-homelab completed.
---

# Update Docs

Maintains lean, agent-consumable docs: per-app `README.md`, per-backend `CONFIGURATION.md` and the
central `docs/KNOWLEDGE.md`.
Focus: **what each app does, what it connects to, what it exposes**. No ports, no versions, no docker, no dev setup.

## Trigger

`/updating-docs [app-name?]`

- No arg → all apps + KNOWLEDGE.md
- `app-name` → that app only, then refresh KNOWLEDGE.md

---

## Step 1 — Collect metadata per app

### APIs (`apis/<app>/`)

| File | Extract |
|------|---------|
| `package.json` | `name`, `description` |
| `src/controllers/*.ts` | Routes: HTTP method decorator + path string + `@Description` value |
| `src/endpoints/**/*.ts` | `BASE_URL` constants → external system |
| `src/services/Mqtt*.ts` | Topic patterns, inbound/outbound direction, payload shape |
| `src/services/Udp*.ts` | Payload shape, protocol notes |

### UIs (`ui/<app>/`)

| File | Extract |
|------|---------|
| `package.json` | `name`, `description` |
| `src/api/*.ts` | Which API endpoints are called |
| `src/runtime/RuntimeConfig.ts` | Config keys + types |

### Packages (`packages/<pkg>/`)

| File | Extract |
|------|---------|
| `package.json` | `name`, `description` |

---

## Step 2 — Write per-app README.md

Overwrite `README.md` in each app dir.
**Rules: no badges, no ports, no versions, no docker, no dev setup, no prose padding.**

### API format

```markdown
# {name}

{2-3 sentence description of purpose and responsibilities}

## Consumed By

{bullet list — who calls this API and how}

## External Dependencies

| System | Protocol | Condition | Purpose |
|--------|----------|-----------|---------|
{one row per external system}

## REST API

| Method | Path | Description |
|--------|------|-------------|
{one row per route}

## {MQTT — only if present}

Topic table + payload shape.

## {UDP — only if present}

Payload shape, response behavior.

## Configuration

Every key with its type, default and meaning: [CONFIGURATION.md](./CONFIGURATION.md), generated from the configuration schema.

{optional: only what the generated reference cannot say — rollout order, where a secret comes from}

## Shared Package

{only if app uses packages/ from this repo}
```

### UI format

```markdown
# {name}

{one sentence purpose}

## API Dependencies

| API | Config key | Operations |
|-----|------------|------------|

## Runtime Config

| Key | Description |
|-----|-------------|
```

---

## Step 3 — Regenerate CONFIGURATION.md (APIs and MCP servers)

Every backend (`apis/*`, `mcp/*`) has a `CONFIGURATION.md` at its root, **generated** from its Zod
`ConfigSchema` by `ConfigDocs.render` (`@radoslavirha/tsed-configuration`) and pinned by a
`toMatchFileSnapshot` test in `src/models/config/ConfigModel.spec.ts`. Never edit it by hand.

```bash
pnpm --filter ./packages/<pkg> build        # first, when a shared package's schema changed: apps import its dist/
pnpm --filter ./<member-path> exec vitest run src/models/config/ConfigModel.spec.ts -u
```

A schema change in a shared package (`packages/auth`, `http-provider`, `tsed-http-provider`,
`resilience`, `otel`, `health`) changes every backend's file: regenerate all of them.

A new backend gets the spec too:

```ts
describe('CONFIGURATION.md', () => {
    it('Should match the configuration schema', async () => {
        expect.assertions(1);
        await expect(ConfigDocs.render(ConfigSchema, { title: '<package name>' }))
            .toMatchFileSnapshot('../../../CONFIGURATION.md');
    });
});
```

**Descriptions come only from `.describe()`** on the schema field — JSDoc is invisible to the
generator. A row with an empty Description column is a field missing `.describe()`: add one that
states what the code does, not a guess. A default filled inside a `z.preprocess` is invisible too
(the table shows the inner schema's default), so state it in that field's `.describe()`. Rows under
`logger.*` come from `@radoslavirha/tsed-logger` in toolkit-hub and are fixed there, not here.

---

## Step 4 — Rebuild docs/KNOWLEDGE.md

Overwrite `docs/KNOWLEDGE.md`. Update `Last updated` date. Structure:

1. One-line repo description
2. **Apps** table: Name | Type | Purpose
3. **Shared Packages** table: Package | Purpose
4. **Communication** — Mermaid `graph LR` (apps + external systems + labeled edges)
5. **External Dependencies** table: App | System | Protocol | Condition | Purpose

---
