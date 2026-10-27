import { AdditionalProperties, Property } from '@tsed/schema';

/** Chunks of one knowledge base with a vector from one model. */
@AdditionalProperties(false)
export class ModelCountDTO {
    @Property() public model: string;
    @Property() public chunks: number;
}
