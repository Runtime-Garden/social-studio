#!/usr/bin/env node
/**
 * Regenerates the committed example projects in examples/ from the current
 * pack definitions in studio.js. This REWRITES TRACKED FILES by design —
 * run it only when example projects should be refreshed, then review the
 * `git diff` and commit deliberately.
 *
 * The test suites never call this; tests only read examples/.
 */
'use strict';

const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const file = path.join(__dirname, '..', 'studio.js');
let src = fs.readFileSync(file, 'utf8').replace(/start\(\)\.catch\(e=>\{console\.error\(e\);toast\('Studio initialization failed: '\+e\.message\)\}\);\s*$/, '');
const sand = { structuredClone, console, confirm: () => true };
vm.createContext(sand);
vm.runInContext(src, sand);

const docs = JSON.parse(
  vm.runInContext(
    `JSON.stringify(SERIES_PACKS.map(pack=>({id:pack.id,payload:JSON.stringify({format:'runtime-garden-social-studio',version:2,...(app={name:'Runtime Garden · '+pack.name,seriesPack:'none',slides:[NEW_SLIDE('cover')],selected:0},applySeriesPack(pack.id),app)},null,2)})))`,
    sand,
  ),
);

for (const d of docs) {
  const out = path.join(__dirname, '..', 'examples', `series-${d.id}.rgstudio.json`);
  fs.writeFileSync(out, d.payload);
  console.log(`wrote ${path.relative(process.cwd(), out)}`);
}
console.log(`Refreshed ${docs.length} example projects. Review with "git diff" before committing.`);
