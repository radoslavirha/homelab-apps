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
});
