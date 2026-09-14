import { expect, test } from '@playwright/test';
import { mockGitHub } from './support/github-mock.js';

test.describe('Dispatching the runner workflow', () => {
  test('a dispatched run is followed to completion and linked', async ({ page }) => {
    const dispatches = await mockGitHub(page, { conclusion: 'success' });

    await page.goto('/');
    await page.getByRole('button', { name: 'Load sample plan' }).click();
    await page.getByRole('button', { name: 'Load sample spec' }).click();
    await page.getByRole('button', { name: 'Continue to run' }).click();

    await page.getByLabel('Fine-grained token').fill('github_pat_test');
    await page.getByRole('button', { name: 'Dispatch workflow' }).click();

    await expect(page.getByTestId('run-status')).toHaveText('completed · success', { timeout: 20_000 });
    await expect(page.getByRole('link', { name: 'Open run #4242' })).toHaveAttribute(
      'href',
      'https://github.com/cozgur/testplan-studio/actions/runs/4242',
    );

    expect(dispatches).toHaveLength(1);
    expect(dispatches[0]).toMatchObject({
      ref: 'main',
      inputs: { target: 'lab', spec_file_name: 'checkout-journey.spec.ts' },
    });
  });

  test('a failed run is shown as failed', async ({ page }) => {
    await mockGitHub(page, { conclusion: 'failure' });

    await page.goto('/');
    await page.getByRole('button', { name: 'Load sample plan' }).click();
    await page.getByRole('button', { name: 'Load sample spec' }).click();
    await page.getByRole('button', { name: 'Continue to run' }).click();
    await page.getByLabel('Fine-grained token').fill('github_pat_test');
    await page.getByRole('button', { name: 'Dispatch workflow' }).click();

    await expect(page.getByTestId('run-status')).toHaveText('completed · failure', { timeout: 20_000 });
    await expect(page.getByRole('alert')).toContainText('conclusion "failure"');
  });
});
