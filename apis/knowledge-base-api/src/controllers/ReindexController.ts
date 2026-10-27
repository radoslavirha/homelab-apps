import { Authenticate, RequireRoles } from '@radoslavirha/tsed-auth';
import { Controller, ProviderScope, Scope } from '@tsed/di';
import { Conflict, NotFound } from '@tsed/exceptions';
import { QueryParams } from '@tsed/platform-params';
import { Default, Description, Example, Post, Returns } from '@tsed/schema';
import { Docs } from '@tsed/swagger';
import { ReindexPostHandler } from '../handlers/ReindexPostHandler.js';
import { AuthMethod } from '../models/config/AuthMethod.enum.js';
import { ReindexPostResponse } from '../models/ReindexPostResponse.js';
import { ROLE_ADMIN, ROLE_READER } from '../models/Roles.js';
import { SwaggerDocs } from '../models/SwaggerDocs.enum.js';

@Description('Starts an indexing run now instead of waiting for the next interval.')
@Controller('/reindex')
@Scope(ProviderScope.SINGLETON)
@Docs(SwaggerDocs.API)
@Authenticate(AuthMethod.Idp)
// The floor every route here shares; the method below adds admin on top ("and", never "or").
@RequireRoles(ROLE_READER)
export class ReindexController {
    public constructor(private readonly handler: ReindexPostHandler) {}

    @Post('/')
    @RequireRoles(ROLE_ADMIN)
    @Description('Starts a run and returns once it has started (202, STARTED), or queues it behind the run in progress in this pod (202, QUEUED). 409 when another pod holds the index lock: nothing was started.')
    @Returns(202, ReindexPostResponse)
    @Returns(NotFound.STATUS, NotFound)
    @Returns(Conflict.STATUS, Conflict)
    public reindex(
        @Description('Comma-separated knowledge base ids. Default: every knowledge base the caller may read.')
        @Example('development')
        @QueryParams('kb')
        kb?: string,

        @Description('Ignore the indexed revision and read everything from the source — the recovery path.')
        @Default(false)
        @QueryParams('full')
        full?: boolean
    ): Promise<ReindexPostResponse> {
        return this.handler.execute(kb, full === true);
    }
}
