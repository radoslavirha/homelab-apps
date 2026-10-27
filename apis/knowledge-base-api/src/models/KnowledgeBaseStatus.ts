import { AdditionalProperties, CollectionOf, Description, Example, Format, Nullable, Required } from '@tsed/schema';
import { AreaCount } from './AreaCount.js';
import { LastRunStatus } from './LastRunStatus.js';
import { ModelStatus } from './ModelStatus.js';

@Description('Index state of one knowledge base.')
@AdditionalProperties(false)
export class KnowledgeBaseStatus {
    @Required()
    @Example('development')
    public id: string;

    @Required()
    @Example('GIT')
    public source: string;

    @Description('Where the next run starts — for git, the indexed commit.')
    @Required()
    @Nullable(String)
    public cursor: string | null;

    @Required()
    @Nullable(LastRunStatus)
    public lastRun: LastRunStatus | null;

    @Required()
    @Nullable(Date)
    @Format('date-time')
    public lastSuccessAt: Date | null;

    @Required()
    public documents: number;

    @Required()
    public chunks: number;

    @Required()
    @CollectionOf(AreaCount)
    public areas: AreaCount[];

    @Required()
    @CollectionOf(ModelStatus)
    public models: ModelStatus[];
}
