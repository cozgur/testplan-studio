import { describe, expect, test } from 'vitest';
import { parseGeneratedSpec } from '../../src/domain/spec-schema.js';
import { SAMPLE_SPEC } from '../../src/fixtures/sample-spec.js';

describe('parseGeneratedSpec', () => {
  test('accepts the sample spec', () => {
    expect(parseGeneratedSpec(JSON.stringify(SAMPLE_SPEC))).toEqual(SAMPLE_SPEC);
  });

  test.each(['Checkout.spec.ts', 'checkout.test.ts', 'checkout spec.ts', '../evil.spec.ts'])(
    'rejects file name %s',
    (fileName) => {
      expect(() => parseGeneratedSpec(JSON.stringify({ ...SAMPLE_SPEC, fileName }))).toThrow(/kebab-case/);
    },
  );

  test('rejects empty code', () => {
    expect(() => parseGeneratedSpec(JSON.stringify({ ...SAMPLE_SPEC, code: '   ' }))).toThrow(
      /code is empty/,
    );
  });

  test('rejects a missing notes array', () => {
    const { notes: _notes, ...withoutNotes } = SAMPLE_SPEC;
    expect(() => parseGeneratedSpec(JSON.stringify(withoutNotes))).toThrow(/notes/);
  });
});
