import { AdditionalProperties, Name, Nullable, Property } from '@tsed/schema';

/** A `knowledge_bases` row. */
@AdditionalProperties(false)
export class KnowledgeBaseDTO {
    @Property() public id: string;
    @Property() public source: string;
    /** `ts_config::text`. */
    @Property() @Name('ts_config') public tsConfig: string;
    @Nullable(String) public cursor: string | null;
    @Nullable(Date) @Name('last_run_started_at') public lastRunStartedAt: Date | null;
    @Nullable(Date) @Name('last_run_finished_at') public lastRunFinishedAt: Date | null;
    @Nullable(String) @Name('last_run_outcome') public lastRunOutcome: string | null;
    @Nullable(String) @Name('last_run_error') public lastRunError: string | null;
    @Nullable(Date) @Name('last_success_at') public lastSuccessAt: Date | null;
}
