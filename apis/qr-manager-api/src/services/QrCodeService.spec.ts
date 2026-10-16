import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INSERT_ATTEMPTS } from '../constants.js';
import { QrCodeMongoDTO } from '../storage/qr-mongo/dto/QrCodeMongoDTO.js';
import { QrCodeMongoRepository } from '../storage/qr-mongo/QrCodeMongoRepository.js';
import { QrType } from '../models/QrType.enum.js';
import { QrCodeService } from './QrCodeService.js';
import { ShortIdService } from './ShortIdService.js';

const dto = (overrides: Partial<QrCodeMongoDTO> = {}): QrCodeMongoDTO => Object.assign(new QrCodeMongoDTO(), {
    _id: '671b00000000000000000001',
    createdAt: new Date('2026-04-01T00:00:00Z'),
    updatedAt: new Date('2026-04-01T00:00:00Z'),
    slug: 'x7k2',
    targetURL: 'https://iot-ui.home/devices/shelf-1',
    label: 'Shelf 1',
    type: QrType.IOT_DEVICE,
    active: true,
    ...overrides
});

let service: QrCodeService;
let repo: QrCodeMongoRepository;
let short: ShortIdService;

beforeEach(PlatformTest.create);
beforeEach(() => {
    service = PlatformTest.get<QrCodeService>(QrCodeService);
    repo = PlatformTest.get<QrCodeMongoRepository>(QrCodeMongoRepository);
    short = PlatformTest.get<ShortIdService>(ShortIdService);
    vi.spyOn(short, 'generate').mockReturnValue('x7k2');
});
afterEach(PlatformTest.reset);
afterEach(() => vi.restoreAllMocks());

const input = {
    targetURL: 'https://iot-ui.home/devices/shelf-1',
    label: 'Shelf 1',
    type: QrType.IOT_DEVICE,
    active: true
};

describe('QrCodeService.create', () => {
    it('generates a slug, persists and returns the mapped domain model', async () => {
        expect.assertions(4);
        vi.spyOn(repo, 'create').mockResolvedValue(dto({ slug: 'x7k2' }));
        const created = await service.create(input);
        expect(short.generate).toHaveBeenCalledTimes(1);
        expect(repo.create).toHaveBeenCalledTimes(1);
        expect(created.slug).toBe('x7k2');
        expect(created.id).toBe('671b00000000000000000001');
    });

    it('retries when the slug collides with an existing record', async () => {
        expect.assertions(3);
        const collision = Object.assign(new Error('dup'), { code: 11000, keyPattern: { slug: 1 } });
        const create = vi.spyOn(repo, 'create')
            .mockRejectedValueOnce(collision)
            .mockResolvedValueOnce(dto({ slug: 'b0t2' }));
        vi.spyOn(short, 'generate').mockReturnValueOnce('x7k2').mockReturnValueOnce('b0t2');
        const created = await service.create(input);
        expect(create).toHaveBeenCalledTimes(2);
        expect(short.generate).toHaveBeenCalledTimes(2);
        expect(created.slug).toBe('b0t2');
    });

    it('rethrows duplicate-key errors that are not on the slug index', async () => {
        expect.assertions(1);
        const otherDup = Object.assign(new Error('dup'), { code: 11000, keyPattern: { other: 1 } });
        vi.spyOn(repo, 'create').mockRejectedValue(otherDup);
        await expect(service.create(input)).rejects.toBe(otherDup);
    });

    it(`throws Conflict after ${INSERT_ATTEMPTS} retry attempts`, async () => {
        expect.assertions(1);
        const collision = Object.assign(new Error('dup'), { code: 11000, keyPattern: { slug: 1 } });
        vi.spyOn(repo, 'create').mockRejectedValue(collision);
        await expect(service.create(input)).rejects.toThrow(/unique slug/);
    });
});

describe('QrCodeService getters', () => {
    it('list returns mapped models', async () => {
        expect.assertions(2);
        vi.spyOn(repo, 'findAll').mockResolvedValue([dto(), dto({ _id: 'b', slug: 'aaaa' })]);
        const items = await service.list({ type: QrType.IOT_DEVICE, active: true });
        expect(items).toHaveLength(2);
        expect(items[0].slug).toBe('x7k2');
    });

    it('getById returns undefined when not found', async () => {
        expect.assertions(1);
        vi.spyOn(repo, 'findById').mockResolvedValue(null);
        expect(await service.getById('missing')).toBeUndefined();
    });

    it('getById returns the mapped model when found', async () => {
        expect.assertions(1);
        vi.spyOn(repo, 'findById').mockResolvedValue(dto());
        const result = await service.getById('671b00000000000000000001');
        expect(result?.slug).toBe('x7k2');
    });

    it('getBySlug returns the mapped model when found', async () => {
        expect.assertions(1);
        vi.spyOn(repo, 'findBySlug').mockResolvedValue(dto());
        const result = await service.getBySlug('x7k2');
        expect(result?.slug).toBe('x7k2');
    });

    it('getBySlug returns undefined when not found', async () => {
        expect.assertions(1);
        vi.spyOn(repo, 'findBySlug').mockResolvedValue(null);
        expect(await service.getBySlug('zzzz')).toBeUndefined();
    });
});

describe('QrCodeService.update', () => {
    it('returns the mapped model when the document exists', async () => {
        expect.assertions(1);
        vi.spyOn(repo, 'updateById').mockResolvedValue(dto({ targetURL: 'https://new.home' }));
        const result = await service.update('id', { targetURL: 'https://new.home' });
        expect(result?.targetURL).toBe('https://new.home');
    });

    it('returns undefined when the document does not exist', async () => {
        expect.assertions(1);
        vi.spyOn(repo, 'updateById').mockResolvedValue(null);
        expect(await service.update('missing', { active: false })).toBeUndefined();
    });
});

describe('QrCodeService.delete', () => {
    it('delegates to the repository', async () => {
        expect.assertions(1);
        const deleteById = vi.spyOn(repo, 'deleteById').mockResolvedValue(undefined as never);
        await service.delete('id');
        expect(deleteById).toHaveBeenCalledWith('id');
    });
});
