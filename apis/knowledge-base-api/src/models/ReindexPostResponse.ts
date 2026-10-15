import { AdditionalProperties, CollectionOf, Description, Example, Required } from '@tsed/schema';

@Description('An indexing run was requested.')
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

    @Description('A run was already in progress in this pod; this one starts when it ends.')
    @Required()
    public queued: boolean;
}
