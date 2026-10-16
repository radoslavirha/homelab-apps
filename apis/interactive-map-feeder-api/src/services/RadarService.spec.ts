import { PlatformTest } from '@tsed/platform-http/testing';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CITIES } from '../Cities.js';
import { ChmiRadarEndpoint } from '../endpoints/chmi/index.js';
import { RGBA } from '../models/index.js';
import { RadarService } from './RadarService.js';
import { RasterService } from './RasterService.js';

// ČHMÚ radar_popis_cz.pdf, section 23 (MAX_Z_mask PNG): EPSG:3857,
// whole image lon 11.267–20.770, lat 48.047–52.167, 680x460 px.
const WIDTH = 680;
const HEIGHT = 460;
const WEST = 11.267, EAST = 20.770, NORTH = 52.167, SOUTH = 48.047;
const mercY = (lat: number): number => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

const pixelOf = (lat: number, lon: number): { x: number; y: number } => ({
    x: Math.round((WIDTH * (lon - WEST)) / (EAST - WEST)),
    y: Math.round((HEIGHT * (mercY(NORTH) - mercY(lat))) / (mercY(NORTH) - mercY(SOUTH)))
});

const radarPng = (paint: (data: Buffer) => void = () => undefined): Promise<Buffer> => {
    const data = Buffer.alloc(WIDTH * HEIGHT * 4, 0);
    paint(data);
    return sharp(data, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } }).png().toBuffer();
};

describe('RadarService', () => {
    let service: RadarService;
    let raster: RasterService;
    let chmiRadarEndpoint: ChmiRadarEndpoint;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        service = PlatformTest.get<RadarService>(RadarService);
        raster = PlatformTest.get<RasterService>(RasterService);
        chmiRadarEndpoint = PlatformTest.get<ChmiRadarEndpoint>(ChmiRadarEndpoint);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    describe('getCitiesFromRadar', () => {
        it('returns every city, in LED order, coloured with the RGB of its sample', async () => {
            expect.assertions(3);
            vi.spyOn(chmiRadarEndpoint, 'getCurrentRadarSituation').mockResolvedValue(await radarPng());
            vi.spyOn(raster, 'getRGBAOnCoordinates').mockImplementation(async (latitude) => {
                const id = CITIES.findIndex(city => city.latitude === latitude);
                return new RGBA(id, 100, 200, 255);
            });

            const cities = await service.getCitiesFromRadar();

            expect(cities.map(({ id, name, latitude, longitude }) => ({ id, name, latitude, longitude })))
                .toEqual(CITIES.map(({ id, name, latitude, longitude }) => ({ id, name, latitude, longitude })));
            expect(cities.map(city => city.color)).toEqual(CITIES.map((_, index) => ({ r: index, g: 100, b: 200 })));
            expect(cities.every(city => !Object.hasOwn(city.color, 'a'))).toBe(true);
        });

        it('samples the current radar image within the radar bbox at the requested radius', async () => {
            expect.assertions(3);
            const buffer = await radarPng();
            vi.spyOn(chmiRadarEndpoint, 'getCurrentRadarSituation').mockResolvedValue(buffer);
            const createImage = vi.spyOn(raster, 'createImage');
            const sample = vi.spyOn(raster, 'getRGBAOnCoordinates').mockResolvedValue(new RGBA(0, 0, 0, 0));

            await service.getCitiesFromRadar(5);

            expect(createImage).toHaveBeenCalledWith(buffer);
            expect(sample).toHaveBeenCalledTimes(CITIES.length);
            expect(sample.mock.calls.every(([, , bbox, , radius]) => bbox === service.bbox && radius === 5)).toBe(true);
        });

        it('lights only the city the radar shows precipitation over', async () => {
            expect.assertions(2);
            const liberec = CITIES.find(city => city.name === 'Liberec')!;
            const { x, y } = pixelOf(liberec.latitude, liberec.longitude);
            vi.spyOn(chmiRadarEndpoint, 'getCurrentRadarSituation').mockResolvedValue(await radarPng((data) => {
                const i = (y * WIDTH + x) * 4;
                data[i] = 255; data[i + 3] = 255;
            }));

            const cities = await service.getCitiesFromRadar(0);

            expect(cities.find(city => city.id === liberec.id)!.color).toEqual({ r: 255, g: 0, b: 0 });
            expect(cities.filter(city => city.color.r !== 0 || city.color.g !== 0 || city.color.b !== 0).map(city => city.id))
                .toEqual([liberec.id]);
        });
    });
});
