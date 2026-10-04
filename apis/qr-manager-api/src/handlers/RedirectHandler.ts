import { Injectable, Scope, ProviderScope } from '@tsed/di';
import { GatewayTimeout, NotFound, ServiceUnavailable } from '@tsed/exceptions';
import { isBrokenCircuitError, isTaskCancelledError } from '@radoslavirha/resilience';
import { CommonUtils } from '@radoslavirha/utils';
import { QrCodeService } from '../services/QrCodeService.js';

export interface RedirectResult {
    targetURL: string;
}

@Injectable()
@Scope(ProviderScope.SINGLETON)
export class RedirectHandler {
    constructor(
        private readonly qrCodeService: QrCodeService
    ) {}

    public async execute(slug: string, signal?: AbortSignal): Promise<RedirectResult> {
        const model = await this.lookup(slug, signal);
        if (CommonUtils.isNil(model) || !model.active) {
            throw new NotFound(`QR code ${slug} not found.`);
        }
        return { targetURL: model.targetURL };
    }

    /**
     * Translates the slug-lookup resilience failures into the status that
     * describes this service's situation (open circuit -> 503, timeout -> 504),
     * mirroring `attachErrorTranslation` in tsed-http-provider. A cancellation
     * caused by the caller aborting (client disconnect) is passed through.
     */
    private async lookup(slug: string, signal?: AbortSignal): ReturnType<QrCodeService['getBySlug']> {
        try {
            return await this.qrCodeService.getBySlug(slug, signal);
        } catch (error) {
            if (isBrokenCircuitError(error)) {
                throw new ServiceUnavailable('QR code lookup is unavailable (circuit open).', error);
            }
            if (isTaskCancelledError(error) && signal?.aborted !== true) {
                throw new GatewayTimeout('QR code lookup did not respond in time.', error);
            }
            throw error;
        }
    }
}
