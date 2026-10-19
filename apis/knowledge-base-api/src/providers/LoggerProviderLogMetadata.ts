import type { PrincipalKind } from '@radoslavirha/auth';

/**
 * Fields `LoggerProvider` adds to every line written while a request is handled — the
 * `Request completed` / `Request failed` line included. Absent outside a request and before the
 * guard has verified a caller (a `401`).
 *
 * Who called, never with what: no token, no claim beyond these three.
 *
 * The index signature keeps per-call metadata open (`{ event, … }` on the root logger): an
 * interface of optional fields alone is a weak type, and TypeScript would reject every other key.
 */
export interface LoggerProviderLogMetadata {
    [key: string]: unknown;
    /** The verified caller's `sub`, e.g. `ak-development-kb-mcp-client_credentials` for a service account. */
    principalSubject?: string;
    /** `human`, `service` or `device` — from the trusted issuer's `subjectKind`. */
    principalKind?: PrincipalKind;
    /** The `iss` that vouched for the caller: one Authentik provider per client, so it names the client. */
    principalIssuer?: string;
}
