import { Description, Name, Property, Required } from '@tsed/schema';
import { CurrentDocument } from './CurrentDocument.js';

/**
 * A write the API refused because the document is not at the caller's version: a tool error
 * shaped as platform-mcp's own (`status_code`, `code`, `message`), plus the document as it is now.
 */
@Description('The write was refused: the document changed, or already exists.')
export class WriteRefusal {
    @Name('status_code')
    @Required()
    @Property()
    public statusCode: number;

    @Required()
    @Property()
    public code: string;

    @Required()
    @Property()
    public message: string;

    @Required()
    @Property(CurrentDocument)
    public current: CurrentDocument;
}
