import { describe, expect, test } from 'vitest';
import { DEMO_TARGETS, findTarget, isAllowlistedUrl } from '../../src/domain/targets.js';

describe('demo targets', () => {
  test('every target has a unique id and an http(s) url', () => {
    const ids = DEMO_TARGETS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const target of DEMO_TARGETS) expect(target.url).toMatch(/^https?:\/\//);
  });

  test('only the lab boots locally', () => {
    expect(DEMO_TARGETS.filter((t) => t.bootsLocally).map((t) => t.id)).toEqual(['lab']);
  });

  test('findTarget handles unknown and null ids', () => {
    expect(findTarget('lab')?.name).toMatch(/Quality Engineering Lab/);
    expect(findTarget('nope')).toBeUndefined();
    expect(findTarget(null)).toBeUndefined();
  });

  test('isAllowlistedUrl ignores case and trailing slashes but not other hosts', () => {
    expect(isAllowlistedUrl('https://www.saucedemo.com/')).toBe(true);
    expect(isAllowlistedUrl('HTTPS://WWW.SAUCEDEMO.COM')).toBe(true);
    expect(isAllowlistedUrl('https://www.saucedemo.com.evil.example')).toBe(false);
    expect(isAllowlistedUrl('https://example.com')).toBe(false);
  });
});
