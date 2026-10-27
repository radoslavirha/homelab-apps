import { Authenticate, RequireRoles } from '@radoslavirha/tsed-auth';
import { Controller, ProviderScope, Scope } from '@tsed/di';
import { BadRequest, Conflict, NotFound, NotImplemented } from '@tsed/exceptions';
import { BodyParams, HeaderParams, QueryParams } from '@tsed/platform-params';
import { Delete, Description, Example, Get, MinLength, Pattern, Put, Required, Returns } from '@tsed/schema';
import { Docs } from '@tsed/swagger';
import { DocumentsDeleteHandler } from '../handlers/DocumentsDeleteHandler.js';
import { DocumentsGetHandler } from '../handlers/DocumentsGetHandler.js';
import { DocumentsPutHandler } from '../handlers/DocumentsPutHandler.js';
import { AuthMethod } from '../models/config/AuthMethod.enum.js';
import { DocumentsDeleteRequest } from '../models/DocumentsDeleteRequest.js';
import { DocumentsDeleteResponse } from '../models/DocumentsDeleteResponse.js';
import { DocumentsGetResponse } from '../models/DocumentsGetResponse.js';
import { DocumentsPutRequest } from '../models/DocumentsPutRequest.js';
import { DocumentsPutResponse } from '../models/DocumentsPutResponse.js';
import { ON_BEHALF_OF_HEADER, ON_BEHALF_OF_PATTERN } from '../models/OnBehalfOf.js';
import { ROLE_EDITOR, ROLE_READER } from '../models/Roles.js';
import { SwaggerDocs } from '../models/SwaggerDocs.enum.js';

@Description('Whole documents: read as indexed; written to the knowledge base\'s source, one commit per write.')
@Controller('/documents')
@Scope(ProviderScope.SINGLETON)
@Docs(SwaggerDocs.API)
@Authenticate(AuthMethod.Idp)
// The floor every route here shares; the writes add editor on top ("and", never "or").
@RequireRoles(ROLE_READER)
export class DocumentsController {
    public constructor(
        private readonly getHandler: DocumentsGetHandler,
        private readonly putHandler: DocumentsPutHandler,
        private readonly deleteHandler: DocumentsDeleteHandler
    ) {}

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
        @Example('development')
        @QueryParams('kb')
        kb?: string
    ): Promise<DocumentsGetResponse> {
        return this.getHandler.execute(id, kb);
    }

    @Put('/')
    @RequireRoles(ROLE_EDITOR)
    @Description('Creates (no version) or rewrites (version) a whole work/ spec or plan, one commit, then starts an indexing run. 409 when the document changed since version, or a create finds it existing — the current document in errors (name CURRENT: content, version); 404 when a rewrite finds it gone. 400 for a path outside work/, invalid frontmatter or naming, or anything that looks like a secret. 501 when the source cannot be written.')
    @Returns(200, DocumentsPutResponse)
    @Returns(BadRequest.STATUS, BadRequest)
    @Returns(NotFound.STATUS, NotFound)
    @Returns(Conflict.STATUS, Conflict)
    @Returns(NotImplemented.STATUS, NotImplemented)
    public put(
        @Description('The username of the person the document is written for: the commit\'s On-behalf-of trailer.')
        @Required()
        @Pattern(ON_BEHALF_OF_PATTERN)
        @Example('akadmin')
        @HeaderParams(ON_BEHALF_OF_HEADER)
        onBehalfOf: string | undefined,

        @Required()
        @BodyParams()
        request: DocumentsPutRequest
    ): Promise<DocumentsPutResponse> {
        return this.putHandler.execute(request, onBehalfOf);
    }

    @Delete('/')
    @RequireRoles(ROLE_EDITOR)
    @Description('Deletes a raw/ note or a work/ document at version, one commit with the reason in it, then starts an indexing run. 409 when it changed since version, the current document in errors (name CURRENT: content, version); 404 when it is gone. 400 for mirror/ or any other path. 501 when the source cannot be written.')
    @Returns(200, DocumentsDeleteResponse)
    @Returns(BadRequest.STATUS, BadRequest)
    @Returns(NotFound.STATUS, NotFound)
    @Returns(Conflict.STATUS, Conflict)
    @Returns(NotImplemented.STATUS, NotImplemented)
    public delete(
        @Description('The username of the person the delete is for: the commit\'s On-behalf-of trailer.')
        @Required()
        @Pattern(ON_BEHALF_OF_PATTERN)
        @Example('akadmin')
        @HeaderParams(ON_BEHALF_OF_HEADER)
        onBehalfOf: string | undefined,

        @Required()
        @BodyParams()
        request: DocumentsDeleteRequest
    ): Promise<DocumentsDeleteResponse> {
        return this.deleteHandler.execute(request, onBehalfOf);
    }
}
