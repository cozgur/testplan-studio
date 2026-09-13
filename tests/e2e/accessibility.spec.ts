import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function expectNoViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const summary = results.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help} @ ${v.nodes[0]?.target.join(' ')}`,
  );
  expect(summary, `${label}: axe violations`).toEqual([]);
}

test.describe('Accessibility', () => {
  test('brief step has no detectable WCAG A/AA violations', async ({ page }) => {
    await page.goto('/');
    await expectNoViolations(page, 'brief');
  });

  test('plan, spec and run steps have no detectable WCAG A/AA violations', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Load sample plan' }).click();
    await expectNoViolations(page, 'plan');

    await page.getByRole('button', { name: 'Load sample spec' }).click();
    await expectNoViolations(page, 'specs');

    await page.getByRole('button', { name: 'Continue to run' }).click();
    await expectNoViolations(page, 'run');
  });
});
