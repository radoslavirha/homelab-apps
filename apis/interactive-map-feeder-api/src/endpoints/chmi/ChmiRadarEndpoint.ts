import axios from 'axios';
import { InjectHttpClient, type HttpClient } from '@radoslavirha/tsed-http-provider';
import { NumberUtils } from '@radoslavirha/utils';
import { ProviderScope, Scope, Service } from '@tsed/di';
import { ExternalApi } from '../../models/config/ExternalApi.enum.js';

const SLOT_MS = 5 * 60 * 1000;
/** Earlier slots tried after the current one is not published yet. */
const MAX_FALLBACK_SLOTS = 2;

/**
 * Precipitation radar composite published on CHMI open data.
 *
 * @see https://opendata.chmi.cz/meteorology/weather/radar/radar_popis_cz.pdf
 */
@Service()
@Scope(ProviderScope.SINGLETON)
export class ChmiRadarEndpoint {
    @InjectHttpClient(ExternalApi.ChmiOpendata)
    private readonly client!: HttpClient;

    /**
     * Latest published radar composite. CHMI publishes each slot's file a few
     * seconds after the slot starts, so a 404 falls back to earlier slots.
     */
    public async getCurrentRadarSituation(): Promise<Buffer> {
        const now = Date.now();

        for (let slot = 0; ; slot++) {
            try {
                return await this.client.get<Buffer>(
                    `/meteorology/weather/radar/composite/maxz/png_masked/pacz2gmaps3.z_max3d.${this.getDate(new Date(now - slot * SLOT_MS))}.0.png`,
                    { responseType: 'binary' }
                );
            } catch (error) {
                if (slot >= MAX_FALLBACK_SLOTS || !this.isNotFound(error)) {
                    throw error;
                }
            }
        }
    }

    private isNotFound(error: unknown): boolean {
        const origin = (error as { origin?: unknown }).origin;
        return axios.isAxiosError(origin) && origin.response?.status === 404;
    }

    /**
     * Timestamp segment of the image filename. Images are published every five
     * minutes, so the time is floored to the nearest five.
     */
    private getDate(date: Date): string {
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hour = String(date.getUTCHours()).padStart(2, '0');
        const minute = String(NumberUtils.floor(date.getUTCMinutes() / 5) * 5).padStart(2, '0');

        return `${year}${month}${day}.${hour}${minute}`;
    }
}
