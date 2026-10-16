import { Authenticate, RequireRoles } from '@radoslavirha/tsed-auth';
import { Controller, ProviderScope, Scope } from '@tsed/di';
import { BadRequest, NotFound } from '@tsed/exceptions';
import { QueryParams } from '@tsed/platform-params';
import { Description, Example, Get, Max, MaxLength, Min, MinLength, Required, Returns } from '@tsed/schema';
import { Docs } from '@tsed/swagger';
import { SearchGetHandler } from '../handlers/SearchGetHandler.js';
import { AuthMethod } from '../models/config/AuthMethod.enum.js';
import { ROLE_READER } from '../models/Roles.js';
import { SearchGetResponse } from '../models/SearchGetResponse.js';
import { SwaggerDocs } from '../models/SwaggerDocs.enum.js';

@Description('Hybrid (full-text + vector) search over the knowledge bases the caller may read.')
@Controller('/search')
@Scope(ProviderScope.SINGLETON)
@Docs(SwaggerDocs.API)
@Authenticate(AuthMethod.Idp)
@RequireRoles(ROLE_READER)
export class SearchController {
    public constructor(private readonly handler: SearchGetHandler) {}

    @Get('/')
    @Description('Searches sections of documents. Returns anchors and snippets; read a whole document with GET /documents.')
    @Returns(200, SearchGetResponse)
    @Returns(BadRequest.STATUS, BadRequest)
    @Returns(NotFound.STATUS, NotFound)
    public search(
        @Description('The question, in natural language.')
        @Required()
        @MinLength(1)
        @MaxLength(1000)
        @Example('Why does the pod still use the old environment variable after a ConfigMap change?')
        @QueryParams('q')
        q: string,

        @Description('Comma-separated knowledge base ids. Default: every knowledge base the caller may read.')
        @Example('dev')
        @QueryParams('kb')
        kb?: string,

        @Description('Comma-separated key:value metadata filters; a repeated key means "or", different keys "and".')
        @Example('area:raw,repos:homelab')
        @QueryParams('filter')
        filter?: string,

        @Description('Results to return. Default 10.')
        @Min(1)
        @Max(50)
        @QueryParams('limit')
        limit?: number,

        @Description('Answer the vector leg with this embedding model instead of each knowledge base\'s first — to compare models.')
        @QueryParams('model')
        model?: string,

        @Description('RRF weight of the full-text leg for this request (0–10), over the configured one — to measure a blend.')
        @Min(0)
        @Max(10)
        @QueryParams('fullTextWeight')
        fullTextWeight?: number,

        @Description('RRF weight of the vector leg for this request (0–10), over the configured one.')
        @Min(0)
        @Max(10)
        @QueryParams('vectorWeight')
        vectorWeight?: number
    ): Promise<SearchGetResponse> {
        return this.handler.execute({ q, kb, filter, limit, model, fullTextWeight, vectorWeight });
    }
}
