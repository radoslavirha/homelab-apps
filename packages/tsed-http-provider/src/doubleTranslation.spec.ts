import AxiosMockAdapter from 'axios-mock-adapter';
import type { AxiosInstance } from 'axios';
import { describe, expect, it } from 'vitest';
import { AuthStrategy } from '@radoslavirha/http-provider';
import { HttpProviderService } from './HttpProviderService.js';

const MockAdapter = AxiosMockAdapter as unknown as new (instance: AxiosInstance) => AxiosMockAdapter;

describe('401 auth replay failure translation', () => {
    it('does not translate an already-translated exception a second time', async () => {
        const service = new HttpProviderService<'example'>({
            example: {
                baseURL: 'http://example.test',
                auth: {
                    strategy: AuthStrategy.None,
                    transport: { headers: [{ name: 'X-Api-Key', value: 'static' }] }
                }
            }
        });
        const client = service.get('example');
        const mock = new MockAdapter(client.raw as AxiosInstance);
        mock.onGet('/data').reply(401);

        const error = (await client.get('/data').catch((e: unknown) => e)) as {
            status: number;
            message: string;
            origin?: { response?: { status?: number } };
        };

        expect(error.message).toMatch(/^External API example responded with 401\./);
        expect(error.message).not.toContain('could not be reached');
        expect(error.origin?.response?.status).toBe(401);
        mock.restore();
    });
});
