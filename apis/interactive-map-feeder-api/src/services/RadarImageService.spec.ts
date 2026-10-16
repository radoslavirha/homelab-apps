import { PlatformTest } from '@tsed/platform-http/testing';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChmiPortalEndpoint, ChmiRadarEndpoint } from '../endpoints/chmi/index.js';
import { RadarImageService } from './RadarImageService.js';
import { RadarService } from './RadarService.js';
import { RasterService } from './RasterService.js';

const SURFACE = { width: 68, height: 46 };

type Color = { r: number; g: number; b: number; alpha: number };

/** A solid layer; the overlays come smaller than the surface, so each must be scaled up to it. */
const layer = (background: Color, size = { width: 34, height: 23 }): Promise<Buffer> =>
    sharp({ create: { ...size, channels: 4, background } }).png().toBuffer();

const BORDERS: Color = { r: 255, g: 0, b: 0, alpha: 1 };
const CITIES: Color = { r: 0, g: 255, b: 0, alpha: 1 };
const RADAR: Color = { r: 0, g: 0, b: 255, alpha: 1 };

const firstPixel = async (buffer: Buffer): Promise<number[]> => {
    const { data } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return [...data.subarray(0, 4)];
};

describe('RadarImageService', () => {
    let service: RadarImageService;
    let raster: RasterService;
    let radar: RadarService;

    beforeEach(PlatformTest.create);
    beforeEach(async () => {
        service = PlatformTest.get<RadarImageService>(RadarImageService);
        raster = PlatformTest.get<RasterService>(RasterService);
        radar = PlatformTest.get<RadarService>(RadarService);

        const portal = PlatformTest.get<ChmiPortalEndpoint>(ChmiPortalEndpoint);
        vi.spyOn(portal, 'getSurfaceMap').mockResolvedValue(
            await sharp({ create: { ...SURFACE, channels: 3, background: { r: 255, g: 255, b: 255 } } }).jpeg().toBuffer()
        );
        vi.spyOn(portal, 'getBordersMap').mockResolvedValue(await layer(BORDERS));
        vi.spyOn(portal, 'getCitiesMap').mockResolvedValue(await layer(CITIES));
        vi.spyOn(PlatformTest.get<ChmiRadarEndpoint>(ChmiRadarEndpoint), 'getCurrentRadarSituation')
            .mockResolvedValue(await layer(RADAR));
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    describe('getCurrentRadarImage', () => {
        it('returns an image the size of the surface map', async () => {
            expect.assertions(2);

            const image = await service.getCurrentRadarImage();

            const { width, height } = await sharp(image).metadata();
            expect(width).toBe(SURFACE.width);
            expect(height).toBe(SURFACE.height);
        });

        it('stacks borders, cities, radar and city dots on the surface, each scaled to it', async () => {
            expect.assertions(6);
            const composite = vi.spyOn(raster, 'compositeImages');
            const cityDots = vi.spyOn(raster, 'createCitiesImage');

            await service.getCurrentRadarImage();

            const [, overlays] = composite.mock.calls[0];
            const sizes = await Promise.all(overlays.map(async overlay => {
                const { width, height } = await sharp(overlay).metadata();
                return { width, height };
            }));
            expect(overlays).toHaveLength(4);
            expect(sizes).toEqual(Array(4).fill(SURFACE));
            expect(await firstPixel(overlays[0])).toEqual([255, 0, 0, 255]);
            expect(await firstPixel(overlays[1])).toEqual([0, 255, 0, 255]);
            expect(await firstPixel(overlays[2])).toEqual([0, 0, 255, 255]);
            expect(overlays[3]).toBe(await cityDots.mock.results[0].value);
        });

        it('draws the city dots for the surface size within the radar bbox', async () => {
            expect.assertions(1);
            const cityDots = vi.spyOn(raster, 'createCitiesImage');

            await service.getCurrentRadarImage();

            expect(cityDots).toHaveBeenCalledWith(SURFACE.height, SURFACE.width, radar.bbox);
        });
    });
});
