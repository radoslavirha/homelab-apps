import { AdditionalProperties, Description, Example, Required } from '@tsed/schema';

@Description('One embedding model of a knowledge base.')
@AdditionalProperties(false)
export class ModelStatus {
    @Required()
    @Example('embeddinggemma:300m')
    public name: string;

    @Required()
    @Example(768)
    public dimensions: number;

    @Description('Whether this model answers questions — the first of the KB\'s models.')
    @Required()
    public active: boolean;

    @Description('Chunks with a vector from this model.')
    @Required()
    public embedded: number;

    @Description('Chunks still waiting for one.')
    @Required()
    public pending: number;
}
