import { defaultConfig } from '@radoslavirha/config-vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

export default defineConfig(mergeConfig(defaultConfig, {
    oxc: false,
    test: {
        coverage: {
            // The bootstrap and the OTel preload run only as a real process.
            exclude: ['src/index.ts', 'src/otel/**'],
            thresholds: {
                lines: 90,
                functions: 90,
                statements: 90,
                branches: 90
            }
        }
    }
}));
