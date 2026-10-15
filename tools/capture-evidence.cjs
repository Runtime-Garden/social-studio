#!/usr/bin/env node
/**
 * Captures committed visual evidence of the editor in a real browser into
 * docs/evidence/p0/. Requires `npx playwright install` browsers.
 *
 * Usage: node tools/capture-evidence.cjs
 */
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'docs', 'evidence', 'p0');
const PORT = 4174;
const BASE = `http://127.0.0.1:${PORT}`;

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'tools', 'serve.cjs'), root, String(PORT)], {
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    const timer = setTimeout(() => reject(new Error('serve.cjs did not start in 10s')), 10_000);
    child.stdout.on('data', (chunk) => {
      if (String(chunk).includes('Serving')) {
        clearTimeout(timer);
        resolve(child);
      }
    });
    child.on('error', reject);
  });
}

async function settle(page) {
  await page.evaluate(() => document.fonts?.ready ?? Promise.resolve());
  await page.waitForTimeout(300);
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });
  const shots = [];

  try {
    await page.goto(`${BASE}/index.html`);
    await page.waitForSelector('#templateGrid .template-card');
    await settle(page);
    await page.screenshot({ path: path.join(outDir, '01-editor-light.png') });
    shots.push('01-editor-light.png');

    await page.evaluate(() => setSlideProp('theme', 'dark'));
    await settle(page);
    await page.screenshot({ path: path.join(outDir, '02-editor-dark.png') });
    shots.push('02-editor-dark.png');

    await page.click('button[data-left="series"]');
    await page.waitForSelector('.series-card');
    await settle(page);
    await page.screenshot({ path: path.join(outDir, '03-series-tab.png') });
    shots.push('03-series-tab.png');

    await page.click('#exportBtn');
    await page.waitForSelector('#exportModal:not(.hidden)');
    await settle(page);
    await page.screenshot({ path: path.join(outDir, '04-export-modal.png') });
    shots.push('04-export-modal.png');

    const standalone = path.join(root, 'Runtime_Garden_Social_Studio_v2_Standalone.html');
    if (fs.existsSync(standalone)) {
      await page.goto(`file://${standalone}`);
      await page.waitForSelector('#templateGrid .template-card');
      await settle(page);
      await page.screenshot({ path: path.join(outDir, '05-standalone-file-protocol.png') });
      shots.push('05-standalone-file-protocol.png');
    }
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }

  console.log(`Captured ${shots.length} screenshots into ${path.relative(root, outDir)}:`);
  for (const shot of shots) console.log(`  - ${shot}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
