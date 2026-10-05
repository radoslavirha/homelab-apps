import { classifyError, classifyResponse } from '@radoslavirha/ui-runtime';
import type { RequestOutcome } from '@radoslavirha/ui-runtime';
import type { AppConfig, DnsRecord } from '../types.js';

export interface FetchDnsRecordsOptions {
    /** Called with the outcome of the request so the app can show one banner. */
    readonly onOutcome?: (outcome: RequestOutcome) => void;
}

/**
 * A rejected API key is a *config* fault, not an outage. Distinguishing it
 * keeps the outage banner from firing on something restarting Unifi will not fix.
 */
export class UnifiAuthError extends Error {}

export const ACCENT_COLORS = ['#5b8dd9', '#c97e3a', '#7a55c4', '#3a8a5a', '#d95b8d', '#5bc4c9'];

export function accentColor(index: number): string {
    const n = ACCENT_COLORS.length;
    return ACCENT_COLORS[(((index - 1) % n) + n) % n] ?? '#5b8dd9';
}

export async function fetchDnsRecords(
    cfg: AppConfig,
    options: FetchDnsRecordsOptions = {}
): Promise<DnsRecord[]> {
    const { site = 'default' } = cfg.unifi;

    // No credential is sent from here, deliberately. The X-Api-Key header is
    // attached by the server-side hop — nginx proxy_set_header in production,
    // the Vite proxy in dev — so the browser never holds the key.
    // (Header name confirmed from kashalls/external-dns-unifi-webhook source.)
    //
    // Always use relative paths so the same code works in all environments:
    //   dev     → Vite server.proxy forwards /proxy/network/* to Unifi
    //   preview → Vite preview.proxy forwards /proxy/network/* to Unifi
    //   Docker  → nginx proxy_pass forwards /proxy/network/* to Unifi
    let res: Response;
    try {
        res = await fetch(`/proxy/network/v2/api/site/${site}/static-dns`);
    } catch (error) {
        options.onOutcome?.(classifyError());
        throw error;
    }

    const outcome = classifyResponse(res);

    if (res.status === 401 || res.status === 403) {
        // Report client-error, not classifyResponse's 'unauthorized': there is no
        // viewer session to renew, so the "sign in again" banner would be wrong.
        // The outage banner stays down too — the controller is answering, our
        // server-side credential is wrong.
        options.onOutcome?.({ kind: 'client-error', status: res.status });
        throw new UnifiAuthError(`Unifi API key rejected (HTTP ${res.status}).`);
    }

    if (res.ok) {
        // A 200 only counts as success once the body is a usable DNS array. A
        // proxy fallback (e.g. index.html) or an error object is a backend fault.
        let body: unknown;
        try {
            body = await res.json();
        } catch (error) {
            options.onOutcome?.({ kind: 'server-error', status: res.status });
            throw error;
        }
        // Response is a direct array
        if (Array.isArray(body)) {
            options.onOutcome?.(outcome);
            return body as DnsRecord[];
        }
        options.onOutcome?.({ kind: 'server-error', status: res.status });
    } else {
        // Any other non-2xx (404 while the Network app restarts, 408/429) is a
        // transient controller fault, not a config one: report it as degraded
        // so the recovery probe keeps polling.
        options.onOutcome?.({ kind: 'server-error', status: res.status });
    }

    throw new Error(`Could not retrieve DNS records from Unifi (HTTP ${res.status}).`);
}
