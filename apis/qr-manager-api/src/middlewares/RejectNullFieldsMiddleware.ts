import { Middleware, MiddlewareMethods } from '@tsed/platform-middlewares';
import { Req } from '@tsed/platform-http';
import { BadRequest } from '@tsed/exceptions';
import { CommonUtils } from '@radoslavirha/utils';

/**
 * Rejects a JSON body that carries a `null` field.
 *
 * Ts.ED's AJV runs with `coerceTypes: "array"`, which turns `null` into `false` for a
 * boolean property before the handler runs. An optional field means "omit to keep",
 * so `null` is a client mistake that must not silently change stored state. Validation
 * has no hook that sees the value before coercion, so the raw body is checked here.
 */
@Middleware()
export class RejectNullFieldsMiddleware implements MiddlewareMethods {
    public use(@Req() req: Req): void {
        const body: unknown = req.body;
        if (typeof body !== 'object' || CommonUtils.isNull(body)) {
            return;
        }
        const field = Object.keys(body).find((key) => CommonUtils.isNull((body as Record<string, unknown>)[key]));
        if (CommonUtils.notUndefined(field)) {
            throw new BadRequest(`"${field}" must not be null. Omit the field to keep its current value.`);
        }
    }
}
