import { defaultConfig } from '@radoslavirha/config-vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

export default defineConfig(mergeConfig(defaultConfig, {
    oxc: false,
    test: {
        // Console output (logger lines included) is printed only for a failing test.
        silent: 'passed-only',
        // One pgvector container for the run; a fresh database per test file.
        globalSetup: ['./src/test/globalSetup.ts'],
        setupFiles: ['./src/test/setupDatabase.ts'],
        hookTimeout: 120_000,
        testTimeout: 30_000,
        coverage: {
            exclude: ['src/models/**', 'src/otel/**', 'src/test/**', 'src/migrations/**', 'src/index.ts'],
            thresholds: {
                lines: 98,
                functions: 95,
                statements: 97,
                branches: 88
            }
        }
    }
}));
