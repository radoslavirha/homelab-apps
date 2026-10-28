import { CommonUtils } from '@radoslavirha/utils';
import { ProviderScope, Scope, Service } from '@tsed/di';

/** What looked like a secret, and where. Never the value: a refusal must not repeat it. */
export interface SecretFinding {
    /** 1-based line of the text it was found on. */
    readonly line: number;
    readonly kind: string;
}

/**
 * Secret shapes, by what they are. The words a human review looks for ("token", "password",
 * "vault path") are not here: a knowledge base about auth says them all the time. What is here is
 * a word *with a value* — a value of 8+ characters holding a digit — and the formats that are a
 * secret by themselves.
 */
const PATTERNS: readonly (readonly [kind: string, pattern: RegExp])[] = [
    ['a private key', /-----BEGIN [A-Z ]*PRIVATE KEY(?: BLOCK)?-----/],
    ['a GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{22,})/],
    ['an AWS access key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
    ['a Slack token', /\bxox[abeoprs]-[A-Za-z0-9-]{10,}/],
    ['an API key', /\bsk-[A-Za-z0-9_-]{20,}/],
    ['a JWT', /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/],
    ['a credential in a URL', /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s@/]+@/i],
    [
        'a secret with its value',
        /\b(?:password|passwd|pwd|secret|token|api[_-]?key|private[_-]?key|client[_-]?secret)["']?\s*[:=]\s*["']?(?=[^\s"'`]*\d)[^\s"'`,;]{8,}/i
    ],
    ['a secret store path', /\bkv\/(?:data\/|metadata\/)?[\w.-]+\/[\w./-]+/]
];

/** Runs of base64/base64url characters long enough to be a generated key. `/` and `.` split them, so paths do not. */
const CANDIDATE = /[A-Za-z0-9+_=-]{24,}/g;

/** Bits per character from which a mixed-case, digit-holding run reads as random. Random base64 of 24+ characters is ~4.2. */
const ENTROPY_THRESHOLD = 4;

/**
 * Finds what looks like a secret in text written to the knowledge base, which is written as if it
 * were public. Errs towards refusing: a false positive costs a reworded sentence, a false negative
 * a secret in git history.
 *
 * Besides {@link PATTERNS}, any long run of base64 characters that mixes upper case, lower case and
 * digits with high entropy counts — a generated key in no known format. Hex (commit and blob SHAs,
 * UUIDs), kebab-case slugs and identifiers do not mix all three, so they pass.
 */
@Service()
@Scope(ProviderScope.SINGLETON)
export class SecretScanService {
    /** The first finding, or `null` when the text looks clean. */
    public scan(text: string): SecretFinding | null {
        const lines = text.split(/\r?\n/);

        for (const [index, line] of lines.entries()) {
            const kind = this.kindOf(line);

            if (CommonUtils.notNull(kind)) {
                return { line: index + 1, kind };
            }
        }

        return null;
    }

    private kindOf(line: string): string | null {
        for (const [kind, pattern] of PATTERNS) {
            if (pattern.test(line)) {
                return kind;
            }
        }

        for (const [candidate] of line.matchAll(CANDIDATE)) {
            if (/[a-z]/.test(candidate) && /[A-Z]/.test(candidate) && /\d/.test(candidate) && entropy(candidate) >= ENTROPY_THRESHOLD) {
                return 'a high-entropy string';
            }
        }

        return null;
    }
}

/** Shannon entropy in bits per character. */
const entropy = (text: string): number => {
    const counts = new Map<string, number>();

    for (const char of text) {
        counts.set(char, (counts.get(char) ?? 0) + 1);
    }

    let bits = 0;

    for (const count of counts.values()) {
        const p = count / text.length;

        bits -= p * Math.log2(p);
    }

    return bits;
};
