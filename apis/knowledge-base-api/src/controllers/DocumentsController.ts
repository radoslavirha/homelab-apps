import { Authenticate, RequireRoles } from '@radoslavirha/tsed-auth';
import { Controller, ProviderScope, Scope } from '@tsed/di';
import { BadRequest, Conflict, NotFound } from '@tsed/exceptions';
import { QueryParams } from '@tsed/platform-params';
import { Description, Example, Get, MinLength, Required, Returns } from '@tsed/schema';
import { Docs } from '@tsed/swagger';
import { DocumentsGetHandler } from '../handlers/DocumentsGetHandler.js';
import { AuthMethod } from '../models/config/AuthMethod.enum.js';
import { DocumentsGetResponse } from '../models/DocumentsGetResponse.js';
import { ROLE_READER } from '../models/Roles.js';
import { SwaggerDocs } from '../models/SwaggerDocs.enum.js';

@Description('Whole documents, as indexed.')
@Controller('/documents')
@Scope(ProviderScope.SINGLETON)
@Docs(SwaggerDocs.API)
@Authenticate(AuthMethod.Idp)
@RequireRoles(ROLE_READER)
export class DocumentsController {
    public constructor(private readonly handler: DocumentsGetHandler) {}

    @Get('/')
    @Description('Returns one whole document. 404 for an id no readable knowledge base holds; 409 when several do and kb is omitted.')
    @Returns(200, DocumentsGetResponse)
    @Returns(BadRequest.STATUS, BadRequest)
    @Returns(NotFound.STATUS, NotFound)
    @Returns(Conflict.STATUS, Conflict)
    public get(
        @Description('Document id (externalId), or a search result\'s anchor.')
        @Required()
        @MinLength(1)
        @Example('raw/2026-01-01-configmap-env-restart.md')
        @QueryParams('id')
        id: string,

        @Description('Knowledge base id. Default: every knowledge base the caller may read.')
        @Example('dev')
        @QueryParams('kb')
        kb?: string
    ): Promise<DocumentsGetResponse> {
        return this.handler.execute(id, kb);
    }
}
