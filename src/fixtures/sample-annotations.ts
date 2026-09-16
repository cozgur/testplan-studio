import type { CheckAnnotation } from '../domain/run-failures.js';

/**
 * Verbatim check-run annotations from a real failing runner workflow
 * (cozgur/testplan-studio run 34955905098, job 104337782458), including the
 * workflow-level noise the parser has to ignore. Used as a fixture so the parser is
 * tested against GitHub's actual shape rather than an assumed one.
 */
export const SAMPLE_ANNOTATIONS: CheckAnnotation[] = [
  {
    annotation_level: 'failure',
    path: '.github',
    start_line: 92,
    title: '',
    message: 'Process completed with exit code 1.',
  },
  {
    annotation_level: 'notice',
    path: '.github',
    start_line: 89,
    title: '🎭 Playwright Run Summary',
    message:
      '  1 failed\n    [chromium] › runner/generated/quality-lab-checkout.spec.ts:148:3 › Modern Quality Engineering Lab — accessibility › S12 keyboard-only journey: Tab to the button, activate with Enter and Space \n  6 passed (13.6s)',
  },
  {
    annotation_level: 'failure',
    path: 'runner/generated/quality-lab-checkout.spec.ts',
    start_line: 169,
    // GitHub truncates the title at 160 characters; the message keeps the full one.
    title:
      '[chromium] › runner/generated/quality-lab-checkout.spec.ts:148:3 › Modern Quality Engineering Lab — accessibility › S12 keyboard-only journey: Tab to the button',
    message: `  1) [chromium] › runner/generated/quality-lab-checkout.spec.ts:148:3 › Modern Quality Engineering Lab — accessibility › S12 keyboard-only journey: Tab to the button, activate with Enter and Space 
    Error: expect(locator).toBeFocused() failed

    Locator:  getByRole('button', { name: 'Run demo checkout' })
    Expected: focused
    Received: inactive
    Timeout:  5000ms

      167 |     await page.keyboard.press('Enter');
      168 |     await expect(status(page)).toHaveText(CONFIRMED);
    > 169 |     await expect(checkoutButton(page)).toBeFocused();
          |                                        ^
      170 |     await expect(checkoutButton(page)).toBeEnabled();`,
  },
];
