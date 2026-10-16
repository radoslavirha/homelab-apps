import { AdditionalProperties, Description, Enum, Format, Nullable, Required } from '@tsed/schema';
import { RunOutcome } from './RunOutcome.enum.js';

@Description('The last indexing run of one knowledge base.')
@AdditionalProperties(false)
export class LastRunStatus {
    @Required()
    @Format('date-time')
    public startedAt: Date;

    @Description('Null while the run is in progress (or was cut short by a restart).')
    @Required()
    @Nullable(Date)
    @Format('date-time')
    public finishedAt: Date | null;

    @Required()
    @Nullable(String)
    @Enum(RunOutcome)
    public outcome: RunOutcome | null;

    @Description('Why the run failed.')
    @Required()
    @Nullable(String)
    public error: string | null;
}
