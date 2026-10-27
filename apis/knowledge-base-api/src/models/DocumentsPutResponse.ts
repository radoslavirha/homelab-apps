import { AdditionalProperties, Description, Example, Required } from '@tsed/schema';

@Description('The document was committed.')
@AdditionalProperties(false)
export class DocumentsPutResponse {
    @Required()
    @Example('work/2026-10-20-kb-write-tool/spec.md')
    public id: string;

    @Description('Its new version (for git, the blob SHA): what the next rewrite passes. No need to wait for indexing.')
    @Required()
    public version: string;

    @Description('The commit the write made.')
    @Required()
    public commit: string;
}
