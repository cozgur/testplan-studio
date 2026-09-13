import { describe, expect, test } from 'vitest';
import { lintSpec } from '../../src/domain/guardrails.js';
import { SAMPLE_SPEC } from '../../src/fixtures/sample-spec.js';

const wrap = (body: string) => `import { test, expect } from '@playwright/test';
test('x', async ({ page }) => {
  await page.goto('/');
${body}
  await expect(page.getByRole('heading')).toBeVisible();
});
`;

describe('lintSpec', () => {
  test('the sample spec passes with no findings', () => {
    const result = lintSpec(SAMPLE_SPEC.code);
    expect(result).toMatchObject({ passed: true, errors: 0, warnings: 0, findings: [] });
  });

  test.each([
    ['no-wait-for-timeout', '  await page.waitForTimeout(1000);', 'error'],
    ['no-sleep', '  await new Promise((r) => setTimeout(r, 500));', 'error'],
    ['no-element-handles', "  const el = await page.$('#id');", 'error'],
    ['no-xpath', "  await page.locator('//button').click();", 'error'],
    ['no-xpath', "  await page.locator('xpath=//button').click();", 'error'],
    ['no-test-only', "  test.only('y', async () => {});", 'error'],
    [
      'prefer-web-first-assertions',
      '  expect(await page.getByRole("button").isVisible()).toBe(true);',
      'error',
    ],
    ['no-force', "  await page.getByRole('button').click({ force: true });", 'warning'],
    ['no-network-idle', "  await page.waitForLoadState('networkidle');", 'warning'],
    ['prefer-semantic-locators', "  await page.locator('.btn-primary').click();", 'warning'],
    ['prefer-semantic-locators', "  await page.locator('#checkout').click();", 'warning'],
    ['no-hardcoded-host', "  await page.goto('https://example.com/');", 'warning'],
  ] as const)('%s fires on: %s', (rule, line, severity) => {
    const result = lintSpec(wrap(line));
    const finding = result.findings.find((f) => f.rule === rule);
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe(severity);
    expect(finding?.line).toBe(4);
  });

  test('errors fail the lint, warnings alone do not', () => {
    expect(lintSpec(wrap("  await page.getByRole('button').click({ force: true });")).passed).toBe(true);
    expect(lintSpec(wrap('  await page.waitForTimeout(10);')).passed).toBe(false);
  });

  test('ignores anti-patterns mentioned in comments', () => {
    const result = lintSpec(wrap('  // never use page.waitForTimeout(1000) here\n  /* page.$("x") */'));
    expect(result.findings).toEqual([]);
  });

  test('flags a file with no Playwright import, no tests and no assertions', () => {
    const rules = lintSpec('const x = 1;').findings.map((f) => f.rule);
    expect(rules).toEqual(
      expect.arrayContaining([
        'missing-playwright-import',
        'no-assertions',
        'no-tests',
        'no-semantic-locators',
      ]),
    );
  });

  test('warns when no semantic locators are used', () => {
    const code = `import { test, expect } from '@playwright/test';
test('x', async ({ page }) => { await page.goto('/'); await expect(page).toHaveURL(/\\//); });`;
    expect(lintSpec(code).findings.map((f) => f.rule)).toEqual(['no-semantic-locators']);
  });

  test('sorts findings by line then rule', () => {
    const result = lintSpec(wrap("  await page.waitForTimeout(1);\n  await page.locator('#x').click();"));
    expect(result.findings.map((f) => `${f.line}:${f.rule}`)).toEqual([
      '4:no-wait-for-timeout',
      '5:prefer-semantic-locators',
    ]);
  });
});
