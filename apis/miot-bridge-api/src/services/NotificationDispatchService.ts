import { Inject, Service, Scope, ProviderScope, type OnDestroy } from '@tsed/di';
import { CommonUtils, ObjectUtils } from '@radoslavirha/utils';
import { context, SpanStatusCode, type Context } from '@opentelemetry/api';
import type { MqttClient } from 'mqtt';
import type { PropertyChangeEvent } from '../models/PropertyChangeEvent.js';
import { NotificationPayload } from '../models/NotificationPayload.js';
import { MqttClientProvider } from '../providers/MqttClientProvider.js';
import { ConfigService } from './ConfigService.js';
import { MqttTopicService } from './MqttTopicService.js';
import { MqttTracingService } from './MqttTracingService.js';
import { BaseLogger, Logger } from '@radoslavirha/tsed-logger';
import { ATTR_MIOT_DEVICE_ID, ATTR_MIOT_PROPERTY, identifierAttribute } from '../otel/telemetry.js';

/** QoS used for outbound notification publishes. */
const QOS = 1;

/**
 * Default minimum gap between two publishes when `mqtt.notifications.publishIntervalMs` is unset.
 *
 * Measured against the Loxone Miniserver: 1 s between messages arrived, 500 ms lost one. The margin
 * above 1 s is there so that timer jitter cannot close the gap.
 */
export const DEFAULT_PUBLISH_INTERVAL_MS = 1_500;

/** A notification waiting for its turn, with the trace it belongs to. */
interface QueuedNotification {
    payload: NotificationPayload;
    context: Context;
}

/**
 * Central hub for all inbound property-value observations, regardless of transport.
 *
 * Sources:
 * - {@link DevicePropertyPollerService} — periodic polls (`PROPERTY_CHANGED` events)
 * - {@link DeviceCommandService} — direct GET_PROPERTY calls via HTTP / MQTT
 *
 * Outbound transport: MQTT publish. MQTT is the only outbound channel to the controllers;
 * UDP stays solely for the MIoT protocol to the devices themselves.
 *
 * ### Why publishes are paced
 * Loxone reads every property through one subscribe block, and messages closer together than about
 * a second never reach its command recognition blocks. Consumables tend to change in the same tick,
 * and a restart publishes every subscription within milliseconds. The poller only publishes on
 * change, so a value lost that way stayed wrong in Loxone until it changed again, which for a
 * consumable can be days. Every publish goes through one queue, so REST and the poller cannot
 * overlap either.
 *
 * A property already waiting has its value replaced in place: the newest value is the only one
 * worth sending, and it keeps the queue bounded by the number of subscribed properties.
 */
@Service()
@Scope(ProviderScope.SINGLETON)
export class NotificationDispatchService implements OnDestroy {
    private readonly logger: BaseLogger;

    private readonly queue: QueuedNotification[] = [];

    private timer: NodeJS.Timeout | undefined;

    /** Start of the last publish. Far in the past at boot, so the first message goes out at once. */
    private lastPublishAt = Number.NEGATIVE_INFINITY;

    constructor(
        private readonly configService: ConfigService,
        @Inject(MqttClientProvider) private readonly mqttClient: MqttClient | null,
        private readonly mqttTopicService: MqttTopicService,
        private readonly mqttTracingService: MqttTracingService,
        logger: Logger
    ) {
        this.logger = logger.child('NOTIFICATION_DISPATCH');
    }

    /**
     * Receives a property-value observation and queues it for an MQTT publish when
     * MQTT notifications are enabled.
     */
    public receive(event: PropertyChangeEvent): void {
        const payload = CommonUtils.buildModelStrict(NotificationPayload, {
            deviceId: event.miotDeviceId,
            property: event.property,
            value: event.newValue
        });

        const config = this.configService.config;

        if (ObjectUtils.isEnabled(config.mqtt?.notifications) && this.mqttClient) {
            this.enqueue(payload);
        }
    }

    /**
     * Drops whatever is still waiting. The poller's last values live in memory too, so the next
     * pod publishes every subscribed property anyway.
     */
    public $onDestroy(): void {
        if (CommonUtils.notNil(this.timer)) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }

        if (!CommonUtils.isEmpty(this.queue)) {
            this.logger.info(`Dropping ${this.queue.length} queued notification(s) on shutdown.`);
            this.queue.length = 0;
        }
    }

    private enqueue(payload: NotificationPayload): void {
        const queued: QueuedNotification = { payload, context: context.active() };
        const waiting = this.queue.findIndex(
            ({ payload: other }) => other.deviceId === payload.deviceId && other.property === payload.property
        );

        if (waiting >= 0) {
            this.queue[waiting] = queued;
        } else {
            this.queue.push(queued);
        }

        this.scheduleNext();
    }

    private scheduleNext(): void {
        if (CommonUtils.notNil(this.timer) || CommonUtils.isEmpty(this.queue)) {
            return;
        }

        const interval = this.configService.config.mqtt?.notifications?.publishIntervalMs ?? DEFAULT_PUBLISH_INTERVAL_MS;
        const delay = this.lastPublishAt + interval - Date.now();

        if (delay > 0) {
            this.timer = setTimeout(() => this.publishNext(), delay);
        } else {
            this.publishNext();
        }
    }

    private publishNext(): void {
        this.timer = undefined;

        const next = this.queue.shift();

        if (CommonUtils.notNil(next)) {
            this.lastPublishAt = Date.now();
            // Restored explicitly: the span must join the read that observed the value, and a read
            // the poller sampled out must stay untraced instead of starting a trace of its own.
            void context.with(next.context, () => this.sendMqtt(next.payload));
        }

        this.scheduleNext();
    }

    private async sendMqtt(payload: NotificationPayload): Promise<void> {
        const topic = this.mqttTopicService.getNotificationsTopic(payload.deviceId);
        const message = JSON.stringify({ [payload.property]: payload.value ?? null });

        await this.mqttTracingService.publish(
            {
                topic,
                topicTemplate: this.mqttTopicService.getNotificationsTopicTemplate(),
                qos: QOS,
                bodySize: Buffer.byteLength(message),
                attributes: { [ATTR_MIOT_DEVICE_ID]: identifierAttribute(payload.deviceId), [ATTR_MIOT_PROPERTY]: payload.property }
            },
            async (userProperties, span) => {
                try {
                    await this.mqttClient!.publishAsync(topic, message, { qos: QOS, properties: { userProperties } });
                    this.logger.debug('NOTIFICATION_MQTT_SENT', {
                        topic,
                        deviceId: payload.deviceId,
                        property: payload.property
                    });
                } catch (error) {
                    // Marked on the span but not rethrown: `receive` is fire-and-forget, and an
                    // unreachable broker must not surface as an unhandled rejection.
                    const reason = error instanceof Error ? error.message : String(error);
                    span.setStatus({ code: SpanStatusCode.ERROR, message: reason });
                    this.logger.warn('NOTIFICATION_MQTT_ERROR', {
                        topic,
                        deviceId: payload.deviceId,
                        property: payload.property,
                        message: reason
                    });
                }
            }
        );
    }

}
