import { UnresolvableKeyError } from './IKeySource.js';
import type { VerificationKey } from './IKeySource.js';

/**
 * More than one key fits the lookup, so the source cannot name the right one —
 * a JWKS publishing a retiring and a new key during rotation, asked for a token
 * whose header carries no `kid`.
 *
 * Choosing among them is not this source's call: the signature already decides
 * which key is right, so the candidates travel with the error and the verifier
 * tries each in turn.
 *
 * It is an `UnresolvableKeyError` so that a caller who knows nothing of
 * candidates still reports `invalid`, exactly as before this class existed.
 * Being several matches rather than none takes nothing away from that: the key
 * set answered, so nothing about it can be an outage.
 */
export class AmbiguousKeyError extends UnresolvableKeyError {
    constructor(
        message: string,
        readonly candidates: AsyncIterable<VerificationKey>
    ) {
        super(message);
        this.name = 'AmbiguousKeyError';
    }
}
