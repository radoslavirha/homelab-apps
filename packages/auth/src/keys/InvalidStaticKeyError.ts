import { UnresolvableKeyError } from '../IKeySource.js';

/**
 * The inline key for this issuer is not a usable PEM public key for its algorithm.
 *
 * `UnresolvableKeyError`: nothing local can ever succeed, and there is no remote
 * to blame, so the verifier must not report it as the key source being down.
 */
export class InvalidStaticKeyError extends UnresolvableKeyError {
    constructor(
        readonly issuer: string,
        cause: unknown
    ) {
        super(`Static key for issuer ${issuer} could not be imported: ${cause instanceof Error ? cause.message : String(cause)}`);
        this.name = 'InvalidStaticKeyError';
    }
}
