import { AdditionalProperties, Description, Example, Format, Nullable, Property, Required } from '@tsed/schema';

@Description('One chunk that matched, with enough to decide whether to read the whole document.')
@AdditionalProperties(false)
export class SearchResult {
    @Description('Knowledge base the document belongs to.')
    @Required()
    @Example('development')
    public kb: string;

    @Description('Document id within its knowledge base — for git, the file path. Pass it to GET /documents.')
    @Required()
    @Example('raw/2026-01-01-configmap-env-restart.md')
    public externalId: string;

    @Description('The section that matched: externalId#heading-slug.')
    @Required()
    @Example('raw/2026-01-01-configmap-env-restart.md#fact')
    public anchor: string;

    @Description('Document title.')
    @Required()
    @Nullable(String)
    public title: string | null;

    @Description('Heading path of the section, e.g. "Decisions › 3. Run it with …". Empty before the first heading.')
    @Required()
    public heading: string;

    @Description('Excerpt around the matched terms, terms in **bold**; the section start for a meaning-only match.')
    @Required()
    public snippet: string;

    @Description('Reciprocal rank fusion score. Comparable within one response only.')
    @Required()
    @Example(0.0325)
    public score: number;

    @Description('Document date (YYYY-MM-DD), when the source has one.')
    @Required()
    @Nullable(String)
    @Format('date')
    public date: string | null;

    @Description('Link to the original.')
    @Required()
    @Nullable(String)
    public url: string | null;

    @Description('Source-specific fields, e.g. area, type, status, repos for the development knowledge base.')
    @Required()
    @Property(Object)
    public metadata: Record<string, unknown>;
}
