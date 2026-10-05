import { describe, expect, it } from 'vitest';
import { parseDnsRecords } from './parseDns.js';
import { AppConfigSchema } from '../runtime/RuntimeConfig.js';
import type { DnsRecord } from '../types.js';

// Built through the real schema so fixtures cannot drift from what the app
// will actually be handed at runtime.
const baseConfig = AppConfigSchema.parse({
    unifi: { host: 'https://192.168.1.1', apiKey: 'key' },
    serverPattern: '^server(\\d+)\\.home$',
    scheme: 'http'
});

const aRecord = (key: string, value: string, enabled = true): DnsRecord => ({
    key,
    value,
    record_type: 'A',
    enabled
});

const cnameRecord = (key: string, value: string): DnsRecord => ({
    key,
    value,
    record_type: 'CNAME',
    enabled: true
});

describe('parseDnsRecords', () => {
    it('returns empty array when no records provided', () => {
        expect(parseDnsRecords([], baseConfig)).toEqual([]);
    });

    it('groups services by server anchor via IP', () => {
        const records = [
            aRecord('server1.home', '192.168.1.10'),
            aRecord('app1.home', '192.168.1.10'),
            aRecord('app2.home', '192.168.1.10')
        ];
        const clusters = parseDnsRecords(records, baseConfig);
        expect(clusters).toHaveLength(1);
        expect(clusters[0].label).toBe('server1');
        expect(clusters[0].services).toHaveLength(2);
    });

    it('groups services by server anchor via CNAME', () => {
        const records = [
            aRecord('server1.home', '192.168.1.10'),
            cnameRecord('service.home', 'server1.home')
        ];
        const clusters = parseDnsRecords(records, baseConfig);
        expect(clusters).toHaveLength(1);
        expect(clusters[0].services[0].name).toBe('service');
    });

    it('groups a CNAME by the anchor\'s own matched hostname, not a hardcoded suffix', () => {
        const config = { ...baseConfig, serverPattern: '^server(\\d+)\\.homelab\\.irha\\.cz$' };
        const records = [
            aRecord('server1.homelab.irha.cz', '192.168.1.10'),
            cnameRecord('grafana.irha.cz', 'server1.homelab.irha.cz')
        ];
        const clusters = parseDnsRecords(records, config);
        expect(clusters).toHaveLength(1);
        expect(clusters[0].services[0].name).toBe('grafana');
    });

    it('matches a CNAME target case-insensitively', () => {
        const config = { ...baseConfig, serverPattern: '^server(\\d+)\\.homelab\\.irha\\.cz$' };
        const records = [
            aRecord('server1.homelab.irha.cz', '192.168.1.10'),
            cnameRecord('grafana.irha.cz', 'SERVER1.homelab.irha.cz')
        ];
        const clusters = parseDnsRecords(records, config);
        expect(clusters[0].services).toHaveLength(1);
    });

    it('excludes records listed in config.exclude', () => {
        const records = [
            aRecord('server1.home', '192.168.1.10'),
            aRecord('app.home', '192.168.1.10'),
            aRecord('dashboard.home', '192.168.1.10')
        ];
        const config = { ...baseConfig, exclude: ['dashboard.home'] };
        const clusters = parseDnsRecords(records, config);
        expect(clusters[0].services.map(s => s.hostname)).not.toContain('dashboard.home');
    });

    it('skips disabled records', () => {
        const records = [aRecord('server1.home', '192.168.1.10'), aRecord('app.home', '192.168.1.10', false)];
        const clusters = parseDnsRecords(records, baseConfig);
        expect(clusters).toHaveLength(0);
    });

    it('appends path suffixes from config.paths', () => {
        const records = [aRecord('server1.home', '192.168.1.10'), aRecord('traefik.home', '192.168.1.10')];
        const config = { ...baseConfig, paths: { traefik: '/dashboard' } };
        const clusters = parseDnsRecords(records, config);
        expect(clusters[0].services[0].url).toBe('http://traefik.home/dashboard');
    });

    it('does not treat Object.prototype members as configured paths', () => {
        const records = [aRecord('server1.home', '192.168.1.10'), aRecord('constructor.home', '192.168.1.10')];
        const clusters = parseDnsRecords(records, { ...baseConfig, paths: {} });
        expect(clusters[0].services[0].url).toBe('http://constructor.home');
    });

    it('falls back to subnet grouping when no anchor records match', () => {
        const records = [
            aRecord('app1.home', '10.0.0.1'),
            aRecord('app2.home', '10.0.0.2'),
            aRecord('other.home', '10.1.0.1')
        ];
        // No serverN.home records
        const clusters = parseDnsRecords(records, { ...baseConfig, serverPattern: '^NOMATCH$' });
        expect(clusters.length).toBeGreaterThan(0);
        expect(clusters.some(c => c.label.includes('10.0.0'))).toBe(true);
    });

    it('derives a clean label in the subnet fallback for any domain, not a hardcoded-suffix strip', () => {
        const records = [aRecord('grafana.irha.cz', '10.0.0.5')];
        const clusters = parseDnsRecords(records, { ...baseConfig, serverPattern: '^NOMATCH$' });
        expect(clusters[0].services[0].name).toBe('grafana');
    });

    it('uses http scheme by default', () => {
        const records = [aRecord('server1.home', '192.168.1.10'), aRecord('app.home', '192.168.1.10')];
        const config = AppConfigSchema.parse({
            unifi: { host: 'https://192.168.1.1', apiKey: 'key' },
            serverPattern: '^server(\\d+)\\.home$'
        });
        const clusters = parseDnsRecords(records, config);
        expect(clusters[0].services[0].url).toMatch(/^http:\/\//);
    });

    it('assigns distinct accent colors to different servers', () => {
        const records = [
            aRecord('server1.home', '192.168.1.10'),
            aRecord('server2.home', '192.168.1.20'),
            aRecord('app1.home', '192.168.1.10'),
            aRecord('app2.home', '192.168.1.20')
        ];
        const clusters = parseDnsRecords(records, baseConfig);
        expect(clusters).toHaveLength(2);
        expect(clusters[0].color).not.toBe(clusters[1].color);
    });

    it('omits fallback clusters whose services are all excluded and does not consume their index', () => {
        const cfg = AppConfigSchema.parse({
            unifi: { host: 'https://192.168.1.1', apiKey: 'key' },
            serverPattern: '^nomatch(\\d+)$',
            exclude: ['hidden.lan']
        });
        const clusters = parseDnsRecords(
            [aRecord('hidden.lan', '10.0.1.5'), aRecord('app.lan', '10.0.2.5')],
            cfg
        );
        expect(clusters.map(c => c.label)).toEqual(['10.0.2.x']);
        expect(clusters[0].index).toBe(1);
    });

    it('gives server0 a different accent color than server1', () => {
        const cfg = AppConfigSchema.parse({
            unifi: { host: 'https://192.168.1.1', apiKey: 'key' },
            serverPattern: '^server(\\d+)\\.lan$'
        });
        const clusters = parseDnsRecords(
            [
                aRecord('server0.lan', '10.0.0.1'),
                aRecord('server1.lan', '10.0.0.2'),
                aRecord('a.lan', '10.0.0.1'),
                aRecord('b.lan', '10.0.0.2')
            ],
            cfg
        );
        expect(clusters).toHaveLength(2);
        expect(clusters[0].color).not.toBe(clusters[1].color);
    });
});

describe('parseDnsRecords paths config', () => {
    const records = [
        aRecord('server1.home', '10.0.0.1'),
        aRecord('traefik.server1.home', '10.0.0.1')
    ];

    const urlFor = (path: string): string => {
        const cfg = AppConfigSchema.parse({
            unifi: { site: 'default' },
            serverPattern: '^server(\\d+)\\.home$',
            paths: { traefik: path }
        });
        return parseDnsRecords(records, cfg)[0].services[0].url;
    };

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

describe('parseDnsRecords cluster identity', () => {
    it('labels a cluster after its anchor host, not a hardcoded "server" prefix', () => {
        const cfg = AppConfigSchema.parse({ unifi: {}, serverPattern: '^node(\\d+)\\.lan$' });
        const clusters = parseDnsRecords(
            [aRecord('node1.lan', '10.0.0.1'), aRecord('app.lan', '10.0.0.1')],
            cfg
        );
        expect(clusters[0].label).toBe('node1');
    });
});
