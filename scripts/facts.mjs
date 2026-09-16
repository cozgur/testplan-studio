// Publishes the numbers this project can prove, so anything that quotes them (the
// portfolio, a README) reads them instead of repeating a figure written by hand.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const out = process.argv[2] ?? 'dist';
const readJson = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null);

const vitest = readJson('coverage/vitest.json');
const coverage = readJson('coverage/coverage-summary.json');
const e2e = Number(process.env.E2E_TESTS ?? 0);
const adrs = existsSync('docs/adr')
  ? readdirSync('docs/adr').filter((name) => /^\d{4}-.*\.md$/.test(name)).length
  : 0;

const facts = {
  name: 'TestPlan Studio',
  unitTests: vitest?.numTotalTests ?? null,
  e2eTests: e2e || null,
  coverageLines: coverage?.total?.lines?.pct ?? null,
  adrs,
  generatedAt: new Date().toISOString(),
};

mkdirSync(out, { recursive: true });
writeFileSync(`${out}/facts.json`, JSON.stringify(facts, null, 2) + '\n');
console.log('facts:', JSON.stringify(facts));
