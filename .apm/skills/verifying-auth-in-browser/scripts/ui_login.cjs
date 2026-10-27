// Sign in to a UI as the E2E test user in a real browser and save the session for reuse.
//
//   NODE_PATH=<playwright prefix>/node_modules claude-e2e run -- node scripts/ui_login.cjs <ui-base-url> <state.json>
//
// Then every later page in the run starts from `browser.newContext({ storageState: '<state.json>' })`
// and is signed in with no typing: one top-level prompt=none hop to the IdP, nothing else.
// One login per call, in a fresh 30-second TOTP window (a code is accepted once).
// <state.json> holds a live Authentik session: write it under $TMPDIR, never into a repo.
// Prints hop counts only -- never a credential.
const crypto = require('node:crypto');
const { chromium } = require('playwright');

const [UI, STATE] = process.argv.slice(2);
const base = (UI || '').replace(/\/?$/, '/');
if (!UI || !STATE) {
    console.error('usage: ui_login.cjs <ui-base-url> <state.json>');
    process.exit(2);
}
for (const v of ['E2E_USERNAME', 'E2E_PASSWORD', 'E2E_TOTP_SECRET']) {
    if (!process.env[v]) {
        console.error(`${v} missing -- run me under \`claude-e2e run --\``);
        process.exit(2);
    }
}

function totp(secret) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    for (const ch of secret.replace(/[\s=]/g, '').toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, '0');
    const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
    const msg = Buffer.alloc(8);
    msg.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
    const h = crypto.createHmac('sha1', key).update(msg).digest();
    const o = h[h.length - 1] & 15;
    return String((h.readUInt32BE(o) & 0x7fffffff) % 1000000).padStart(6, '0');
}

const nextTotpWindow = () => new Promise((r) => setTimeout(r, (30 - ((Date.now() / 1000) % 30) + 0.5) * 1000));

// <ak-loading-overlay> sits between stages and swallows pointer events: wait it out, submit with Enter.
async function settle(page) {
    await page.locator('ak-loading-overlay').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(500);
}

(async () => {
    const browser = await chromium.launch();
    try {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        const idp = [];
        const frames = [];
        page.on('request', (r) => {
            if (r.isNavigationRequest() && r.frame() === page.mainFrame() && r.url().startsWith('https://auth.irha.cz/')) idp.push(r.url());
        });
        page.on('framenavigated', (f) => f !== page.mainFrame() && frames.push(f.url()));

        // Always the trailing-slash form: measured 2026-10-18, `/qr-manager` without it answers
        // 301 to http://<host>:8080/qr-manager/ -- the container's own scheme and port.
        await page.goto(base);
        // Some UIs show a sign-in page, others redirect straight away. Wait for whichever comes
        // first: isVisible() does not wait, and runs before the SPA has rendered the button.
        const signIn = page.getByRole('button', { name: /sign in/i });
        await Promise.race([
            page.waitForURL(/auth\.irha\.cz/, { timeout: 20000 }),
            signIn.waitFor({ state: 'visible', timeout: 20000 }).then(() => signIn.click()),
        ]);
        await page.waitForURL(/auth\.irha\.cz/, { timeout: 20000 });
        await settle(page);

        // Every input must be :visible -- the stages also carry hidden autofill inputs.
        await page.locator('input[name="uidField"]:visible').fill(process.env.E2E_USERNAME);
        await page.keyboard.press('Enter');
        await settle(page);
        await page.locator('input[name="password"]:visible').fill(process.env.E2E_PASSWORD);
        await page.keyboard.press('Enter');
        await settle(page);
        const code = page.locator('input[name="code"]:visible');
        await code.waitFor({ timeout: 20000 });
        await nextTotpWindow();
        await code.fill(totp(process.env.E2E_TOTP_SECRET));
        await page.keyboard.press('Enter');

        await page.waitForURL((u) => u.href.startsWith(base) && !u.pathname.endsWith('/callback'), { timeout: 30000 });
        await page.getByText(process.env.E2E_USERNAME, { exact: true }).first().waitFor({ timeout: 20000 });
        await ctx.storageState({ path: STATE });
        console.log(`signed in: ${new URL(page.url()).pathname} | IdP navigations ${idp.length} | sub-frame navigations ${frames.length}`);
        console.log(`session saved: ${STATE}`);
    } finally {
        await browser.close();
    }
})().catch((e) => {
    console.error('ui_login FAILED:', e.message.split('\n')[0]);
    process.exit(1);
});
