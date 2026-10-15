#!/usr/bin/env node
/**
 * Builds the self-contained offline editor HTML file from the editable
 * sources: index.html, studio.css, studio.js, assets/brand-embedded.js and
 * the SVG assets referenced from the markup.
 *
 * Deterministic by design: the output depends only on source file bytes
 * (no timestamps), so CI can rebuild and diff it against the committed file.
 *
 * Usage: node tools/build-standalone.cjs
 */
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const OUTPUT = path.join(root, 'Runtime_Garden_Social_Studio_v2_Standalone.html');

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readBuffer = (rel) => fs.readFileSync(path.join(root, rel));

const inlineScript = (source) =>
  `<script>\n${source.replace(/<\/script>/gi, '<\\/script>')}\n</script>`;

const dataUri = (rel) => {
  const mime = rel.endsWith('.svg')
    ? 'image/svg+xml'
    : rel.endsWith('.png')
      ? 'image/png'
      : 'application/octet-stream';
  return `data:${mime};base64,${readBuffer(rel).toString('base64')}`;
};

let html = read('index.html');
const css = read('studio.css');
const brand = read('assets/brand-embedded.js');
const studio = read('studio.js');

const banner =
  '<!-- Generated file — do not edit.\n' +
  '     Built by tools/build-standalone.cjs from index.html, studio.css, studio.js and assets/.\n' +
  '     Rebuild with: npm run build:standalone -->\n';

// 1. Inline the stylesheet.
const styleTag = '<link rel="stylesheet" href="studio.css" />';
if (!html.includes(styleTag)) throw new Error('index.html no longer references studio.css as expected');
html = html.replace(styleTag, `<style>\n${css}\n</style>`);

// 2. Inline the scripts.
const brandTag = '<script src="assets/brand-embedded.js"></script>';
const studioTag = '<script src="studio.js"></script>';
if (!html.includes(brandTag)) throw new Error('index.html no longer references assets/brand-embedded.js as expected');
if (!html.includes(studioTag)) throw new Error('index.html no longer references studio.js as expected');
html = html.replace(brandTag, inlineScript(brand));
html = html.replace(studioTag, inlineScript(studio));

// 3. Replace every assets/ reference (favicon, logos, marks) with a data URI.
html = html.replace(/(src|href)="(assets\/[^"]+)"/g, (_match, attr, rel) => `${attr}="${dataUri(rel)}"`);

// 4. Fail loudly if anything still depends on sibling files.
const leftovers = [...html.matchAll(/(?:src|href)="(?!data:|https?:|#|mailto:)([^"]+)"/g)]
  .map((m) => m[1])
  .filter((ref) => !ref.endsWith('.html') && !ref.startsWith('docs/'));
if (leftovers.length) {
  throw new Error(`Standalone build still references local files: ${leftovers.join(', ')}`);
}

html = html.replace('<!doctype html>', `<!doctype html>\n${banner}`);

fs.writeFileSync(OUTPUT, html);
const bytes = fs.statSync(OUTPUT).size;
const sha256 = crypto.createHash('sha256').update(readBuffer('Runtime_Garden_Social_Studio_v2_Standalone.html')).digest('hex');
console.log(`wrote ${path.relative(root, OUTPUT)} (${bytes} bytes, sha256 ${sha256})`);
