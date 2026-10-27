import { AdditionalProperties, CollectionOf, Name, Property } from '@tsed/schema';

/** `POST /api/embed` request. */
@AdditionalProperties(false)
export class OllamaEmbedRequestDTO {
    @Property() public model: string;
    @CollectionOf(String) public input: string[];
    /** How long the model stays loaded after this call, e.g. `1m`. */
    @Property() @Name('keep_alive') public keepAlive: string;
    /** Cut inputs longer than the model's context instead of failing. */
    @Property() public truncate: boolean;
}
