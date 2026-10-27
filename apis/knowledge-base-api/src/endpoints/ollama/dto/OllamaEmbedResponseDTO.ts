import { AdditionalProperties, CollectionOf, Property } from '@tsed/schema';

/** `POST /api/embed` response: one L2-normalised vector per input, in input order. */
@AdditionalProperties(false)
export class OllamaEmbedResponseDTO {
    @Property() public model: string;
    @CollectionOf(Array) public embeddings: number[][];
}
