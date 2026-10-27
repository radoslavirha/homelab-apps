import { Authenticate, RequireRoles } from '@radoslavirha/tsed-auth';
import { Controller, ProviderScope, Scope } from '@tsed/di';
import { BadRequest, Conflict, NotFound, NotImplemented } from '@tsed/exceptions';
import { BodyParams, HeaderParams } from '@tsed/platform-params';
import { Description, Example, Pattern, Post, Required, Returns } from '@tsed/schema';
import { Docs } from '@tsed/swagger';
import { NotesPostHandler } from '../handlers/NotesPostHandler.js';
import { AuthMethod } from '../models/config/AuthMethod.enum.js';
import { NotesPostRequest } from '../models/NotesPostRequest.js';
import { NotesPostResponse } from '../models/NotesPostResponse.js';
import { ON_BEHALF_OF_HEADER, ON_BEHALF_OF_PATTERN } from '../models/OnBehalfOf.js';
import { ROLE_EDITOR, ROLE_READER } from '../models/Roles.js';
import { SwaggerDocs } from '../models/SwaggerDocs.enum.js';

@Description('New raw/ notes, committed to the knowledge base\'s source.')
@Controller('/notes')
@Scope(ProviderScope.SINGLETON)
@Docs(SwaggerDocs.API)
@Authenticate(AuthMethod.Idp)
// The floor every route here shares; the method below adds editor on top ("and", never "or").
@RequireRoles(ROLE_READER)
export class NotesController {
    public constructor(private readonly handler: NotesPostHandler) {}

    @Post('/')
    @RequireRoles(ROLE_EDITOR)
    @Description('Renders a note from its fields and commits it as raw/<date>-<slug>.md, one commit, then starts an indexing run. 409 when the note already exists, the note as committed in errors (name CURRENT: content, version) — a retried create whose first try landed shows its own content. 400 for a field that breaks the note format or for anything that looks like a secret. 501 when the source cannot be written.')
    @Returns(201, NotesPostResponse)
    @Returns(BadRequest.STATUS, BadRequest)
    @Returns(NotFound.STATUS, NotFound)
    @Returns(Conflict.STATUS, Conflict)
    @Returns(NotImplemented.STATUS, NotImplemented)
    public create(
        @Description('The username of the person the note is written for: the commit\'s On-behalf-of trailer and the note\'s author.')
        @Required()
        @Pattern(ON_BEHALF_OF_PATTERN)
        @Example('akadmin')
        @HeaderParams(ON_BEHALF_OF_HEADER)
        onBehalfOf: string | undefined,

        @Required()
        @BodyParams()
        request: NotesPostRequest
    ): Promise<NotesPostResponse> {
        return this.handler.execute(request, onBehalfOf);
    }
}
