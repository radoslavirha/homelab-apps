import { EventEmitter } from 'events';
import { PlatformTest } from '@tsed/platform-http/testing';
import { context, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import {
    InMemorySpanExporter,
    NodeTracerProvider,
    SimpleSpanProcessor,
    type ReadableSpan
} from '@opentelemetry/sdk-trace-node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PropertyChangeEvent } from '../models/PropertyChangeEvent.js';
import { MqttClientProvider } from '../providers/MqttClientProvider.js';
import { ConfigService } from './ConfigService.js';
import { DEFAULT_PUBLISH_INTERVAL_MS, NotificationDispatchService } from './NotificationDispatchService.js';

const DEVICE_ID = 442;
const NOTIFICATIONS_TOPIC = `miot-bridge/device/${DEVICE_ID}/notifications`;
const NOTIFICATION_SPAN = 'publish miot-bridge/device/{deviceId}/notifications';

class FakeMqttClient extends EventEmitter {
    public connected = true;
    public readonly publishAsync = vi.fn(async () => undefined);
    public readonly endAsync = vi.fn(async () => undefined);
}

const exporter = new InMemorySpanExporter();

const spans = (): ReadableSpan[] => exporter.getFinishedSpans();

const event = (): PropertyChangeEvent => ({
    deviceId: 'device-storage-id',
    miotDeviceId: DEVICE_ID,
    property: 'vacuum:status',
    oldValue: 'idle',
    newValue: 'sweeping',
    timestamp: Date.now()
});

describe('NotificationDispatchService', () => {
    let client: FakeMqttClient;
    let service: NotificationDispatchService;

    beforeAll(() => {
        new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }).register();
    });

    afterAll(() => {
        trace.disable();
    });

    beforeEach(async () => {
        exporter.reset();
        client = new FakeMqttClient();
        await PlatformTest.create({ imports: [{ token: MqttClientProvider, use: client }] });

        // `config/test.json` has MQTT off; the dispatch path is what is under test here, so it
        // is switched on without touching a broker — the client above is a stub.
        const configService = PlatformTest.get<ConfigService>(ConfigService);
        vi.spyOn(configService, 'config', 'get').mockReturnValue({
            ...configService.config,
            mqtt: { enabled: true, url: 'mqtt://server.home:1883', clientId: 'miot-bridge', notifications: { enabled: true } }
        } as typeof configService.config);

        service = PlatformTest.get<NotificationDispatchService>(NotificationDispatchService);
    });

    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());
    afterEach(() => vi.useRealTimers());

    const usePublishInterval = (publishIntervalMs: number): void => {
        const configService = PlatformTest.get<ConfigService>(ConfigService);
        vi.spyOn(configService, 'config', 'get').mockReturnValue({
            ...configService.config,
            mqtt: { enabled: true, url: 'mqtt://server.home:1883', notifications: { enabled: true, publishIntervalMs } }
        } as typeof configService.config);
    };

    const change = (property: string, newValue: number): PropertyChangeEvent => ({ ...event(), property, newValue });

    const publishedBodies = (): string[] => (client.publishAsync.mock.calls as unknown as [string, string][]).map(([, body]) => body);

    // Loxone reads every property through one subscription and processes only the newest message
    // per 2 s, so a burst must leave the bridge one message at a time.
    it('Should send a burst one message per interval, in order', async () => {
        expect.assertions(4);
        vi.useFakeTimers();
        usePublishInterval(1_000);

        service.receive(change('brush-cleaner-9:brush-life-level', 90));
        service.receive(change('brush-cleaner-10:brush-life-level', 91));
        service.receive(change('filter:filter-life-level', 92));

        expect(publishedBodies()).toEqual([JSON.stringify({ 'brush-cleaner-9:brush-life-level': 90 })]);

        await vi.advanceTimersByTimeAsync(999);

        expect(client.publishAsync).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1);

        expect(client.publishAsync).toHaveBeenCalledTimes(2);

        await vi.advanceTimersByTimeAsync(1_000);

        expect(publishedBodies()).toEqual([
            JSON.stringify({ 'brush-cleaner-9:brush-life-level': 90 }),
            JSON.stringify({ 'brush-cleaner-10:brush-life-level': 91 }),
            JSON.stringify({ 'filter:filter-life-level': 92 })
        ]);
    });

    it('Should default to an interval above the 2 s Loxone evaluates a subscription at', () => {
        expect(DEFAULT_PUBLISH_INTERVAL_MS).toBeGreaterThan(2_000);
    });

    it('Should apply the default interval when none is configured', async () => {
        expect.assertions(2);
        vi.useFakeTimers();

        service.receive(change('brush-cleaner-9:brush-life-level', 90));
        service.receive(change('filter:filter-life-level', 92));
        await vi.advanceTimersByTimeAsync(DEFAULT_PUBLISH_INTERVAL_MS - 1);

        expect(client.publishAsync).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1);

        expect(client.publishAsync).toHaveBeenCalledTimes(2);
    });

    it('Should wait out the interval for a message arriving after the queue ran empty', async () => {
        expect.assertions(2);
        vi.useFakeTimers();
        usePublishInterval(1_000);

        service.receive(change('brush-cleaner-9:brush-life-level', 90));
        await vi.advanceTimersByTimeAsync(400);
        service.receive(change('filter:filter-life-level', 92));

        expect(client.publishAsync).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(600);

        expect(client.publishAsync).toHaveBeenCalledTimes(2);
    });

    it('Should send only the newest value of a property still waiting, in its original position', async () => {
        expect.assertions(1);
        vi.useFakeTimers();
        usePublishInterval(1_000);

        service.receive(change('vacuum:status', 1));
        service.receive(change('brush-cleaner-9:brush-life-level', 90));
        service.receive(change('filter:filter-life-level', 92));
        service.receive(change('brush-cleaner-9:brush-life-level', 89));
        await vi.advanceTimersByTimeAsync(5_000);

        expect(publishedBodies()).toEqual([
            JSON.stringify({ 'vacuum:status': 1 }),
            JSON.stringify({ 'brush-cleaner-9:brush-life-level': 89 }),
            JSON.stringify({ 'filter:filter-life-level': 92 })
        ]);
    });

    it('Should send everything at once when the interval is 0', () => {
        usePublishInterval(0);

        service.receive(change('brush-cleaner-9:brush-life-level', 90));
        service.receive(change('filter:filter-life-level', 92));

        expect(client.publishAsync).toHaveBeenCalledTimes(2);
    });

    it('Should drop what is queued on shutdown', async () => {
        expect.assertions(1);
        vi.useFakeTimers();
        usePublishInterval(1_000);

        service.receive(change('brush-cleaner-9:brush-life-level', 90));
        service.receive(change('filter:filter-life-level', 92));
        service.$onDestroy();
        await vi.advanceTimersByTimeAsync(5_000);

        expect(client.publishAsync).toHaveBeenCalledTimes(1);
    });

    // mqtt.js holds a publish made while offline and flushes all of them on reconnect, which is a
    // burst again. A rolling restart causes this: both pods share a client id and kick each other.
    it('Should keep messages queued while offline and pace them after a reconnect', async () => {
        expect.assertions(4);
        vi.useFakeTimers();
        usePublishInterval(1_000);

        service.receive(change('vacuum:mode', 1));
        client.connected = false;
        service.receive(change('brush-cleaner-9:brush-life-level', 90));
        service.receive(change('brush-cleaner-10:brush-life-level', 91));
        await vi.advanceTimersByTimeAsync(5_000);

        expect(client.publishAsync).toHaveBeenCalledTimes(1);

        client.connected = true;
        client.emit('connect');

        expect(client.publishAsync).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1_000);

        expect(client.publishAsync).toHaveBeenCalledTimes(2);

        await vi.advanceTimersByTimeAsync(1_000);

        expect(publishedBodies()).toEqual([
            JSON.stringify({ 'vacuum:mode': 1 }),
            JSON.stringify({ 'brush-cleaner-9:brush-life-level': 90 }),
            JSON.stringify({ 'brush-cleaner-10:brush-life-level': 91 })
        ]);
    });

    // mqtt.js resends an unacknowledged publish as soon as it reconnects, so the next message must
    // keep its distance from that resend even if the link was down for longer than the interval.
    it('Should wait a full interval after a reconnect while a timer was already running', async () => {
        expect.assertions(2);
        vi.useFakeTimers();
        usePublishInterval(1_000);

        service.receive(change('vacuum:mode', 1));
        service.receive(change('vacuum:status', 2));
        await vi.advanceTimersByTimeAsync(900);
        client.emit('connect');
        await vi.advanceTimersByTimeAsync(999);

        expect(client.publishAsync).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1);

        expect(client.publishAsync).toHaveBeenCalledTimes(2);
    });

    it('Should stop reacting to reconnects after shutdown', () => {
        service.$onDestroy();

        expect(client.listenerCount('connect')).toBe(0);
    });

    // A delayed publish runs from a timer, so without restoring the context it would lose the read
    // that observed the value, and a tick the poller sampled out would start a trace of its own.
    it('Should keep a delayed publish in the trace that observed the value', async () => {
        expect.assertions(1);
        vi.useFakeTimers();
        usePublishInterval(1_000);

        const tracer = trace.getTracer('test');
        const parent = tracer.startSpan('poll device');

        context.with(trace.setSpan(context.active(), parent), () => {
            service.receive(change('brush-cleaner-9:brush-life-level', 90));
            service.receive(change('filter:filter-life-level', 92));
        });
        parent.end();
        await vi.advanceTimersByTimeAsync(5_000);

        const delayed = spans().find((span) => span.attributes['miot.property'] === 'filter:filter-life-level');

        expect(delayed?.parentSpanContext?.spanId).toBe(parent.spanContext().spanId);
    });

    it('Should publish the property change to the notifications topic', async () => {
        service.receive(event());
        await vi.waitUntil(() => client.publishAsync.mock.calls.length > 0);

        expect(client.publishAsync).toHaveBeenCalledWith(
            NOTIFICATIONS_TOPIC,
            JSON.stringify({ 'vacuum:status': 'sweeping' }),
            expect.anything()
        );
    });

    it('Should raise a producer span carrying the broker identity', async () => {
        service.receive(event());
        await vi.waitUntil(() => spans().length > 0);

        const [span] = spans();

        expect(span.name).toBe(NOTIFICATION_SPAN);
        expect(span.kind).toBe(SpanKind.PRODUCER);
        expect(span.attributes).toMatchObject({
            'messaging.system': 'mqtt',
            'messaging.destination.name': NOTIFICATIONS_TOPIC,
            'messaging.client.id': 'miot-bridge',
            'server.address': 'server.home',
            'server.port': 1883,
            'miot.device.id': String(DEVICE_ID),
            'miot.property': 'vacuum:status'
        });
    });

    // The fan-out is best-effort across three transports; a dead broker must not take the
    // others down with it, but it must still be visible as a failed span.
    it('Should mark the span failed without rejecting when the broker refuses', async () => {
        client.publishAsync.mockRejectedValue(new Error('broker unreachable') as never);

        expect(() => service.receive(event())).not.toThrow();
        await vi.waitUntil(() => spans().length > 0);

        expect(spans()[0].status).toMatchObject({ code: SpanStatusCode.ERROR, message: 'broker unreachable' });
    });

    it('Should build the payload with a null for a missing value', async () => {
        service.receive({ ...event(), newValue: undefined } as PropertyChangeEvent);
        await vi.waitUntil(() => client.publishAsync.mock.calls.length > 0);

        const [, body] = client.publishAsync.mock.calls[0] as unknown as [string, string];

        expect(body).toBe(JSON.stringify({ 'vacuum:status': null }));
    });

    it('Should not publish when MQTT notifications are switched off', () => {
        const configService = PlatformTest.get<ConfigService>(ConfigService);
        vi.spyOn(configService, 'config', 'get').mockReturnValue({
            ...configService.config,
            mqtt: { enabled: true, url: 'mqtt://server.home:1883', notifications: { enabled: false } }
        } as typeof configService.config);

        service.receive(event());

        expect(client.publishAsync).not.toHaveBeenCalled();
    });
});
