import { AdditionalProperties, Description, Example, Format, Nullable, Property, Required } from '@tsed/schema';

@Description('A whole document as indexed.')
@AdditionalProperties(false)
export class DocumentsGetResponse {
    @Required()
    @Example('development')
    public kb: string;

    @Required()
    @Example('work/2026-01-07-example/spec.md')
    public externalId: string;

    @Required()
    @Nullable(String)
    public title: string | null;

    @Description('YYYY-MM-DD, when the source has one.')
    @Required()
    @Nullable(String)
    @Format('date')
    public date: string | null;

    @Description('Link to the original at the indexed revision.')
    @Required()
    @Nullable(String)
    public url: string | null;

    @Description('Indexed revision — for git, the file\'s blob SHA. Pass it back as `version` to rewrite or delete the document.')
    @Required()
    public version: string;

    @Required()
    @Property(Object)
    public metadata: Record<string, unknown>;

    @Description('The whole document as text, frontmatter included.')
    @Required()
    public content: string;
}
