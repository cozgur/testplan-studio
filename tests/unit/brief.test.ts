import { describe, expect, test } from 'vitest';
import { EMPTY_BRIEF, validateBrief } from '../../src/domain/brief.js';

describe('validateBrief', () => {
  test('a demo target needs no description', () => {
    expect(validateBrief({ ...EMPTY_BRIEF, targetId: 'lab' })).toEqual([]);
  });

  test('a described-only brief needs a real description', () => {
    expect(validateBrief({ ...EMPTY_BRIEF, description: 'short' })).toEqual([
      'Describe the application in at least 30 characters, or pick a demo target.',
    ]);
  });

  test('requires at least one risk focus', () => {
    expect(validateBrief({ ...EMPTY_BRIEF, targetId: 'lab', focus: [] })).toEqual([
      'Choose at least one risk focus.',
    ]);
  });

  test('caps the description length', () => {
    expect(validateBrief({ ...EMPTY_BRIEF, targetId: 'lab', description: 'x'.repeat(4001) })).toEqual([
      'Keep the description under 4000 characters.',
    ]);
  });
});
