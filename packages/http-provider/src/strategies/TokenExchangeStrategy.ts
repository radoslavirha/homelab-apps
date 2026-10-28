import { CommonUtils } from '@radoslavirha/utils';
import axios, { type AxiosInstance } from 'axios';
import type { RetryRequestConfig } from '../client/RetryRequestConfig.js';
import type { TokenExchangeAuth, TokenExtractorEntry } from '../schemas/auth.schema.js';
import { extractByPath, extractNumberByPath } from '../utils/extractByPath.js';
import type { IAuthStrategy } from './IAuthStrategy.js';

const DEFAULT_EXPIRY_MARGIN_SECONDS = 30;

export class TokenExchangeStrategy implements IAuthStrategy {
    private cachedCredentials: Record<string, string> | undefined;
    private expiresAt: number | undefined;
    private inFlightCredentials: Promise<Record<string, string>> | undefined;
    private inFlightEpoch: number | undefined;
    private cacheEpoch: number = 0;
    private readonly extractors: TokenExtractorEntry[];
    private readonly client: AxiosInstance;

    /**
     * @param client Client used for the token request. `HttpProviderFactory`
     *   supplies one carrying the provider's resilience policy and logging, so
     *   the auth hop is bounded and observable like any other call. Defaults to
     *   the bare axios instance for standalone use.
     */
    public constructor(
        private readonly config: TokenExchangeAuth,
        client: AxiosInstance = axios
    ) {
        this.extractors = config.tokenExtractor;
        this.client = client;
    }

    public async getCredentials(): Promise<Record<string, string>> {
        if (this.cachedCredentials && (CommonUtils.isUndefined(this.expiresAt) || Date.now() < this.expiresAt)) {
            return this.cachedCredentials;
        }

        if (this.inFlightCredentials && this.inFlightEpoch === this.cacheEpoch) {
            return this.inFlightCredentials;
        }

        const requestEpoch = this.cacheEpoch;
        this.inFlightEpoch = requestEpoch;
        this.inFlightCredentials = this.fetchCredentials()
            .then(({ credentials, expiresAt }) => {
                if (this.cacheEpoch === requestEpoch) {
                    this.cachedCredentials = credentials;
                    this.expiresAt = expiresAt;
                }
                return credentials;
            })
            .finally(() => {
                if (this.inFlightEpoch === requestEpoch) {
                    this.inFlightCredentials = undefined;
                    this.inFlightEpoch = undefined;
                }
            });

        return this.inFlightCredentials;
    }

    public invalidate(): void {
        this.cacheEpoch += 1;
        this.cachedCredentials = undefined;
        this.expiresAt = undefined;
    }

    private async fetchCredentials(): Promise<{ credentials: Record<string, string>; expiresAt: number | undefined }> {
        const { method, url, headers, queryParams, body } = this.config.request;

        const requestHeaders: Record<string, string> = {};
        if (headers) {
            for (const h of headers) {
                requestHeaders[h.name] = h.value;
            }
        }

        const requestParams: Record<string, string> = {};
        if (queryParams) {
            for (const qp of queryParams) {
                requestParams[qp.name] = qp.value;
            }
        }

        const request: RetryRequestConfig = {
            method,
            url,
            headers: requestHeaders,
            params: requestParams,
            data: body,
            // A token request only mints a token, so a replay is harmless whatever its method.
            _retry: true
        };
        const response = await this.client.request<unknown>(request);

        const credentials: Record<string, string> = {};
        for (const extractor of this.extractors) {
            credentials[extractor.as] = extractByPath(response.data, extractor.field);
        }

        let expiresAt: number | undefined;
        if (CommonUtils.notUndefined(this.config.expiresIn)) {
            const lifetime = extractNumberByPath(response.data, this.config.expiresIn);
            expiresAt = Date.now() + (lifetime - (this.config.expiryMargin ?? DEFAULT_EXPIRY_MARGIN_SECONDS)) * 1000;
        }
        return { credentials, expiresAt };
    }
}
