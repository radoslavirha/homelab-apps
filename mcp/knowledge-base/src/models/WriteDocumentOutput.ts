import { Description, Property, Required } from '@tsed/schema';

@Description('The document was committed.')
export class WriteDocumentOutput {
    @Required()
    @Property()
    public id: string;

    @Description('Its new version: pass it to the next write of this document. No need to `read` again.')
    @Required()
    @Property()
    public version: string;

    @Description('The commit the write made.')
    @Required()
    @Property()
    public commit: string;
}
