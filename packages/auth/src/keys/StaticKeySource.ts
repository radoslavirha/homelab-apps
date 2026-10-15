import { importSPKI } from 'jose';
import { InvalidStaticKeyError } from './InvalidStaticKeyError.js';
import { StaticAlgorithmMismatchError } from './StaticAlgorithmMismatchError.js';
import { UnknownStaticIssuerError } from './UnknownStaticIssuerError.js';
import type { IKeySource, KeyLookup, VerificationKey } from '../IKeySource.js';
import type { StaticKey, TrustedIssuer } from '../schemas/auth.schema.js';
import { CommonUtils } from '@radoslavirha/utils';

/**
 * Serves keys carried inline in the configuration.
 *
 * No network, no cache, no expiry — which is exactly why it exists. It lets the
 * JWT verifier be built and exercised end to end with nothing running, and it
 * makes `config/localhost.json` a real enforced issuer row rather than a bypass.
 *
 * Symmetric algorithms (`HS*`) take the secret's bytes directly. Anything else
 * is a PEM-encoded **public** key: the verifier never needs a private key, and
 * accepting one here would invite somebody to paste a signing key into a config
 * file.
 */
export class StaticKeySource implements IKeySource {
    /** Rows that carry an inline key, indexed by exact `iss`. */
    readonly #byIssuer: ReadonlyMap<string, StaticKey>;

    /** Imported keys, so a PEM is parsed once rather than per request. */
    readonly #imported = new Map<string, VerificationKey>();

    /**
     * Takes the whole issuer list and keeps the inline-key rows, so a
     * configuration mixing static and JWKS issuers can be handed to both sources
     * without the caller partitioning it.
     */
    constructor(issuers: readonly TrustedIssuer[]) {
        this.#byIssuer = new Map(
            issuers
                .filter((row): row is TrustedIssuer & { key: StaticKey } => row.key.source === 'value')
                .map(row => [row.issuer, row.key])
        );
    }

    /** True when this source has a key for `issuer` — lets a router pick a source without a throw. */
    handles(issuer: string): boolean {
        return this.#byIssuer.has(issuer);
    }

    async getKey({ issuer, algorithm }: KeyLookup): Promise<VerificationKey> {
        const key = this.#byIssuer.get(issuer);
        if (!key) {
            throw new UnknownStaticIssuerError(issuer);
        }

        // The configured algorithm is the allowlist. Checking it here as well as
        // in the verifier is deliberate: a key source that hands back an HMAC
        // secret for an `RS256` header has already lost, whatever the caller
        // does next.
        if (CommonUtils.notUndefined(algorithm) && algorithm !== key.algorithm) {
            throw new StaticAlgorithmMismatchError(issuer, key.algorithm, algorithm);
        }

        // `kid` is ignored on purpose. A static row holds exactly one key, so
        // there is nothing to select between, and a token carrying an unexpected
        // `kid` still fails on the signature.
        return this.#import(issuer, key);
    }

    async #import(issuer: string, key: StaticKey): Promise<VerificationKey> {
        const cached = this.#imported.get(issuer);
        if (cached) {
            return cached;
        }

        let imported: VerificationKey;
        if (key.algorithm.startsWith('HS')) {
            imported = new TextEncoder().encode(key.value);
        } else {
            try {
                imported = await importSPKI(key.value, key.algorithm);
            } catch (error) {
                // The key is local, so a PEM that will not import is a
                // configuration fault, not a source being down. Leaving it a
                // plain error would be filed as `indeterminate` (503) on every
                // request, which reads as an IdP outage.
                throw new InvalidStaticKeyError(issuer, error);
            }
        }

        this.#imported.set(issuer, imported);
        return imported;
    }
}
