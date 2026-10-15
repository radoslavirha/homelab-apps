import { Injectable, Scope, ProviderScope } from '@tsed/di';
import { InjectHttpClient, type HttpClient } from '@radoslavirha/tsed-http-provider';
import { Serializer } from '@radoslavirha/tsed-common';
import { ExternalApi } from '../../models/config/ExternalApi.enum.js';
import { MiotSpecV2InstancesDTO } from './dto/MiotSpecV2InstancesDTO.js';
import { MiotSpecV2DTO } from './dto/MiotSpecV2DTO.js';

const INSTANCES_PATH = '/instances';
const INSTANCE_PATH = '/instance';

/**
 * Service for interacting with the miot-spec.org API.
 */
@Injectable()
@Scope(ProviderScope.SINGLETON)
export class MiotSpecV2Endpoint {
    @InjectHttpClient(ExternalApi.MiotSpec)
    private readonly client!: HttpClient;

    /**
     * Absolute URL of a model's spec document. It is persisted on the device
     * record, so it is composed from the configured base URL rather than left
     * relative.
     */
    public specUrl(type: string): string {
        return `${this.client.baseURL ?? ''}${INSTANCE_PATH}?type=${type}`;
    }

    /**
     * Lists the released instances (one per model and spec version) known to miot-spec.org.
     */
    public async fetchInstances(): Promise<MiotSpecV2InstancesDTO> {
        const response = await this.client.get<object>(INSTANCES_PATH, { params: { status: 'released' } });

        return Serializer.deserialize(response, MiotSpecV2InstancesDTO);
    }

    /**
     * Fetches the raw MIoT spec JSON of one instance.
     * @param type Instance type URN, as listed by `fetchInstances`
     */
    public async fetchSpec(type: string): Promise<MiotSpecV2DTO> {
        const spec = await this.client.get<object>(INSTANCE_PATH, { params: { type } });

        return Serializer.deserialize(spec, MiotSpecV2DTO);
    }
}
