import { UnresolvableKeyError } from '../IKeySource.js';

/**
 * No inline key is configured for this issuer.
 *
 * `UnresolvableKeyError`, because this source is local: there is no fetch to
 * fail, so a miss can only ever mean the credential asked for something that
 * does not exist.
 */
export class UnknownStaticIssuerError extends UnresolvableKeyError {
    constructor(readonly issuer: string) {
        super(`No static key configured for issuer ${issuer}.`);
        this.name = 'UnknownStaticIssuerError';
    }
}
