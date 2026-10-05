// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const IMAGE = 'nginxinc/nginx-unprivileged:1.31-alpine';
const root = resolve(__dirname, '..');
let container = '';
let base = '';

describe('nginx.conf.template with the image default NGINX_BASE_PATH=/', () => {
    beforeAll(async () => {
        const html = mkdtempSync(join(tmpdir(), 'qr-ui-html-'));
        writeFileSync(join(html, 'index.html'), '<!doctype html><html><head><title>x</title></head><body></body></html>');
        writeFileSync(join(html, 'config.json'), '{"apiBaseURL":"http://api"}');
        execFileSync('chmod', ['-R', 'a+rX', html]);
        container = execFileSync('docker', [
            'run', '-d', '-p', '127.0.0.1::8080',
            '-e', 'NGINX_BASE_PATH=/',
            '-v', `${join(root, 'nginx.conf.template')}:/etc/nginx/templates/default.conf.template:ro`,
            '-v', `${join(root, 'docker-entrypoint.d/10-normalize-base-path.envsh')}:/docker-entrypoint.d/10-normalize-base-path.envsh:ro`,
            '-v', `${resolve(root, '../../packages/nginx-runtime/conf.d/healthz.conf')}:/etc/nginx/snippets/healthz.conf:ro`,
            '-v', `${html}:/usr/share/nginx/html:ro`,
            IMAGE
        ]).toString().trim();
        const port = execFileSync('docker', ['port', container, '8080']).toString().trim().split(':').pop();
        base = `http://127.0.0.1:${port}`;
        for (let i = 0; i < 50; i++) {
            try {
                await fetch(`${base}/healthz`);
                return;
            } catch {
                await new Promise(r => setTimeout(r, 200));
            }
        }
    }, 120_000);

    afterAll(() => {
        if (container) execFileSync('docker', ['rm', '-f', container]);
    });

    it('serves config.json', async () => {
        const response = await fetch(`${base}/config.json`);
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ apiBaseURL: 'http://api' });
    });

    it('serves the SPA at / instead of redirecting', async () => {
        const response = await fetch(`${base}/`, { redirect: 'manual' });
        expect(response.status).toBe(200);
    });

    it('injects a usable <base href> on a deep route', async () => {
        const response = await fetch(`${base}/admin/abc`);
        expect(response.status).toBe(200);
        expect(await response.text()).toContain('<base href="/">');
    });
});
