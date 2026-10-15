import { AdditionalProperties, CollectionOf } from '@tsed/schema';
import { MiotSpecV2InstanceDTO } from './MiotSpecV2InstanceDTO.js';

/** Envelope of the `/instances` response. */
@AdditionalProperties(false)
export class MiotSpecV2InstancesDTO {
    @CollectionOf(MiotSpecV2InstanceDTO) public instances: MiotSpecV2InstanceDTO[];
}
