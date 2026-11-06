import { CommonUtils, StringUtils } from '@radoslavirha/utils';
import { UNAUTHENTICATED_SUBJECT_PATTERN, type UnauthenticatedVerifierConfig } from '../schemas/auth.schema.js';
import { VerificationReason, type VerificationOutcome } from '../VerificationOutcome.js';
import type { CredentialSource } from '../CredentialSource.js';
import type { Credential, ITokenVerifier } from '../ITokenVerifier.js';

/**
 * The `issuer` stamped on every principal an `unauthenticated` entry admits.
 *
 * Not a URL and not configurable, so a log line or the `auth.issuer` metric
 * label says plainly that nobody vouched for this caller.
 */
export const UNAUTHENTICATED_ISSUER = 'unauthenticated';

/**
 * Admits every request, credential or not, as the entry's configured principal.
 *
 * Mostly for testing without an IdP. It never refuses: an `Authorization` header is ignored, not rejected, so a client
 * that always sends one still works. Roles are the configured ones in full, so
 * `@RequireRoles` behaves exactly as it does behind an IdP — a role not
 * configured is still a `403`.
 *
 * The "credential" this verifier extracts is only the optional subject label
 * from `subjectHeader`. It is unverified: any caller may set it.
 */
export class UnauthenticatedVerifier implements ITokenVerifier {
    readonly #config: UnauthenticatedVerifierConfig;

    public constructor(config: UnauthenticatedVerifierConfig) {
        this.#config = config;
    }

    /** The `subjectHeader` value, if the entry names one and the request carries it. */
    public extract(source: CredentialSource): Credential | undefined {
        const header = this.#config.subjectHeader;

        return CommonUtils.isUndefined(header) ? undefined : source.header(header);
    }

    /**
     * Always `ok`. `credential` is the subject label from `extract` (or `''` when
     * there was none); a label that does not match
     * `UNAUTHENTICATED_SUBJECT_PATTERN` falls back to `defaultSubject` rather than
     * refusing, because the label carries no trust to refuse on.
     */
    public verify(credential: Credential): Promise<VerificationOutcome> {
        const label = credential.trim();
        const subject = StringUtils.isNotEmpty(label) && UNAUTHENTICATED_SUBJECT_PATTERN.test(label)
            ? label
            : this.#config.defaultSubject;

        return Promise.resolve({
            reason: VerificationReason.Ok,
            principal: {
                subject,
                kind: this.#config.subjectKind,
                roles: [...this.#config.roles],
                issuer: UNAUTHENTICATED_ISSUER
            }
        });
    }
}
