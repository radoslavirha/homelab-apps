---
description: "Source conventions for the Ts.ED APIs and MCP servers: one class per file, DTO (de)serialization in endpoints and repositories, @radoslavirha/utils guards instead of raw checks. Use when writing or reviewing any TypeScript under apis/**/src or mcp/**/src."
applyTo: "{apis,mcp}/**/src/**/*.ts"
---

# Ts.ED API Source Conventions

A path-scoped rule loads when a matching file is **read**. Writing a new file does not load it, so in
a new member read this file (and `tsed-testing.instructions.md`) before writing the first one.

## One class per file

One class per file, the file named after the class. This covers DTOs, response models, enums
(`<Name>.enum.ts`) and test doubles (`src/test/FakeX.ts`), not only providers.

- An interface or type used only by that class may sit beside it (`RedirectResult` next to
  `RedirectHandler`).
- A second class may not — not a helper, not a nested response model, not a fake. A helper class
  that is not a provider (per-call state such as a slugger or a parser state machine) gets its own
  file in a folder named for what it serves, e.g. `src/markdown/GithubSlugger.ts`.
- A response model with nested objects is one file per class: `StatusGetResponse.ts`,
  `KnowledgeBaseStatus.ts`, `LastRunStatus.ts`, …

## Endpoints and DTOs

An endpoint accepts and returns **DTOs only**, and a DTO is a decorated class mirroring the wire:

```ts
// endpoints/ollama/dto/OllamaEmbedRequestDTO.ts
@AdditionalProperties(false)
export class OllamaEmbedRequestDTO {
    @Property() public model: string;
    @CollectionOf(String) public input: string[];
    @Property() @Name('keep_alive') public keepAlive: string;   // wire name ≠ property name
}
```

Every response is deserialized and every request body serialized, with `Serializer` from
`@radoslavirha/tsed-common`:

```ts
public async embed(request: OllamaEmbedRequestDTO): Promise<OllamaEmbedResponseDTO> {
    const response = await this.client.post<object>(EMBED_PATH, Serializer.serialize(request, OllamaEmbedRequestDTO));

    return Serializer.deserialize(response, OllamaEmbedResponseDTO);
}
```

- **List responses**: `Serializer.deserializeArray(items, ItemDTO)`. An envelope (`{ instances: [...] }`)
  is a DTO class of its own, not an inline `{ instances: X[] }` type argument.
- **SDK clients too.** A typed SDK response (Octokit) is still the SDK's type, not ours:
  `Serializer.deserialize(data, GitHubBranchDTO)`.
- **Storage rows too.** A repository deserializes query rows into its `storage/<group>/dto/` classes;
  `@Name('external_id')` maps snake_case columns, so SQL needs no `AS "camelCase"` aliases.
- **The caller builds request DTOs** with `CommonUtils.buildModelStrict(RequestDTO, { … })`, never
  an object literal typed as the DTO.
- **No logic in an endpoint.** Filtering a listing, decoding base64, picking a field out of a
  response — the caller does it on the DTO. The endpoint is the wire boundary and nothing else.
- Binary responses (`responseType: 'binary'`, a `Buffer`) have no DTO; that is the one exception.

Why: a DTO class is the only place the wire format is written down. An object literal or an SDK type
passes the compiler while the payload drifts, and the first sign is a `undefined` far from the call.
Deserialization also drops fields the DTO does not declare, so an upstream that adds fields cannot
leak them into our responses or our database.

## Controllers: declaring responses

- **Every error a route raises itself is declared with its exception class**:
  `@Returns(NotFound.STATUS, NotFound)`, `@Returns(BadRequest.STATUS, BadRequest)`,
  `@Returns(Conflict.STATUS, Conflict)` from `@tsed/exceptions` — never a bare `@Returns(404)`, which
  documents a status without the body the API actually sends. `401`, `403` and `503` from the auth
  guard are declared by `@Authenticate` / `@RequireRoles` themselves; do not repeat them.
- **A success response is described by its model**, `@Description` on the response class — not by
  `.Description('…')` chained on `@Returns`. `@Returns(202, ReindexPostResponse)` is the whole line.
- A status with no body (`204`, `302`) stays `@Returns(204)`.

## Guards and helpers from `@radoslavirha/utils`

No raw `=== undefined`, `=== null`, `typeof`, `Array.isArray` — the `using-utils` skill has the full
table. The ones that come up most:

| Instead of | Use |
|---|---|
| `x === undefined` / `x !== null` / `x == null` | `CommonUtils.isUndefined(x)` / `notNull(x)` / `isNil(x)` |
| `if (match)` on a nullable | `CommonUtils.notNull(match)` |
| `s === ''`, `s.trim() === ''`, `typeof s === 'string' && s.trim()` | `StringUtils.isNotEmpty(s)` |
| `list.length === 0` | `CommonUtils.isEmpty(list)` |
| `value ?? 'fallback'` for a config string or number | `DefaultsUtil.string` / `DefaultsUtil.number` |
| `JSON.parse(JSON.stringify(x))` | `ObjectUtils.cloneDeep(x)` |

`lint` runs with `--max-warnings 0`: the `PreferUtils` warnings fail it. The rows the linter cannot
see (empty strings, truthiness, `.length`) are still the rule — review for them.

`map.get(key) ?? []` stays as it is: `ArrayUtils.toArray` has no overload for `T[] | undefined`.
