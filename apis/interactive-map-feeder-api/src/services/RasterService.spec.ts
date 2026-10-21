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

    it('does not sample the header projection panel above the map at a large radius', async () => {
        expect.assertions(1);
        // Real png_masked layout: the geographic map is only x < 598, y >= 82. Rows 0-81
        // hold a north-south max-Z projection drawn in the radar palette, separated by a
        // black line at y = 81. Here: no rain on the map at all, rain in the header strip.
        const data = Buffer.alloc(WIDTH * HEIGHT * 4, 0);
        for (let col = 0; col < 598; col++) {
            for (let row = 50; row <= 81; row++) {
                const i = (row * WIDTH + col) * 4;
                if (row === 81) {
                    data[i + 3] = 255; // opaque black separator
                } else {
                    data[i + 2] = 252; data[i + 3] = 255; // radar scale 0,0,252
                }
            }
        }
        const image = sharp(data, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } });
        const decin = { latitude: 50.772656, longitude: 14.212861 };

        const color = await raster.getRGBAOnCoordinates(decin.latitude, decin.longitude, radar.bbox, image, 100);

        expect({ r: color.r, g: color.g, b: color.b, a: color.a }).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    });

    it('ignores opaque black pixels (frame, label) when rain is in the window', async () => {
        expect.assertions(1);
        const liberec = { latitude: 50.76638, longitude: 15.054439 };
        const { x, y } = pixelOf(liberec.latitude, liberec.longitude);

        const data = Buffer.alloc(WIDTH * HEIGHT * 4, 0);
        for (let row = y - 3; row <= y + 3; row++) {
            for (let col = x - 3; col <= x + 3; col++) {
                const i = (row * WIDTH + col) * 4;
                if (col <= x + 2) {
                    data[i + 3] = 255; // black, majority
                } else {
                    data[i] = 255; data[i + 3] = 255; // red
                }
            }
        }
        const image = sharp(data, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } });

        const color = await raster.getRGBAOnCoordinates(liberec.latitude, liberec.longitude, radar.bbox, image);

        expect({ r: color.r, g: color.g, b: color.b, a: color.a }).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    });

    it('leaves the LED off where ČHMÚ draws an echo in its pale (precipitation not reaching the ground) shade', async () => {
        expect.assertions(1);
        const liberec = { latitude: 50.76638, longitude: 15.054439 };
        const { x, y } = pixelOf(liberec.latitude, liberec.longitude);

        // radar_popis_cz.pdf: png_masked draws full colour only where PseudoCAPPI_2km >= 7 dBZ
        // (precipitation reaches the ground); elsewhere a lighter, less saturated colour.
        // 154,141,186 is the pale shade of 48,0,168, seen over Liberec on 20261020.2200.
        const data = Buffer.alloc(WIDTH * HEIGHT * 4, 0);
        for (let row = y - 3; row <= y + 3; row++) {
            for (let col = x - 3; col <= x + 3; col++) {
                const i = (row * WIDTH + col) * 4;
                data[i] = 154; data[i + 1] = 141; data[i + 2] = 186; data[i + 3] = 255;
            }
        }
        const image = sharp(data, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } });

        const color = await raster.getRGBAOnCoordinates(liberec.latitude, liberec.longitude, radar.bbox, image);

        expect({ r: color.r, g: color.g, b: color.b, a: color.a }).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    });

    it('picks the full-colour rain over a more frequent pale echo in the window', async () => {
        expect.assertions(1);
        const liberec = { latitude: 50.76638, longitude: 15.054439 };
        const { x, y } = pixelOf(liberec.latitude, liberec.longitude);

        const data = Buffer.alloc(WIDTH * HEIGHT * 4, 0);
        for (let row = y - 3; row <= y + 3; row++) {
            for (let col = x - 3; col <= x + 3; col++) {
                const i = (row * WIDTH + col) * 4;
                if (col <= x + 1) {
                    data[i] = 154; data[i + 1] = 141; data[i + 2] = 186; // pale, majority
                } else {
                    data[i + 2] = 252; // full-colour 0,0,252: rain at the ground
                }
                data[i + 3] = 255;
            }
        }
        const image = sharp(data, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } });

        const color = await raster.getRGBAOnCoordinates(liberec.latitude, liberec.longitude, radar.bbox, image);

        expect({ r: color.r, g: color.g, b: color.b, a: color.a }).toEqual({ r: 0, g: 0, b: 252, a: 255 });
    });
});
