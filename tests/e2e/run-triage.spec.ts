import { expect, test, type Page } from '@playwright/test';
import { SAMPLE_SPEC } from '../../src/fixtures/sample-spec.js';
import { mockAnthropic } from './support/anthropic-mock.js';
import { mockGitHub } from './support/github-mock.js';

const FAILURES = [
  {
    file: 'checkout-journey.spec.ts',
    line: 12,
    test: 'Checkout journey › S1 customer completes the demo checkout',
    message: 'Error: expect(locator).toBeFocused() failed\n    Received: inactive',
  },
  {
    file: 'checkout-journey.spec.ts',
    line: 31,
    test: 'Checkout journey › S2 checkout API unavailable shows a clear failure',
    message: 'Error: expect(received).toHaveText(expected)\n    Received: "Processing…"',
  },
];

async function walkToRun(page: Page) {
  await page.goto('/');
  await page.getByLabel('Anthropic API key', { exact: true }).fill('sk-ant-test-key');
  await page.getByRole('button', { name: 'Load sample plan' }).click();
  await page.getByRole('button', { name: 'Load sample spec' }).click();
  await page.getByRole('button', { name: 'Continue to run' }).click();
  await page.getByLabel('Fine-grained token').fill('github_pat_test');
  await page.getByRole('button', { name: 'Dispatch workflow' }).click();
}

test.describe('Triaging a failed run', () => {
  test('failures are reviewed one by one, then only test defects go back to the model', async ({ page }) => {
    const requests = await mockAnthropic(page, () => ({
      kind: 'message',
      text: JSON.stringify(SAMPLE_SPEC),
    }));
    await mockGitHub(page, { conclusion: 'failure', failures: FAILURES });

    await walkToRun(page);

    await expect(page.getByTestId('run-status')).toHaveText('completed · failure', { timeout: 20_000 });
    await expect(page.getByText('4.3 · Triage · 2 failing tests')).toBeVisible();
    await expect(page.locator('.failure .name').first()).toHaveText(
      'Checkout journey › S1 customer completes the demo checkout',
    );
    await expect(
      page.getByLabel('Failure output for Checkout journey › S1 customer completes the demo checkout'),
    ).toContainText('Received: inactive');

    // Nothing can be acted on before a human has decided what each failure means.
    await expect(page.getByRole('button', { name: /^Regenerate spec/ })).toBeDisabled();
    await expect(page.getByRole('button', { name: /^Download bug report/ })).toBeDisabled();
    await expect(page.getByText('2 still unreviewed')).toBeVisible();

    const first = page.locator('.failure').first();
    const second = page.locator('.failure').nth(1);
    await first.getByRole('radio', { name: 'The application is wrong' }).check();
    await second.getByRole('radio', { name: 'The test is wrong' }).check();

    await expect(page.getByRole('button', { name: 'Regenerate spec with 1 test fix' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Download bug report (1)' })).toBeEnabled();

    await page.getByRole('button', { name: 'Regenerate spec with 1 test fix' }).click();

    await expect(page.getByTestId('lint-verdict')).toHaveText('passed');
    expect(requests).toHaveLength(1);
    const prompt = String(requests[0].messages[0].content);
    expect(prompt).toContain('judged the TEST to be at fault');
    expect(prompt).toContain('S2 checkout API unavailable shows a clear failure');
    // The failure the reviewer blamed on the application must not be sent as a test fix.
    expect(prompt).not.toContain('S1 customer completes the demo checkout');
  });

  test('application defects download as a bug report carrying the scenario and the evidence', async ({
    page,
  }) => {
    await mockAnthropic(page, () => ({ kind: 'message', text: '{}' }));
    await mockGitHub(page, { conclusion: 'failure', failures: FAILURES });

    await walkToRun(page);
    await expect(page.getByTestId('run-status')).toHaveText('completed · failure', { timeout: 20_000 });
    await page.locator('.failure').first().getByRole('radio', { name: 'The application is wrong' }).check();

    const download = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download bug report (1)' }).click(),
    ]).then(([event]) => event);

    expect(download.suggestedFilename()).toBe('defects.md');
    const stream = await download.createReadStream();
    const report = await new Promise<string>((resolve, reject) => {
      let text = '';
      stream.on('data', (chunk) => (text += chunk));
      stream.on('end', () => resolve(text));
      stream.on('error', reject);
    });

    expect(report).toContain('judged to be application defects');
    expect(report).toContain('**Scenario:** S1 · Customer completes the demo checkout');
    expect(report).toContain('Received: inactive');
    expect(report).toContain('https://github.com/cozgur/testplan-studio/actions/runs/4242');
    // Only the failure blamed on the application is in the report.
    expect(report).not.toContain('S2 checkout API unavailable');
  });

  test('a token without Checks permission explains itself instead of failing silently', async ({ page }) => {
    await mockGitHub(page, { conclusion: 'failure', failures: FAILURES, annotationsForbidden: true });

    await walkToRun(page);

    await expect(page.getByTestId('run-status')).toHaveText('completed · failure', { timeout: 20_000 });
    await expect(page.getByText('Checks: read permission')).toBeVisible();
    await expect(page.getByText('4.3 · Triage')).toHaveCount(0);
  });

  test('a successful run shows no triage at all', async ({ page }) => {
    await mockGitHub(page, { conclusion: 'success' });

    await walkToRun(page);

    await expect(page.getByTestId('run-status')).toHaveText('completed · success', { timeout: 20_000 });
    await expect(page.getByText('4.3 · Triage')).toHaveCount(0);
  });
});
