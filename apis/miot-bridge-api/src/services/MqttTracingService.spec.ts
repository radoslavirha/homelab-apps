import { PlatformTest } from '@tsed/platform-http/testing';
import { SpanKind, trace } from '@opentelemetry/api';
import {
    InMemorySpanExporter,
    NodeTracerProvider,
    SimpleSpanProcessor,
    type ReadableSpan
} from '@opentelemetry/sdk-trace-node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from './ConfigService.js';
import { MqttTracingService } from './MqttTracingService.js';

const TOPIC = 'miot-bridge/device/442/command';
const TOPIC_TEMPLATE = 'miot-bridge/device/{deviceId}/command';
const SENDER_TRACE_ID = '0af7651916cd43dd8448eb211c80319c';
const SENDER_SPAN_ID = 'b7ad6b7169203331';

const exporter = new InMemorySpanExporter();

const spans = (): ReadableSpan[] => exporter.getFinishedSpans();

describe('MqttTracingService', () => {
    let service: MqttTracingService;
    let configService: ConfigService;

    beforeAll(() => {
        new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }).register();
    });

    afterAll(() => {
        trace.disable();
    });

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        exporter.reset();
        configService = PlatformTest.get<ConfigService>(ConfigService);
        service = PlatformTest.get<MqttTracingService>(MqttTracingService);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    describe('with the broker configured', () => {
        beforeEach(() => {
            vi.spyOn(configService, 'config', 'get').mockReturnValue({
                ...configService.config,
                mqtt: { enabled: true, url: 'mqtt://server.home:1883', clientId: 'miot-bridge' }
            } as typeof configService.config);
        });

        it('consume runs the handler in a consumer span carrying the broker identity and the call site\'s topic', () => {
            const result = service.consume({ topic: TOPIC, topicTemplate: TOPIC_TEMPLATE, qos: 1 }, () => 'handled');

            const [span] = spans();
            expect(result).toBe('handled');
            expect(span.kind).toBe(SpanKind.CONSUMER);
            expect(span.attributes).toMatchObject({
                'messaging.client.id': 'miot-bridge',
                'server.address': 'server.home',
                'server.port': 1883,
                'messaging.destination.name': TOPIC,
                'messaging.mqtt.qos': 1
            });
        });

        it('consume continues the trace the sender put in the user properties', () => {
            service.consume(
                { topic: TOPIC, topicTemplate: TOPIC_TEMPLATE, userProperties: { traceparent: `00-${SENDER_TRACE_ID}-${SENDER_SPAN_ID}-01` } },
                () => undefined
            );

            const [span] = spans();
            expect(span.spanContext().traceId).toBe(SENDER_TRACE_ID);
            expect(span.parentSpanContext?.spanId).toBe(SENDER_SPAN_ID);
        });

        it('publish runs the call in a producer span carrying the broker identity, handing it the trace to propagate', () => {
            let propagated: Record<string, string> = {};

            service.publish({ topic: TOPIC, topicTemplate: TOPIC_TEMPLATE }, (userProperties) => {
                propagated = userProperties;
            });

            const [span] = spans();
            expect(span.kind).toBe(SpanKind.PRODUCER);
            expect(span.attributes).toMatchObject({ 'messaging.client.id': 'miot-bridge', 'server.address': 'server.home', 'server.port': 1883 });
            expect(propagated.traceparent).toBe(`00-${span.spanContext().traceId}-${span.spanContext().spanId}-01`);
        });
    });

    describe('without a broker configured', () => {
        it('still traces, with no broker attributes', () => {
            service.publish({ topic: TOPIC, topicTemplate: TOPIC_TEMPLATE }, () => undefined);

            const [span] = spans();
            expect(span.attributes['messaging.destination.name']).toBe(TOPIC);
            expect(span.attributes).not.toHaveProperty('server.address');
            expect(span.attributes['messaging.client.id']).toBeUndefined();
        });
    });
});
