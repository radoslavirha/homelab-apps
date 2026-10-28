import { Description, MinLength, Property, Required } from '@tsed/schema';

@Description('The document as the knowledge base holds it now.')
export class CurrentDocument {
    @Description('The whole markdown, frontmatter included.')
    @Required()
    @MinLength(0)
    @Property()
    public content: string;

    @Description('Its version: what the retry passes.')
    @Required()
    @Property()
    public version: string;
}
