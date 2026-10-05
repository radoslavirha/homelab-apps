import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const template = readFileSync(resolve(__dirname, '../nginx.conf.template'), 'utf8');

/** Every `location` block whose body attaches the Unifi API key. */
const keyedLocations = [...template.matchAll(/location\s+([^{]+)\{([\s\S]*?)\n    \}/g)]
    .filter(([, , body]) => body.includes('X-Api-Key'))
    .map(([, matcher, body]) => ({ matcher: matcher.trim(), body }));

describe('nginx.conf.template Unifi proxy scope', () => {
    it('attaches the API key only to the static-dns endpoint the app calls', () => {
        expect(keyedLocations.length).toBeGreaterThan(0);
        for (const { matcher } of keyedLocations) {
            expect(matcher).toMatch(/static-dns/);
        }
    });

    it('only forwards read requests with the API key', () => {
        for (const { body } of keyedLocations) {
            expect(body).toMatch(/limit_except\s+GET/);
        }
    });

    it('refuses every other path under /proxy/network/', () => {
        expect(template).toMatch(/location\s+\/proxy\/network\/\s*\{\s*return 404;/);
    });
});
