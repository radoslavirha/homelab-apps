// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const IMAGE = 'nginxinc/nginx-unprivileged:1.31-alpine';
const root = resolve(__dirname, '..');
let container = '';
let base = '';

// stderr is piped, not inherited, so `docker run` pulling the image does not print its progress
// into the test output. A failing command still reports it, in the thrown error's message.
const docker = (...args: string[]): string => execFileSync('docker', args, { stdio: 'pipe' }).toString().trim();

describe('nginx.conf.template with the image default NGINX_BASE_PATH=/', () => {
    beforeAll(async () => {
        const html = mkdtempSync(join(tmpdir(), 'qr-ui-html-'));
        writeFileSync(join(html, 'index.html'), '<!doctype html><html><head><title>x</title></head><body></body></html>');
        mkdirSync(join(html, 'assets'));
        writeFileSync(join(html, 'assets', 'index-n3w.js'), 'export {};');
        writeFileSync(join(html, 'config.json'), '{"apiBaseURL":"http://api"}');
        execFileSync('chmod', ['-R', 'a+rX', html]);
        container = docker(
            'run', '-d', '-p', '127.0.0.1::8080',
            '-e', 'NGINX_BASE_PATH=/',
            '-v', `${join(root, 'nginx.conf.template')}:/etc/nginx/templates/default.conf.template:ro`,
            '-v', `${join(root, 'docker-entrypoint.d/10-normalize-base-path.envsh')}:/docker-entrypoint.d/10-normalize-base-path.envsh:ro`,
            '-v', `${resolve(root, '../../packages/nginx-runtime/conf.d/healthz.conf')}:/etc/nginx/snippets/healthz.conf:ro`,
            '-v', `${html}:/usr/share/nginx/html:ro`,
            IMAGE
        );
        const port = docker('port', container, '8080').split(':').pop();
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
        if (container) docker('rm', '-f', container);
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

    it('answers 404 for a missing hashed asset instead of serving index.html as JavaScript', async () => {
        const response = await fetch(`${base}/assets/index-0ld4a5h.js`);
        expect(response.status).toBe(404);
        expect(await response.text()).not.toContain('<title>x</title>');
    });

    it('never marks the 404 for a missing hashed asset immutable, so a rollout race is not cached for a year', async () => {
        expect.assertions(2);
        const response = await fetch(`${base}/assets/index-0ld4a5h.js`);
        expect(response.status).toBe(404);
        expect(response.headers.get('cache-control') ?? '').not.toMatch(/immutable|max-age/);
    });

    it('serves an existing hashed asset as immutable', async () => {
        expect.assertions(2);
        const response = await fetch(`${base}/assets/index-n3w.js`);
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toMatch(/immutable/);
    });

    it('redirects a slashless directory to a relative Location, not the container scheme and port', async () => {
        const response = await fetch(`${base}/assets`, { redirect: 'manual' });
        expect(response.status).toBe(301);
        expect(response.headers.get('location')).toBe('/assets/');
    });

    it('stops browsers from caching index.html across a deploy', async () => {
        const response = await fetch(`${base}/admin`);
        expect(response.headers.get('cache-control')).toMatch(/no-cache|no-store/);
    });
});

describe('nginx.conf.template with a sub-path NGINX_BASE_PATH', () => {
    let subContainer = '';
    let subBase = '';

    beforeAll(async () => {
        const html = mkdtempSync(join(tmpdir(), 'qr-ui-html-'));
        writeFileSync(join(html, 'index.html'), '<!doctype html><html><head><title>x</title></head><body></body></html>');
        execFileSync('chmod', ['-R', 'a+rX', html]);
        subContainer = docker(
            'run', '-d', '-p', '127.0.0.1::8080',
            '-e', 'NGINX_BASE_PATH=/qr-manager',
            '-v', `${join(root, 'nginx.conf.template')}:/etc/nginx/templates/default.conf.template:ro`,
            '-v', `${join(root, 'docker-entrypoint.d/10-normalize-base-path.envsh')}:/docker-entrypoint.d/10-normalize-base-path.envsh:ro`,
            '-v', `${resolve(root, '../../packages/nginx-runtime/conf.d/healthz.conf')}:/etc/nginx/snippets/healthz.conf:ro`,
            '-v', `${html}:/usr/share/nginx/html:ro`,
            IMAGE
        );
        subBase = `http://127.0.0.1:${docker('port', subContainer, '8080').split(':').pop()}`;
        for (let i = 0; i < 50; i++) {
            try {
                await fetch(`${subBase}/healthz`);
                return;
            } catch {
                await new Promise(r => setTimeout(r, 200));
            }
        }
    }, 120_000);

    afterAll(() => {
        if (subContainer) docker('rm', '-f', subContainer);
    });

    it('redirects the slashless base path to a relative Location, so the browser keeps its own scheme and port', async () => {
        const response = await fetch(`${subBase}/qr-manager`, { redirect: 'manual' });
        expect(response.status).toBe(301);
        expect(response.headers.get('location')).toBe('/qr-manager/');
    });
});
