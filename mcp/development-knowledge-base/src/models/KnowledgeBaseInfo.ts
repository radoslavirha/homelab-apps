import { Description, Integer, Nullable, Property, Required } from '@tsed/schema';

@Description('A knowledge base this server can search.')
export class KnowledgeBaseInfo {
    @Description('Pass as `kb` to `search` and `read`.')
    @Required()
    @Property()
    public id: string;

    @Description('What it holds.')
    @Nullable(String)
    public description: string | null;

    @Description('Documents indexed.')
    @Required()
    @Integer()
    public documents: number;

    @Description('When the index last caught up with its source.')
    @Nullable(Date)
    public lastIndexedAt: Date | null;
}
