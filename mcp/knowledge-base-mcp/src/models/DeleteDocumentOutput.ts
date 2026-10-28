import { Description, Property, Required } from '@tsed/schema';

@Description('The document was deleted; git history keeps it.')
export class DeleteDocumentOutput {
    @Required()
    @Property()
    public id: string;

    @Description('The commit the delete made.')
    @Required()
    @Property()
    public commit: string;
}
