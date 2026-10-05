import { type AxiosInstance } from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import { describe, expect, it } from 'vitest';
import { AuthStrategy } from './schemas/auth.schema.js';
import { HttpProviderFactory } from './HttpProviderFactory.js';

const MockAdapter = AxiosMockAdapter as unknown as new (instance: AxiosInstance, options?: Record<string, unknown>) => AxiosMockAdapter;

describe('HttpProviderFactory token-exchange refresh after expiry', () => {
    it('shares one token refresh when concurrent requests all get 401 for the same expired token', async () => {
        const created: AxiosInstance[] = [];
        const factory = new HttpProviderFactory({
            'svc': {
                baseURL: 'http://svc.local',
                auth: {
                    strategy: AuthStrategy.TokenExchange,
                    request: { method: 'POST', url: 'http://auth.local/token' },
                    tokenExtractor: 'access_token',
                    transport: { headers: [{ name: 'Authorization', credential: 'value', prefix: 'Bearer ' }] }
                }
            }
        }, { onInstanceCreated: (instance) => created.push(instance) });
        const client = factory.get('svc');
        const authMock = new MockAdapter(created[1]!);
        const svcMock = new MockAdapter(client.raw as AxiosInstance);

        let tokenCalls = 0;
        authMock.onPost('http://auth.local/token').reply(async () => {
            tokenCalls++;
            await new Promise((resolve) => setTimeout(resolve, 10));
            return [200, { access_token: `t${tokenCalls}` }];
        });
        // t1 has expired upstream; any later token is accepted. The stale requests'
        // 401s come back a few ms apart, as they do from a real upstream.
        let staleReplies = 0;
        svcMock.onGet('/x').reply(async (config) => {
            if (config.headers?.['Authorization'] !== 'Bearer t1') {
                return [200, 'ok'];
            }
            const delay = staleReplies++ * 3;
            await new Promise((resolve) => setTimeout(resolve, delay));
            return [401];
        });

        const results = await Promise.all(Array.from({ length: 5 }, () => client.get('/x')));

        expect(results).toEqual(['ok', 'ok', 'ok', 'ok', 'ok']);
        // 1 cold fetch + 1 shared refresh after the expiry.
        expect(tokenCalls).toBe(2);
    });
});
