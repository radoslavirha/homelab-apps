import { PlatformTest } from '@tsed/platform-http/testing';
import { CommonUtils } from '@radoslavirha/utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModelPropertyOverride } from '../models/model-property-override/ModelPropertyOverride.js';
import { PropertyAccess } from '../models/simplified-miot-spec/PropertyAccess.enum.js';
import { ConfigService } from './ConfigService.js';
import { ModelPropertyOverrideLocalStorageService } from './ModelPropertyOverrideLocalStorageService.js';
import { ModelPropertyOverrideMongoService } from './ModelPropertyOverrideMongoService.js';
import { ModelPropertyOverrideService } from './ModelPropertyOverrideService.js';

type Method = 'getAll' | 'getByModel' | 'create' | 'delete';
type Backend = Record<Method, (...args: unknown[]) => Promise<unknown>>;

/** Lets one table drive every method; the object is the same, so `this` is kept. */
const asBackend = (service: object): Backend => service as unknown as Backend;

const override = CommonUtils.buildModelStrict(ModelPropertyOverride, {
    id: '671b00000000000000000003',
    createdAt: new Date('2026-04-01T00:00:00Z'),
    updatedAt: new Date('2026-04-02T00:00:00Z'),
    model: 'xiaomi.vacuum.c102gl',
    key: 'sweep-mode',
    siid: 2,
    piid: 6,
    access: [PropertyAccess.Read, PropertyAccess.Write],
    values: []
});

const CALLS: [Method, unknown[]][] = [
    ['getAll', []],
    ['getByModel', [override.model]],
    ['create', [override]],
    ['delete', [override.id]]
];

describe('ModelPropertyOverrideService', () => {
    let local: ModelPropertyOverrideLocalStorageService;
    let mongo: ModelPropertyOverrideMongoService;

    /** The backend is picked once, when the facade is built — so set the config first, then build it. */
    const facadeWith = (mongodb: ConfigService['config']['mongodb']): Promise<ModelPropertyOverrideService> => {
        const configService = PlatformTest.get<ConfigService>(ConfigService);
        vi.spyOn(configService, 'config', 'get').mockReturnValue({ ...configService.config, mongodb });
        return PlatformTest.invoke<ModelPropertyOverrideService>(ModelPropertyOverrideService, [
            { token: ConfigService, use: configService },
            { token: ModelPropertyOverrideLocalStorageService, use: local },
            { token: ModelPropertyOverrideMongoService, use: mongo }
        ]);
    };

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        local = PlatformTest.get<ModelPropertyOverrideLocalStorageService>(ModelPropertyOverrideLocalStorageService);
        mongo = PlatformTest.get<ModelPropertyOverrideMongoService>(ModelPropertyOverrideMongoService);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    describe.each([
        ['absent', undefined],
        ['disabled', { enabled: false as const }]
    ])('with mongodb %s', (_, mongodb) => {
        it.each(CALLS)('%s goes to the local file storage', async (method, args) => {
            expect.assertions(3);
            const result = Symbol(method);
            const toLocal = vi.spyOn(asBackend(local), method).mockResolvedValue(result);
            const toMongo = vi.spyOn(asBackend(mongo), method).mockResolvedValue(undefined);
            const facade = asBackend(await facadeWith(mongodb));

            await expect(facade[method](...args)).resolves.toBe(result);
            expect(toLocal).toHaveBeenCalledWith(...args);
            expect(toMongo).not.toHaveBeenCalled();
        });
    });

    describe('with mongodb enabled', () => {
        it.each(CALLS)('%s goes to MongoDB', async (method, args) => {
            expect.assertions(3);
            const result = Symbol(method);
            const toMongo = vi.spyOn(asBackend(mongo), method).mockResolvedValue(result);
            const toLocal = vi.spyOn(asBackend(local), method).mockResolvedValue(undefined);
            const facade = asBackend(await facadeWith({ enabled: true, url: 'mongodb://mongo.home:27017/miot' }));

            await expect(facade[method](...args)).resolves.toBe(result);
            expect(toMongo).toHaveBeenCalledWith(...args);
            expect(toLocal).not.toHaveBeenCalled();
        });
    });
});
