import { AdditionalProperties, Description, Example, Nullable, Required } from '@tsed/schema';

@Description('A knowledge base\'s conventions: the file in its source that says how its documents are written. All null when the knowledge base names none.')
@AdditionalProperties(false)
export class ConventionsGetResponse {
    @Required()
    @Example('development')
    public kb: string;

    @Description('The file in the source, as configured in `conventionsPath`.')
    @Required()
    @Nullable(String)
    @Example('README.md')
    public path: string | null;

    @Description('The file\'s whole text, as the source holds it now — not the indexed copy.')
    @Required()
    @Nullable(String)
    public markdown: string | null;

    @Description('The file\'s revision in the source (for git, the blob SHA).')
    @Required()
    @Nullable(String)
    public version: string | null;
}
