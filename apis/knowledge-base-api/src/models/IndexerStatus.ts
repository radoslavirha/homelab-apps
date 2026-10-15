import { AdditionalProperties, Description, Required } from '@tsed/schema';

@Description('The indexing loop of this pod.')
@AdditionalProperties(false)
export class IndexerStatus {
    @Required()
    public enabled: boolean;

    @Required()
    public intervalMs: number;

    @Description('A run is in progress in this pod.')
    @Required()
    public running: boolean;
}
