import { Description, MinLength, Nullable, Property, Required } from '@tsed/schema';

@Description('This knowledge base\'s conventions.')
export class ConventionsOutput {
    @Description('Where the conventions live in the knowledge base\'s source, e.g. `README.md`; null when it publishes none.')
    @Required()
    @Nullable(String)
    public path: string | null;

    // Not `content`: see ReadOutput.markdown.
    @Description('The conventions as markdown; empty when the knowledge base publishes none.')
    @Required()
    @MinLength(0)
    @Property()
    public markdown: string;
}
