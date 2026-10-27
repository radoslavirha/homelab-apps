import { defaultConfig } from '@radoslavirha/config-vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

export default defineConfig(mergeConfig(defaultConfig, {
    oxc: false,
    test: {
        // Console output (logger lines included) is printed only for a failing test.
        silent: 'passed-only',
        coverage: {
            thresholds: {
                branches: 90,
                functions: 90,
                lines: 90,
                statements: 90
            }
        }
    }
}));
