import { Description, MinLength, Nullable, Property, Required } from '@tsed/schema';

@Description('One whole document.')
export class ReadOutput {
    @Required()
    @Property()
    public kb: string;

    @Required()
    @Property()
    public id: string;

    @Nullable(String)
    public title: string | null;

    @Nullable(String)
    public date: string | null;

    @Description('Source-specific fields: area, type, status, repos, supersedes, …')
    @Required()
    @Property(Object)
    public metadata: Record<string, unknown>;

    // Not `content`: platform-mcp passes any result with a `content` key through as a finished
    // MCP result, without the structured content the output schema promises.
    @Description('The whole document, as markdown; empty for a document that is only frontmatter.')
    @Required()
    // See SearchHit.heading: an empty string is allowed this way, not with `@Allow('')`.
    @MinLength(0)
    @Property()
    public markdown: string;
}
