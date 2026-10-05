import { describe, expect, it } from 'vitest';
import { parseDnsRecords } from './parseDns.js';
import { AppConfigSchema } from '../runtime/RuntimeConfig.js';
import type { DnsRecord } from '../types.js';

const aRecord = (key: string, value: string): DnsRecord => ({ key, value, record_type: 'A', enabled: true });

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
