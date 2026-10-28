import type { AxiosRequestConfig } from 'axios';

/**
 * An axios request config carrying {@link HttpRequestOptions.retry}.
 *
 * Axios keeps config keys it does not know through its merge, so the flag reaches the
 * resilience interceptor in `HttpProviderFactory`, and the 401 replay, which re-sends the same
 * config, keeps it.
 */
export interface RetryRequestConfig extends AxiosRequestConfig {
    _retry?: boolean;
}
