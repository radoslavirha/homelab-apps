import { describe, expect, it } from 'vitest';
import { parseDnsRecords } from './parseDns.js';
import { AppConfigSchema } from '../runtime/RuntimeConfig.js';
import type { DnsRecord } from '../types.js';

const aRecord = (key: string, value: string): DnsRecord => ({ key, value, record_type: 'A', enabled: true });

describe('parseDnsRecords cluster identity', () => {
    it('gives server0 a different accent color than server1', () => {
        const cfg = AppConfigSchema.parse({ unifi: {}, serverPattern: '^server(\\d+)\\.lan$' });
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
