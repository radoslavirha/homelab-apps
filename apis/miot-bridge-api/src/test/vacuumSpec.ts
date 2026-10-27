/**
 * A MIoT spec in the wire format miot-spec.org publishes — kebab-case keys (`value-list`), lowercase
 * `access` and `format` — trimmed to one property with a value list and one action. Storage keeps
 * the spec in this shape, so a mapper that writes it must write these spellings back.
 */
export const VACUUM_SPEC = {
    type: 'urn:miot-spec-v2:device:vacuum:0000A006:xiaomi-c102gl:1',
    description: 'Robot Cleaner',
    services: [
        {
            iid: 2,
            type: 'urn:miot-spec-v2:service:vacuum:00007810:xiaomi-c102gl:1',
            description: 'Robot Cleaner',
            properties: [
                {
                    iid: 1,
                    type: 'urn:miot-spec-v2:property:status:00000007:xiaomi-c102gl:1',
                    description: 'Status',
                    format: 'uint8',
                    access: ['read', 'notify'],
                    'value-list': [
                        { value: 1, description: 'Sweeping' },
                        { value: 2, description: 'Idle' }
                    ]
                }
            ],
            actions: [
                {
                    iid: 1,
                    type: 'urn:miot-spec-v2:action:start-sweep:00002804:xiaomi-c102gl:1',
                    description: 'Start Sweep',
                    in: [],
                    out: []
                }
            ]
        }
    ]
};
