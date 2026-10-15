import { UnresolvableKeyError } from '../IKeySource.js';

/**
 * The token asked for an algorithm this issuer's key is not for.
 *
 * This is the algorithm-confusion attack arriving — a token signed HS256 with
 * an RSA public key as the secret, against a row configured for RS256. It is
 * emphatically the credential's fault, so it must surface as `invalid`.
 */
export class StaticAlgorithmMismatchError extends UnresolvableKeyError {
    constructor(
        readonly issuer: string,
        readonly expected: string,
        readonly received: string
    ) {
        super(`Issuer ${issuer} is configured for ${expected}, token used ${received}.`);
        this.name = 'StaticAlgorithmMismatchError';
    }
}
