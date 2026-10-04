import { describe, expect, it } from 'vitest';
import { parseDnsRecords } from './parseDns.js';
import { AppConfigSchema } from '../runtime/RuntimeConfig.js';

const records = [
    { key: 'server1.home', value: '10.0.0.1', record_type: 'A', enabled: true },
    { key: 'traefik.server1.home', value: '10.0.0.1', record_type: 'A', enabled: true }
];

function urlFor(path: string): string {
    const cfg = AppConfigSchema.parse({
        unifi: { site: 'default' },
        serverPattern: '^server(\\d+)\\.home$',
        paths: { traefik: path }
    });
    return parseDnsRecords(records, cfg)[0].services[0].url;
}

describe('paths config', () => {
    it('keeps the host intact when the suffix has no leading slash', () => {
        const url = urlFor('dashboard');
        expect(new URL(url).hostname).toBe('traefik.server1.home');
        expect(url).toBe('http://traefik.server1.home/dashboard');
    });

    it('leaves suffixes starting with /, ? or # unchanged', () => {
        expect(urlFor('/dashboard')).toBe('http://traefik.server1.home/dashboard');
        expect(urlFor('?x=1')).toBe('http://traefik.server1.home?x=1');
        expect(urlFor('#top')).toBe('http://traefik.server1.home#top');
    });

    it('leaves an empty suffix unchanged', () => {
        expect(urlFor('')).toBe('http://traefik.server1.home');
    });
});
