import { Description, MinLength, Required } from '@tsed/schema';

export class DeleteDocumentInput {
    @Description('A `raw/` note or a `work/` spec or plan.')
    @Required()
    @MinLength(1)
    public id: string;

    @Description('The version being deleted — from `read`, your last write of it, or a refusal\'s `current`.')
    @Required()
    @MinLength(1)
    public version: string;

    @Description('Why it goes. Kept in the commit message.')
    @Required()
    @MinLength(1)
    public reason: string;
}
