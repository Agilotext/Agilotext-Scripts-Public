// Captures de la galerie synthétique en 1312 et 390 px, plus un audit axe.
// Usage : ASV2_TOOLS=/tmp/asv2-tools/node_modules node tests/screens.mjs [label]
// ASV2_TOOLS doit contenir playwright-core et @axe-core/playwright. Chrome système requis.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';
import { execSync } from 'node:child_process';
import { STATES, WEBFLOW_SHIM } from './gallery-states.mjs';

const tools = process.env.ASV2_TOOLS;
if (!tools) throw new Error('ASV2_TOOLS manquant (dossier node_modules avec playwright-core)');
const require = createRequire(join(tools, 'noop.js'));
const { chromium } = require('playwright-core');
const { default: AxeBuilder } = require('@axe-core/playwright');

const root = new URL('..', import.meta.url).pathname;
const sha = execSync('git rev-parse --short=8 HEAD', { cwd: root }).toString().trim();
const label = process.argv[2] || sha;
const outDir = join(root, 'docs', 'screens', label);
const only = process.env.ASV2_ONLY ? new RegExp(process.env.ASV2_ONLY) : null;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.txt': 'text/plain', '.csv': 'text/csv',
  '.docx': 'application/octet-stream', '.json': 'application/json', '.woff2': 'font/woff2' };

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try {
    const body = await readFile(join(root, path));
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}/tests/staging-equivalent.html`;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
await mkdir(outDir, { recursive: true });
const report = [];

for (const state of STATES) {
  if (only && !only.test(state.id)) continue;
  for (const [vp, width, height] of [['desktop', 1312, 900], ['mobile', 390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    if (!state.tour) await ctx.addInitScript(() => localStorage.setItem('agiloshield-first-visit-guide-v1', 'seen'));
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message || e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(base + (state.query ? '?' + state.query : ''), { waitUntil: 'load' });
    await page.addStyleTag({ content: WEBFLOW_SHIM });
    await page.waitForTimeout(1800);
    if (state.open) {
      const reviewOpen = page.locator('#agiloshield-v2-staging .asv2-doc-primary:visible').filter({ hasText: /Vérifier|Voir le détail/ }).first();
      if (await reviewOpen.count()) {
        await reviewOpen.click({ timeout: 5000 }).catch((e) => errors.push('open: ' + e.message.split('\n')[0]));
        await page.waitForTimeout(2500);
      } else {
        const menu = page.locator('#agiloshield-v2-staging .asv2-menu-toggle:visible').first();
        if (await menu.count()) {
          await menu.click({ timeout: 5000 }).catch((e) => errors.push('open-menu: ' + e.message.split('\n')[0]));
          await page.waitForTimeout(200);
          const see = page.locator('#agiloshield-v2-staging .asv2-menu-item:visible').filter({ hasText: /Voir le résultat/ }).first();
          if (await see.count()) {
            await see.click({ timeout: 5000 }).catch((e) => errors.push('open: ' + e.message.split('\n')[0]));
            await page.waitForTimeout(2500);
          } else errors.push('open target absent');
        } else errors.push('open target absent');
      }
    }
    if (state.click) {
      const btn = page.locator('#agiloshield-v2-staging button').filter({ hasText: state.click }).first();
      if (await btn.count()) { await btn.click({ timeout: 5000 }).catch((e) => errors.push('click: ' + e.message.split('\n')[0])); await page.waitForTimeout(500); }
      else errors.push('click target absent: ' + state.click);
    }
    await page.screenshot({ path: join(outDir, `${state.id}-${vp}.png`), fullPage: true });
    let violations = [];
    if (vp === 'desktop') {
      const axe = await new AxeBuilder({ page }).include('#agiloshield-v2-staging').analyze();
      violations = axe.violations.filter((v) => ['serious', 'critical'].includes(v.impact))
        .map((v) => `${v.id} (${v.nodes.length})`);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    report.push({ state: state.id, vp, errors, axe: violations, overflow });
    await ctx.close();
  }
}
await browser.close();
server.close();

const lines = [`# Captures ${label}`, '', '| État | Vue | Erreurs | axe serious/critical | Débordement |', '|---|---|---|---|---|'];
for (const r of report) lines.push(`| ${r.state} | ${r.vp} | ${r.errors.length ? r.errors.join('<br>').slice(0, 200) : '0'} | ${r.axe.join(', ') || '0'} | ${r.overflow ? 'oui' : 'non'} |`);
await writeFile(join(outDir, 'REPORT.md'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
const fatal = report.some((r) => r.errors.some((e) => /SyntaxError|ReferenceError|TypeError/.test(e)));
process.exit(fatal ? 1 : 0);
