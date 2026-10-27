import { Authenticate, RequireRoles } from '@radoslavirha/tsed-auth';
import { Controller, ProviderScope, Scope } from '@tsed/di';
import { Description, Get, Returns } from '@tsed/schema';
import { Docs } from '@tsed/swagger';
import { StatusGetHandler } from '../handlers/StatusGetHandler.js';
import { AuthMethod } from '../models/config/AuthMethod.enum.js';
import { ROLE_READER } from '../models/Roles.js';
import { StatusGetResponse } from '../models/StatusGetResponse.js';
import { SwaggerDocs } from '../models/SwaggerDocs.enum.js';

@Description('Index state: indexed revision, last run, counts, embedding progress.')
@Controller('/status')
@Scope(ProviderScope.SINGLETON)
@Docs(SwaggerDocs.API)
@Authenticate(AuthMethod.Idp)
@RequireRoles(ROLE_READER)
export class StatusController {
    public constructor(private readonly handler: StatusGetHandler) {}

    @Get('/')
    @Description('Index state of every knowledge base the caller may read.')
    @Returns(200, StatusGetResponse)
    public get(): Promise<StatusGetResponse> {
        return this.handler.execute();
    }
}
