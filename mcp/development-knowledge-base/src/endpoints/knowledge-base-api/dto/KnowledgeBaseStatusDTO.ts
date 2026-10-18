import { AdditionalProperties, Nullable, Property } from '@tsed/schema';

/** One knowledge base in `GET /status`, with only the fields this server uses. */
@AdditionalProperties(false)
export class KnowledgeBaseStatusDTO {
    @Property() public id: string;
    @Property() public documents: number;
    @Property() public chunks: number;
    @Nullable(Date) public lastSuccessAt: Date | null;
}
