import { CollectionOf, Description, Required } from '@tsed/schema';
import { SearchHit } from './SearchHit.js';

@Description('Matching sections, best first.')
export class SearchOutput {
    @Required()
    @CollectionOf(SearchHit)
    public hits: SearchHit[];
}
