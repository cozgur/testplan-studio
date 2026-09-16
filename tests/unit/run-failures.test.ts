import { describe, expect, test } from 'vitest';
import type { TriageMap } from '../../src/domain/run-failures.js';
import { SAMPLE_ANNOTATIONS } from '../../src/fixtures/sample-annotations.js';
import { countVerdicts, failuresWith, parseAnnotations, testNameOf } from '../../src/domain/run-failures.js';

describe('parseAnnotations', () => {
  const failures = parseAnnotations(SAMPLE_ANNOTATIONS);

  test('keeps only spec-file failures, dropping workflow noise and notices', () => {
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({
      id: 'runner/generated/quality-lab-checkout.spec.ts:169',
      file: 'runner/generated/quality-lab-checkout.spec.ts',
      line: 169,
    });
  });

  test('takes the untruncated test name from the message, not the capped title', () => {
    // The annotation title stops at "Tab to the button"; the message has the full name.
    expect(failures[0].test).toBe(
      'Modern Quality Engineering Lab — accessibility › S12 keyboard-only journey: Tab to the button, activate with Enter and Space',
    );
  });

  test('strips the numbered header and keeps the assertion and code excerpt', () => {
    expect(failures[0].message.startsWith('Error: expect(locator).toBeFocused() failed')).toBe(true);
    expect(failures[0].message).toContain("Locator:  getByRole('button', { name: 'Run demo checkout' })");
    expect(failures[0].message).toContain('> 169 |');
    expect(failures[0].message).not.toContain('1) [chromium]');
  });

  test('de-duplicates retries of the same assertion', () => {
    const retried = [...SAMPLE_ANNOTATIONS, SAMPLE_ANNOTATIONS[2]];
    expect(parseAnnotations(retried)).toHaveLength(1);
  });

  test('falls back to the annotation title when the message has no header', () => {
    const [failure] = parseAnnotations([
      {
        annotation_level: 'failure',
        path: 'a.spec.ts',
        start_line: 4,
        title: '[chromium] › a.spec.ts:1:1 › Suite › S1 does a thing',
        message: 'Error: boom',
      },
    ]);
    expect(failure).toMatchObject({ test: 'Suite › S1 does a thing', message: 'Error: boom', line: 4 });
  });

  test('returns nothing when no test failed', () => {
    expect(parseAnnotations([SAMPLE_ANNOTATIONS[0], SAMPLE_ANNOTATIONS[1]])).toEqual([]);
    expect(parseAnnotations([])).toEqual([]);
  });
});

describe('testNameOf', () => {
  test.each([
    ['[chromium] › file.spec.ts:1:1 › Suite › Test', 'Suite › Test'],
    ['[chromium] › tests/e2e/a.spec.ts:12:3 › Test only', 'Test only'],
    ['Plain title', 'Plain title'],
  ])('%s -> %s', (title, expected) => {
    expect(testNameOf(title)).toBe(expected);
  });
});

describe('verdict bookkeeping', () => {
  const failures = [
    { id: 'a', test: 'A', file: 'a.spec.ts', line: 1, message: '' },
    { id: 'b', test: 'B', file: 'a.spec.ts', line: 2, message: '' },
    { id: 'c', test: 'C', file: 'a.spec.ts', line: 3, message: '' },
  ];
  const triage: TriageMap = { a: 'test', b: 'app' };

  test('counts each verdict, treating unknown ids as unreviewed', () => {
    expect(countVerdicts(failures, triage)).toEqual({ test: 1, app: 1, unreviewed: 1 });
  });

  test('selects failures by verdict', () => {
    expect(failuresWith(failures, triage, 'test').map((f) => f.id)).toEqual(['a']);
    expect(failuresWith(failures, triage, 'app').map((f) => f.id)).toEqual(['b']);
    expect(failuresWith(failures, triage, 'unreviewed').map((f) => f.id)).toEqual(['c']);
  });
});
