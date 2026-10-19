import { Description, MinLength, Nullable, Property, Required } from '@tsed/schema';

@Description('A section of a document that matched, best first.')
export class SearchHit {
    @Description('Knowledge base it is in; pass it to `read`.')
    @Required()
    @Property()
    public kb: string;

    @Description('Document id; pass it to `read` for the whole document.')
    @Required()
    @Property()
    public id: string;

    @Description('The section within the document (`id#heading`).')
    @Required()
    @Property()
    public anchor: string;

    @Nullable(String)
    public title: string | null;

    @Description("The section's heading path; empty for the text before a document's first heading.")
    @Required()
    // `@Required()` alone also refuses an empty string (minLength 1), and real sections have one.
    // Not `@Allow('')`: it leaves `minLength: undefined`, which platform-mcp cannot convert.
    @MinLength(0)
    @Property()
    public heading: string;

    @Description('An excerpt; matched words are in **bold**.')
    @Required()
    @Property()
    public snippet: string;

    @Description("The document's date, when it has one.")
    @Nullable(String)
    public date: string | null;
}
