import type { GeneratedSpec } from '../domain/spec-schema.js';

/** A reviewed spec for the sample plan's browser scenarios. Passes the guardrail lint. */
export const SAMPLE_SPEC: GeneratedSpec = {
  fileName: 'checkout-journey.spec.ts',
  code: `import { expect, test } from '@playwright/test';

test.describe('Checkout journey', () => {
  test('S1 customer completes the demo checkout and the order exists server-side', async ({ page, request }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Run demo checkout' }).click();

    const status = page.getByRole('status');
    await expect(status).toContainText('Order confirmed:');

    const orderId = (await status.textContent())?.replace('Order confirmed:', '').trim();
    expect(orderId).toBeTruthy();

    const order = await request.get(\`/api/orders/\${orderId}\`);
    expect(order.ok()).toBeTruthy();
    await expect(order.json()).resolves.toMatchObject({ productId: 'quality-lab', status: 'confirmed' });
  });

  test('S2 checkout API unavailable shows a clear failure and re-enables the button', async ({ page }) => {
    await page.route('**/api/checkout', (route) =>
      route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'unavailable' }) }),
    );
    await page.goto('/');
    await page.getByRole('button', { name: 'Run demo checkout' }).click();

    await expect(page.getByRole('status')).toHaveText('Checkout failed');
    await expect(page.getByRole('button', { name: 'Run demo checkout' })).toBeEnabled();
  });

  test('S3 non-JSON gateway error page is handled without a stuck state', async ({ page }) => {
    await page.route('**/api/checkout', (route) =>
      route.fulfill({ status: 502, contentType: 'text/html', body: '<h1>Bad gateway</h1>' }),
    );
    await page.goto('/');
    await page.getByRole('button', { name: 'Run demo checkout' }).click();

    await expect(page.getByRole('status')).toHaveText('Checkout failed');
  });
});
`,
  notes: [
    'Assumes the order id can be parsed from the status text after "Order confirmed:".',
    'S5 (axe scan) is omitted here because it needs @axe-core/playwright in the runner; the runner config includes it if you add the import.',
  ],
};
