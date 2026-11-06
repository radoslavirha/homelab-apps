import { Authenticate, RequireRoles } from '@radoslavirha/tsed-auth';
import { Controller, ProviderScope, Scope } from '@tsed/di';
import { BadRequest, InternalServerError, NotFound, NotImplemented } from '@tsed/exceptions';
import { QueryParams } from '@tsed/platform-params';
import { Description, Example, Get, Pattern, Required, Returns } from '@tsed/schema';
import { Docs } from '@tsed/swagger';
import { ConventionsGetHandler } from '../handlers/ConventionsGetHandler.js';
import { AuthMethod } from '../models/config/AuthMethod.enum.js';
import { ConventionsGetResponse } from '../models/ConventionsGetResponse.js';
import { KNOWLEDGE_BASE_ID_PATTERN } from '../models/KnowledgeBaseId.js';
import { ROLE_READER } from '../models/Roles.js';
import { SwaggerDocs } from '../models/SwaggerDocs.enum.js';

@Description('A knowledge base\'s own house rules — formats, frontmatter, areas, naming — so a caller writing to it, or preparing files for it, knows what to produce.')
@Controller('/conventions')
@Scope(ProviderScope.SINGLETON)
@Docs(SwaggerDocs.API)
@Authenticate(AuthMethod.Idp)
@RequireRoles(ROLE_READER)
export class ConventionsController {
    public constructor(private readonly handler: ConventionsGetHandler) {}

    @Get('/')
    @Description('Returns the file the knowledge base names in conventionsPath, read from its source as it is now. 200 with path, markdown and version null when it names none; 404 for a knowledge base the caller cannot read; 500 when the named file is missing from the source; 501 when the source cannot read single files.')
    @Returns(200, ConventionsGetResponse)
    @Returns(BadRequest.STATUS, BadRequest)
    @Returns(NotFound.STATUS, NotFound)
    @Returns(InternalServerError.STATUS, InternalServerError)
    @Returns(NotImplemented.STATUS, NotImplemented)
    public get(
        @Description('Knowledge base id: one, not a list.')
        @Required()
        @Pattern(KNOWLEDGE_BASE_ID_PATTERN)
        @Example('development')
        @QueryParams('kb')
        kb: string
    ): Promise<ConventionsGetResponse> {
        return this.handler.execute(kb);
    }
}
