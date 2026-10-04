import { AdditionalProperties, Description, Example, Property, Required } from '@tsed/schema';

/**
 * A property-value observation on its way to the outbound notification transport.
 * The MQTT message body is `{ [property]: value }`, published to the device's notifications topic.
 */
@AdditionalProperties(false)
export class NotificationPayload {
    @Required()
    @Property(Number)
    @Description('Xiaomi device ID.')
    public deviceId: number;

    @Required()
    @Property(String)
    @Description('Miot spec composite property key, e.g. "vacuum:mode".')
    @Example('vacuum:mode')
    public property: string;

    @Property()
    @Description('Current property value returned by the device.')
    public value: unknown;
}
