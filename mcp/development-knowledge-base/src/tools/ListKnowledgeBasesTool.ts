import { Injectable } from '@tsed/di';
import { Tool } from '@tsed/platform-mcp';
import { Description, Returns } from '@tsed/schema';
import { ListKnowledgeBasesHandler } from '../handlers/ListKnowledgeBasesHandler.js';
import { ListKnowledgeBasesOutput } from '../models/ListKnowledgeBasesOutput.js';

@Injectable()
export class ListKnowledgeBasesTool {
    public constructor(private readonly handler: ListKnowledgeBasesHandler) {}

    @Tool('list_knowledge_bases', { title: 'List knowledge bases', annotations: { readOnlyHint: true, openWorldHint: false } })
    @Description(
        'List the knowledge bases you can search: what each one holds, how many documents it has and when it was last indexed. ' +
        '`search` covers all of them by default; pass one\'s `id` as `kb` to narrow a search.'
    )
    @Returns(200, ListKnowledgeBasesOutput)
    public list(): Promise<ListKnowledgeBasesOutput> {
        return this.handler.execute();
    }
}
