import { expect, test } from '@playwright/test';
import { SAMPLE_PLAN } from '../../src/fixtures/sample-plan.js';

test.describe('Explore without an API key', () => {
  test('a visitor walks the sample plan to a runnable spec and a dispatch command', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Plan the tests');
    await expect(page.getByRole('button', { name: 'Generate plan' })).toBeDisabled();

    await page.getByRole('button', { name: 'Load sample plan' }).click();

    await expect(page.getByRole('heading', { name: SAMPLE_PLAN.title })).toBeVisible();
    await expect(page.getByText('sample plan', { exact: true })).toBeVisible();
    // header row + one row per risk
    await expect(page.getByRole('row')).toHaveCount(SAMPLE_PLAN.risks.length + 1);

    // Browser-layer, automatable scenarios are preselected; the manual one is not selectable.
    await expect(page.getByRole('checkbox', { name: /S1 / })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: /S8 / })).toBeDisabled();
    await expect(page.getByRole('button', { name: /Generate Playwright spec \(4 selected\)/ })).toBeVisible();

    await page.getByRole('button', { name: 'Load sample spec' }).click();

    await expect(page.getByTestId('lint-verdict')).toHaveText('passed');
    await expect(page.getByRole('heading', { name: 'checkout-journey.spec.ts' })).toBeVisible();

    await page.getByRole('button', { name: 'Continue to run' }).click();

    await expect(page.getByRole('heading', { name: 'Run on GitHub Actions' })).toBeVisible();
    await expect(page.getByLabel('GitHub CLI command')).toContainText('run-generated-spec.yml');
    await expect(page.getByLabel('GitHub CLI command')).toContainText('-f target=lab');
    await expect(page.getByRole('button', { name: 'Dispatch workflow' })).toBeDisabled();
  });

  test('completed steps stay reachable from the stepper, future steps do not', async ({ page }) => {
    await page.goto('/');
    const steps = page.getByRole('navigation', { name: 'Workflow steps' });
    await expect(steps.getByRole('button', { name: /Plan/ })).toBeDisabled();

    await page.getByRole('button', { name: 'Load sample plan' }).click();
    await expect(steps.getByRole('button', { name: /Plan/ })).toHaveAttribute('aria-current', 'step');
    await expect(steps.getByRole('button', { name: /Specs/ })).toBeDisabled();

    await steps.getByRole('button', { name: /Brief/ }).click();
    await expect(page.getByRole('heading', { name: 'Brief' })).toBeVisible();
  });
});
