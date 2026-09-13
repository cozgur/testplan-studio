import { expect, test } from '@playwright/test';
import { SAMPLE_PLAN } from '../../src/fixtures/sample-plan.js';
import { mockAnthropic } from './support/anthropic-mock.js';

test.describe('Failure paths are explained to the user', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('API key', { exact: true }).fill('sk-ant-test-key');
    await page.getByRole('radio', { name: /TodoMVC/ }).check();
  });

  test('a rejected API key', async ({ page }) => {
    await mockAnthropic(page, () => ({
      kind: 'error',
      status: 401,
      type: 'authentication_error',
      message: 'invalid x-api-key',
    }));
    await page.getByRole('button', { name: 'Generate plan' }).click();
    await expect(page.getByRole('alert')).toContainText('API key was rejected');
    await expect(page.getByRole('button', { name: 'Generate plan' })).toBeEnabled();
  });

  test('a refusal carries the explanation through', async ({ page }) => {
    await mockAnthropic(page, () => ({
      kind: 'message',
      text: '',
      stopReason: 'refusal',
      explanation: 'This request was declined by a safety classifier.',
    }));
    await page.getByRole('button', { name: 'Generate plan' }).click();
    await expect(page.getByRole('alert')).toContainText('declined by a safety classifier');
  });

  test('a truncated response suggests a smaller plan', async ({ page }) => {
    await mockAnthropic(page, () => ({
      kind: 'message',
      text: '{"title": "cut off',
      stopReason: 'max_tokens',
    }));
    await page.getByRole('button', { name: 'Generate plan' }).click();
    await expect(page.getByRole('alert')).toContainText('token limit');
  });

  test('output that violates the plan rules is reported, not rendered', async ({ page }) => {
    await mockAnthropic(page, () => ({
      kind: 'message',
      text: JSON.stringify({ ...SAMPLE_PLAN, risks: [] }),
    }));
    await page.getByRole('button', { name: 'Generate plan' }).click();
    await expect(page.getByRole('alert')).toContainText('plan has no risks');
    await expect(page.getByRole('heading', { name: SAMPLE_PLAN.title })).toHaveCount(0);
  });
});
