import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@opentelemetry/sdk-node', () => ({
    NodeSDK: vi.fn(function () {
        return { start: vi.fn(), shutdown: vi.fn(() => Promise.resolve()) };
    })
}));
vi.mock('node:module', () => ({ register: vi.fn() }));

const { OpenTelemetryService } = await import('./OpenTelemetryService.js');

describe('OpenTelemetryService.shutdown', () => {
    afterEach(() => vi.useRealTimers());

    it('Should not leave the timeout timer pending once the flush has finished', async () => {
        const timers = (): number => process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length;
        const before = timers();
        const service = new OpenTelemetryService();
        service.init({ otel: { metrics: { enabled: true, exporter: { url: 'http://x' } } }, service: 's', version: '1' });

        await service.shutdown();

        // A pending, ref'd 3s timer keeps the event loop alive after a fast flush, so a
        // process that exits by draining its loop lingers for the whole budget.
        expect(timers()).toBe(before);
    });
});
