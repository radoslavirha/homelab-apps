import { PlatformTest } from '@tsed/platform-http/testing';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

describe('RasterService.getRGBAOnCoordinates', () => {
    let raster: RasterService;
    let radar: RadarService;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        raster = PlatformTest.get<RasterService>(RasterService);
        radar = PlatformTest.get<RadarService>(RadarService);
    });
    afterEach(PlatformTest.reset);

    it('samples the pixel ČHMÚ draws at the city (Liberec)', async () => {
        expect.assertions(1);
        const liberec = { latitude: 50.76638, longitude: 15.054439 };
        const { x, y } = pixelOf(liberec.latitude, liberec.longitude);

        const data = Buffer.alloc(WIDTH * HEIGHT * 4, 0);
        const i = (y * WIDTH + x) * 4;
        data[i] = 255; data[i + 3] = 255; // one opaque red pixel where the radar shows Liberec
        const image = sharp(data, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } });

        const color = await raster.getRGBAOnCoordinates(liberec.latitude, liberec.longitude, radar.bbox, image, 0);

        expect({ r: color.r, a: color.a }).toEqual({ r: 255, a: 255 });
    });

    it('does not darken a city in rain by averaging in transparent (no-data) pixels', async () => {
        expect.assertions(1);
        const liberec = { latitude: 50.76638, longitude: 15.054439 };
        const { x, y } = pixelOf(liberec.latitude, liberec.longitude);

        // Heavy rain (opaque red) over the city and the 3 rows north of it; the rest of
        // the default 2.5 km window (7x7 px) is transparent, i.e. no precipitation.
        const data = Buffer.alloc(WIDTH * HEIGHT * 4, 0);
        for (let row = y - 3; row <= y; row++) {
            for (let col = x - 3; col <= x + 3; col++) {
                const i = (row * WIDTH + col) * 4;
                data[i] = 255; data[i + 3] = 255;
            }
        }
        const image = sharp(data, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } });

        const color = await raster.getRGBAOnCoordinates(liberec.latitude, liberec.longitude, radar.bbox, image);

        expect({ r: color.r, g: color.g, b: color.b }).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('returns the most frequent radar colour, not a blend of palette entries', async () => {
        expect.assertions(1);
        const liberec = { latitude: 50.76638, longitude: 15.054439 };
        const { x, y } = pixelOf(liberec.latitude, liberec.longitude);

        const data = Buffer.alloc(WIDTH * HEIGHT * 4, 0);
        for (let row = y - 3; row <= y + 3; row++) {
            for (let col = x - 3; col <= x + 3; col++) {
                const i = (row * WIDTH + col) * 4;
                data[col <= x ? i : i + 2] = 255;
                data[i + 3] = 255;
            }
        }
        const image = sharp(data, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } });

        const color = await raster.getRGBAOnCoordinates(liberec.latitude, liberec.longitude, radar.bbox, image);

        expect({ r: color.r, g: color.g, b: color.b }).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('returns transparent black when no pixel in the window has precipitation', async () => {
        expect.assertions(1);
        const image = sharp(Buffer.alloc(WIDTH * HEIGHT * 4, 0), { raw: { width: WIDTH, height: HEIGHT, channels: 4 } });

        const color = await raster.getRGBAOnCoordinates(50.76638, 15.054439, radar.bbox, image);

        expect({ r: color.r, g: color.g, b: color.b, a: color.a }).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    });
});
