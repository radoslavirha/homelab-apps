import { AdditionalProperties, Description, Example, Pattern, Property, Required } from '@tsed/schema';
import { DEVICE_TOKEN_PATTERN } from './DeviceToken.js';

@Description('Request model for device registration (persists to cache).')
@AdditionalProperties(false)
export class DeviceRequest {
    @Description('IP address of the Xiaomi device.')
    @Required()
    @Property()
    public address: string;

    @Description('Device token (32-char hex string), obtained from Xiaomi Cloud Tokens Extractor.')
    @Required()
    @Pattern(DEVICE_TOKEN_PATTERN)
    @Property()
    public token: string;

    @Description('Device model identifier (e.g. xiaomi.vacuum.c102gl).')
    @Required()
    @Property()
    @Example('xiaomi.vacuum.c102gl')
    public model: string;
}
