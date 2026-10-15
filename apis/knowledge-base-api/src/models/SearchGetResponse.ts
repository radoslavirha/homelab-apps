import { AdditionalProperties, CollectionOf, Description, Enum, Example, Required } from '@tsed/schema';
import { SearchMode } from './SearchMode.enum.js';
import { SearchResult } from './SearchResult.js';

@Description('Search results, best first. Superseded notes and abandoned specs are ranked last, not hidden.')
@AdditionalProperties(false)
export class SearchGetResponse {
    @Description('VECTOR: vector leg only (the default weights). HYBRID: both legs fused. FULLTEXT: no searched knowledge base has a model, or the embedder was unreachable.')
    @Required()
    @Enum(SearchMode)
    @Example(SearchMode.Vector)
    public mode: SearchMode;

    @Description('Embedding models the question was embedded with. Empty in FULLTEXT mode.')
    @Required()
    @CollectionOf(String)
    @Example(['embeddinggemma:300m'])
    public models: string[];

    @Required()
    @CollectionOf(SearchResult)
    public results: SearchResult[];
}
