// Command-line test runner: node tests/run-node.mjs
// Exits non-zero on any failure or when zero tests ran.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runSuites, SUITES } from './harness.js';

const here = dirname(fileURLToPath(import.meta.url));

let content = null;
try {
  content = JSON.parse(await readFile(join(here, '..', 'data', 'levels.json'), 'utf8'));
} catch (err) {
  console.error(`Could not read data/levels.json: ${err.message}`);
}

const result = await runSuites(SUITES, (name) => import(`./${name}`), content);

console.log(`Tests run: ${result.total}  passed: ${result.passed}  failed: ${result.failed.length}`);
for (const f of result.failed) {
  console.log(`  FAIL  ${f.name}\n        ${f.message}`);
}
process.exit(result.failed.length === 0 && result.total > 0 ? 0 : 1);
