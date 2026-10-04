import { describe, beforeEach, afterEach, expect, it } from 'vitest';
import { PlatformTest } from '@tsed/platform-http/testing';
import { TestContainersMongo } from '@tsed/testcontainers-mongo';
import { Server } from '../Server.js';
import { QrCodeService } from './QrCodeService.js';

describe('QrCodeService with a malformed id', () => {
    let service: QrCodeService;
    beforeEach(() => TestContainersMongo.create(Server));
    beforeEach(() => {
        service = PlatformTest.get<QrCodeService>(QrCodeService);
    });
    afterEach(() => TestContainersMongo.reset());

    it('getById resolves undefined (handlers turn that into 404)', async () => {
        await expect(service.getById('not-an-id')).resolves.toBeUndefined();
    });

    it('update resolves undefined (handlers turn that into 404)', async () => {
        await expect(service.update('not-an-id', { active: false })).resolves.toBeUndefined();
    });

    it('delete resolves without throwing', async () => {
        await expect(service.delete('not-an-id')).resolves.not.toThrow();
    });
});
