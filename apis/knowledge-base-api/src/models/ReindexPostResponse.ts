import { AdditionalProperties, CollectionOf, Description, Enum, Example, Required } from '@tsed/schema';
import { ReindexState } from './ReindexState.enum.js';

@Description('An indexing run was started, or queued behind the one in progress.')
@AdditionalProperties(false)
export class ReindexPostResponse {
    @Description('Knowledge bases the run covers.')
    @Required()
    @CollectionOf(String)
    @Example(['dev'])
    public knowledgeBases: string[];

    @Description('The run ignores the stored cursor and asks the source for everything.')
    @Required()
    public full: boolean;

    @Description('STARTED: the run is in progress. QUEUED: a run is in progress in this pod; this one follows it. When another pod holds the index lock, the answer is 409 instead.')
    @Required()
    @Enum(ReindexState)
    public state: ReindexState;
}
