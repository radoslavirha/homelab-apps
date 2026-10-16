import { defaultConfig } from '@radoslavirha/config-vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

export default defineConfig(mergeConfig(defaultConfig, {
    oxc: false,
    test: {
        // MongoDB is the only storage, so the controller integration specs boot against a
        // real one (Docker required). Each `TestContainersMongo.bootstrap` gets its own database.
        globalSetup: [import.meta.resolve('@tsed/testcontainers-mongo/vitest/setup')],
        coverage: {
            exclude: ['src/models/**', 'src/test/**'],
            thresholds: {
                lines: 83,
                functions: 87,
                statements: 83,
                branches: 73
            }
        }
    }
}));
