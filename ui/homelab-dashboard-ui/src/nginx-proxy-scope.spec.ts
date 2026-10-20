import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const template = readFileSync(resolve(__dirname, '../nginx.conf.template'), 'utf8');

/** Every `location` block whose body attaches the Unifi API key. */
const keyedLocations = [...template.matchAll(/location\s+([^{]+)\{([\s\S]*?)\n    \}/g)]
    .filter(([, , body]) => body.includes('X-Api-Key'))
    .map(([, matcher, body]) => ({ matcher: matcher.trim(), body }));

describe('nginx.conf.template Unifi proxy scope', () => {
    it('attaches the API key only to the static-dns endpoint the app calls', () => {
        expect(keyedLocations.length).toBeGreaterThan(0);
        for (const { matcher } of keyedLocations) {
            expect(matcher).toMatch(/static-dns/);
        }
    });

    it('only forwards read requests with the API key', () => {
        for (const { body } of keyedLocations) {
            expect(body).toMatch(/limit_except\s+GET/);
        }
    });

    it('refuses every other path under /proxy/network/', () => {
        expect(template).toMatch(/location\s+\/proxy\/network\/\s*\{\s*return 404;/);
    });

    describe('UNIFI_HOST handling', () => {
        const entrypoint = (file: string) => resolve(__dirname, '../docker-entrypoint.d', file);
        const normalize = (host: string) =>
            spawnSync('sh', ['-c', `. "$1" && printf %s "$UNIFI_HOST"`, 'sh', entrypoint('09-normalize-unifi-host.envsh')], {
                env: { UNIFI_HOST: host },
                encoding: 'utf8'
            }).stdout;
        const guard = (host: string) =>
            spawnSync('sh', [entrypoint('10-require-unifi-env.sh')], { env: { UNIFI_HOST: host, SECRET_UNIFI_API_KEY: 'k' } });

        it('never renders a proxy_pass URI part when UNIFI_HOST ends in a slash', () => {
            const host = normalize('https://192.168.1.1/');
            const [keyed] = keyedLocations;
            const target = /proxy_pass\s+(\S+);/.exec(keyed.body.replaceAll('${UNIFI_HOST}', host))![1];

            expect(guard(host).status).toBe(0);
            // nginx refuses to load a regex location whose proxy_pass has anything after host[:port].
            expect(target.replace(/^[a-z]+:\/\/[^/]+/i, '')).toBe('');
        });

        it('leaves a host without a trailing slash unchanged', () => {
            expect(normalize('https://192.168.1.1:8443')).toBe('https://192.168.1.1:8443');
        });

        it('refuses a UNIFI_HOST that carries a path', () => {
            expect(guard('https://gw.example/unifi').status).not.toBe(0);
        });
    });
});

describe('nginx.conf.template redirects', () => {
    const docker = (...args: string[]): string => execFileSync('docker', args, { stdio: 'pipe' }).toString().trim();
    let container = '';
    let base = '';

    beforeAll(async () => {
        const html = mkdtempSync(join(tmpdir(), 'dashboard-ui-html-'));
        mkdirSync(join(html, 'assets'));
        writeFileSync(join(html, 'index.html'), '<!doctype html><html><head></head><body></body></html>');
        execFileSync('chmod', ['-R', 'a+rX', html]);
        const root = resolve(__dirname, '..');
        container = docker(
            'run', '-d', '-p', '127.0.0.1::8080',
            '-e', 'UNIFI_HOST=https://192.0.2.1', '-e', 'SECRET_UNIFI_API_KEY=k',
            '-v', `${join(root, 'nginx.conf.template')}:/etc/nginx/templates/default.conf.template:ro`,
            '-v', `${join(root, 'docker-entrypoint.d/09-normalize-unifi-host.envsh')}:/docker-entrypoint.d/09-normalize-unifi-host.envsh:ro`,
            '-v', `${join(root, 'docker-entrypoint.d/10-require-unifi-env.sh')}:/docker-entrypoint.d/10-require-unifi-env.sh:ro`,
            '-v', `${resolve(root, '../../packages/nginx-runtime/conf.d/healthz.conf')}:/etc/nginx/snippets/healthz.conf:ro`,
            '-v', `${html}:/usr/share/nginx/html:ro`,
            'nginxinc/nginx-unprivileged:1.31-alpine'
        );
        base = `http://127.0.0.1:${docker('port', container, '8080').split(':').pop()}`;
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

    it('redirects a slashless directory to a relative Location, not the container scheme and port', async () => {
        expect.assertions(2);
        const response = await fetch(`${base}/assets`, { redirect: 'manual' });
        expect(response.status).toBe(301);
        expect(response.headers.get('location')).toBe('/assets/');
    });
});
