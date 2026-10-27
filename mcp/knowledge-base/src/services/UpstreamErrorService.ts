import type { CallToolResult } from '@modelcontextprotocol/server';
import { Serializer } from '@radoslavirha/tsed-common';
import { CommonUtils, ObjectUtils, StringUtils } from '@radoslavirha/utils';
import { ProviderScope, Scope, Service } from '@tsed/di';
import { BadRequest, Conflict, Exception, NotFound, NotImplemented } from '@tsed/exceptions';
import { asToolResponse } from '@tsed/platform-mcp';
import { ErrorResponseDTO } from '../endpoints/knowledge-base-api/dto/ErrorResponseDTO.js';
import { KnowledgeBaseMapper } from '../mappers/KnowledgeBaseMapper.js';
import { WriteRefusal } from '../models/WriteRefusal.js';

/** The `errors` entry of a refused write that carries the document as its source holds it now. */
const CURRENT_ERROR_NAME = 'CURRENT';

/** What http-provider keeps of the upstream's answer, as the translated error's `origin`. */
interface UpstreamOrigin {
    readonly response?: { readonly status?: number; readonly data?: unknown };
}

/** The refusals the API explains in its message, by status. Any other failure is thrown as it is. */
const EXPLAINED: Record<number, new (message: string) => Exception> = {
    [BadRequest.STATUS]: BadRequest,
    [NotFound.STATUS]: NotFound,
    [Conflict.STATUS]: Conflict,
    [NotImplemented.STATUS]: NotImplemented
};

/**
 * What knowledge-base-api answered when a call failed. http-provider reports every upstream
 * error as a `BadGateway` "responded with <status>", which tells an agent nothing it can act on;
 * the status and body it keeps as the error's `origin` do.
 */
@Service()
@Scope(ProviderScope.SINGLETON)
export class UpstreamErrorService {
    public constructor(private readonly mapper: KnowledgeBaseMapper) {}

    /** The status the API answered with; `undefined` when it did not answer at all. */
    public status(error: unknown): number | undefined {
        return UpstreamErrorService.originOf(error)?.response?.status;
    }

    /**
     * A failed write as its tool answers it.
     *
     * - A `409` carrying the document as it is now: a tool error (`isError`) holding that document
     *   under `current`, so the agent can apply its change to it, show the user again and retry
     *   with its version. platform-mcp keeps only an exception's message, so this is returned as
     *   a finished result rather than thrown.
     * - Any other refusal the API explains (`400`, `404`, a `409` without the document, `501`):
     *   thrown with the API's own message, which says what to change — never a secret's value.
     * - Anything else is thrown as it is.
     */
    public refusal(error: unknown): CallToolResult {
        const status = this.status(error);
        const explained = CommonUtils.isUndefined(status) ? undefined : EXPLAINED[status];

        if (CommonUtils.isUndefined(explained)) {
            throw error;
        }

        const body = UpstreamErrorService.bodyOf(error);
        const message = StringUtils.isNotEmpty(body?.message) ? body.message : (error as Error).message;
        const current = body?.errors?.find((entry) => entry.name === CURRENT_ERROR_NAME);

        if (status === Conflict.STATUS && StringUtils.isString(current?.content) && StringUtils.isNotEmpty(current.version)) {
            const refusal = Serializer.serialize(this.mapper.toRefusal(message, current.content, current.version), WriteRefusal) as Record<string, unknown>;

            return asToolResponse(refusal, { isError: true });
        }

        throw new explained(message);
    }

    private static originOf(error: unknown): UpstreamOrigin | undefined {
        return error instanceof Exception ? (error.origin as UpstreamOrigin | undefined) : undefined;
    }

    private static bodyOf(error: unknown): ErrorResponseDTO | undefined {
        const data = UpstreamErrorService.originOf(error)?.response?.data;

        return ObjectUtils.isPlainObject(data) ? Serializer.deserialize(data, ErrorResponseDTO) : undefined;
    }
}
