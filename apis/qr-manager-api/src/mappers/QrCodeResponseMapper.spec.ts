import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommonUtils } from '@radoslavirha/utils';
import { QrCode } from '../models/QrCode.js';
import { QrType } from '../models/QrType.enum.js';
import { ConfigService } from '../services/ConfigService.js';
import { QrCodeResponseMapper } from './QrCodeResponseMapper.js';

const sampleModel = (): QrCode => CommonUtils.buildModelStrict(QrCode, {
    id: '671b00000000000000000001',
    createdAt: new Date('2026-04-01T00:00:00Z'),
    updatedAt: new Date('2026-04-02T00:00:00Z'),
    slug: 'x7k2',
    targetURL: 'https://iot-ui.home/devices/shelf-1',
    label: 'Shelf 1',
    type: QrType.IOT_DEVICE,
    active: true
});

describe('QrCodeResponseMapper', () => {
    let mapper: QrCodeResponseMapper;
    let configService: ConfigService;

    const setBaseURL = (baseURL: string): void => {
        vi.spyOn(configService, 'config', 'get').mockReturnValue({
            ...configService.config,
            redirect: { ...configService.config.redirect, baseURL }
        });
    };

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        mapper = PlatformTest.get<QrCodeResponseMapper>(QrCodeResponseMapper);
        configService = PlatformTest.get<ConfigService>(ConfigService);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    it('composes qrURL by joining redirect.baseURL with the slug', () => {
        setBaseURL('https://qr.home');
        const response = mapper.toResponse(sampleModel());
        expect(response.qrURL).toBe('https://qr.home/x7k2');
    });

    it('strips trailing slashes from redirect.baseURL', () => {
        setBaseURL('https://qr.home///');
        const response = mapper.toResponse(sampleModel());
        expect(response.qrURL).toBe('https://qr.home/x7k2');
    });

    it('preserves all domain fields on the response', () => {
        setBaseURL('https://qr.home');
        const response = mapper.toResponse(sampleModel());
        expect(response.slug).toBe('x7k2');
        expect(response.targetURL).toBe('https://iot-ui.home/devices/shelf-1');
        expect(response.label).toBe('Shelf 1');
        expect(response.type).toBe(QrType.IOT_DEVICE);
        expect(response.active).toBe(true);
        expect(response.id).toBe('671b00000000000000000001');
    });
});
