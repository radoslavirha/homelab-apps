import { describe, expect, it } from 'vitest';
import { GithubSlugger } from './GithubSlugger.js';

// GithubSlugger is per-document state, not a DI provider: one instance per document is the point.
describe('GithubSlugger', () => {
    it('lower-cases, drops punctuation and turns each space into a hyphen', () => {
        expect(new GithubSlugger().slug('3. Run it with the CloudNativePG operator')).toBe('3-run-it-with-the-cloudnativepg-operator');
        expect(new GithubSlugger().slug('`job.*` and not `faas.*`')).toBe('job-and-not-faas');
        expect(new GithubSlugger().slug('Read — then write')).toBe('read--then-write');
    });

    it('numbers duplicates like GitHub', () => {
        const slugger = new GithubSlugger();

        expect(['Notes', 'Notes', 'Notes-1', 'Notes'].map((text) => slugger.slug(text))).toEqual(['notes', 'notes-1', 'notes-1-1', 'notes-2']);
    });
});
