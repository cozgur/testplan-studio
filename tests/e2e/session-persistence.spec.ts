import { expect, test } from '@playwright/test';
import { SAMPLE_PLAN } from '../../src/fixtures/sample-plan.js';

test.describe('Session persistence', () => {
  test('a reload keeps the plan and the step but never the API key', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Anthropic API key', { exact: true }).fill('sk-ant-test-key');
    await page.getByRole('button', { name: 'Load sample plan' }).click();
    await expect(page.getByRole('heading', { name: SAMPLE_PLAN.title })).toBeVisible();

    await page.reload();

    await expect(page.getByRole('heading', { name: SAMPLE_PLAN.title })).toBeVisible();
    await page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name: /Brief/ }).click();
    await expect(page.getByLabel('Anthropic API key', { exact: true })).toHaveValue('');
  });

  test('Start over clears the session for good', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Load sample plan' }).click();
    await expect(page.getByRole('heading', { name: SAMPLE_PLAN.title })).toBeVisible();

    await page.getByRole('button', { name: 'Start over' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Brief');
    await expect(
      page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name: /Plan/ }),
    ).toBeDisabled();

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Brief');
  });
});
