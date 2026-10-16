import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ShortIdService } from './ShortIdService.js';

describe('ShortIdService', () => {
    let service: ShortIdService;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        service = PlatformTest.get<ShortIdService>(ShortIdService);
    });
    afterEach(PlatformTest.reset);

    it('returns a 4 character slug', () => {
        const slug = service.generate();
        expect(slug).toHaveLength(4);
    });

    it('returns slugs from the lowercase alphanumeric alphabet', () => {
        for (let i = 0; i < 50; i++) {
            const slug = service.generate();
            expect(slug).toMatch(/^[a-z0-9]{4}$/);
        }
    });

    it('produces distinct slugs across many calls', () => {
        const set = new Set<string>();
        for (let i = 0; i < 200; i++) {
            set.add(service.generate());
        }
        expect(set.size).toBeGreaterThan(150);
    });
});
