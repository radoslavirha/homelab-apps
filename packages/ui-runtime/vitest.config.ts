import { defaultConfig } from '@radoslavirha/config-vitest';
import { defineConfig, mergeConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// defaultConfig's SWC plugin exists for Ts.ED decorators. Here plugin-react's Oxc transform does
// TS and JSX, and keeping SWC too makes Vite warn that `esbuild: false` is ignored on every run.
export default defineConfig(mergeConfig({ ...defaultConfig, plugins: [] }, {
    plugins: [react()],
    test: {
        // Console output (logger lines included) is printed only for a failing test.
        silent: 'passed-only',
        environment: 'jsdom',
        coverage: {
            thresholds: {
                branches: 80,
                functions: 80,
                lines: 80,
                statements: 80
            }
        }
    }
}));
