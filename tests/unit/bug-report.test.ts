import { describe, expect, test } from 'vitest';
import { SAMPLE_PLAN } from '../../src/fixtures/sample-plan.js';
import { failuresToBugReport } from '../../src/domain/bug-report.js';
import { findTarget } from '../../src/domain/targets.js';

const failure = {
  id: 'checkout.spec.ts:169',
  test: 'Checkout journey › S1 customer completes the demo checkout',
  file: 'checkout.spec.ts',
  line: 169,
  message: 'Error: expect(locator).toBeFocused() failed',
};

describe('failuresToBugReport', () => {
  const report = failuresToBugReport(SAMPLE_PLAN, findTarget('lab'), [failure], 'https://github.com/run/1');

  test('titles the report after the plan and states the human judgement', () => {
    expect(report.startsWith(`# Defects found by ${SAMPLE_PLAN.title}`)).toBe(true);
    expect(report).toContain('judged to be application defects rather than test defects');
  });

  test('records the target and the runner evidence', () => {
    expect(report).toContain('**Target:** Modern Quality Engineering Lab');
    expect(report).toContain('**Runner evidence:** https://github.com/run/1');
  });

  test('carries the originating scenario, its risks, steps and expectations', () => {
    expect(report).toContain(
      '**Scenario:** S1 · Customer completes the demo checkout and the order exists server-side (P0, e2e)',
    );
    expect(report).toContain('R1 A customer clicks checkout and no order is created');
    expect(report).toContain('1. Open the home page');
    expect(report).toContain('- Status region contains "Order confirmed:"');
  });

  test('quotes what the runner saw in a fenced block', () => {
    expect(report).toContain('**What the runner saw**');
    expect(report).toContain('```\nError: expect(locator).toBeFocused() failed\n```');
  });

  test('still reports a failure whose test name matches no scenario', () => {
    const orphan = { ...failure, test: 'Something unmapped' };
    const out = failuresToBugReport(SAMPLE_PLAN, undefined, [orphan]);
    expect(out).toContain('## 1. Something unmapped');
    expect(out).not.toContain('**Scenario:**');
    expect(out).not.toContain('**Target:**');
    expect(out.endsWith('\n')).toBe(true);
  });

  test('numbers multiple defects', () => {
    const out = failuresToBugReport(SAMPLE_PLAN, findTarget('lab'), [
      failure,
      { ...failure, id: 'x', test: 'S2 other' },
    ]);
    expect(out).toContain('## 1. ');
    expect(out).toContain('## 2. S2 other');
    expect(out).toContain('2 failing tests were reviewed');
  });
});
