import { describe, expect, test } from 'vitest';
import type { StorageLike } from '../../src/persistence.js';
import type { State } from '../../src/state.js';
import { SAMPLE_PLAN } from '../../src/fixtures/sample-plan.js';
import { SAMPLE_SPEC } from '../../src/fixtures/sample-spec.js';
import { clearSession, loadSession, saveSession, SESSION_KEY, snapshot } from '../../src/persistence.js';
import { initialState, reducer } from '../../src/state.js';

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function stateWithSpec(): State {
  const withPlan = reducer(
    { ...initialState, apiKey: 'sk-ant-secret', brief: { ...initialState.brief, targetId: 'lab' } },
    { type: 'planReady', plan: SAMPLE_PLAN, source: 'sample' },
  );
  return reducer(withPlan, { type: 'specReady', spec: SAMPLE_SPEC });
}

describe('session persistence', () => {
  test('round-trips artefacts, recomputes lint and never stores the API key', () => {
    const storage = memoryStorage();
    const state = stateWithSpec();

    saveSession(state, storage);
    expect(storage.map.get(SESSION_KEY)).not.toContain('sk-ant-secret');

    const restored = loadSession(storage);
    expect(restored).toMatchObject({
      step: 'specs',
      plan: SAMPLE_PLAN,
      planSource: 'sample',
      spec: SAMPLE_SPEC,
      selected: state.selected,
      apiKey: '',
      busy: null,
      error: null,
    });
    expect(restored?.lint?.passed).toBe(true);
    expect(restored?.run).toEqual(initialState.run);
  });

  test('snapshot excludes transient fields', () => {
    const keys = Object.keys(snapshot(stateWithSpec())).sort();
    expect(keys).toEqual(['brief', 'model', 'plan', 'planSource', 'selected', 'spec', 'step', 'version']);
  });

  test.each([
    ['corrupt JSON', '{not json'],
    ['wrong shape', JSON.stringify({ version: 1, step: 'plan' })],
    ['unknown model', JSON.stringify({ ...snapshot(stateWithSpec()), model: 'gpt-x' })],
    [
      'plan that breaks the rules',
      JSON.stringify({ ...snapshot(stateWithSpec()), plan: { ...SAMPLE_PLAN, risks: [] } }),
    ],
    ['plan without a source', JSON.stringify({ ...snapshot(stateWithSpec()), planSource: null })],
  ])('drops a stored session with %s', (_label, raw) => {
    const storage = memoryStorage();
    storage.setItem(SESSION_KEY, raw);
    expect(loadSession(storage)).toBeNull();
  });

  test('returns null when nothing is stored or storage is unavailable', () => {
    expect(loadSession(memoryStorage())).toBeNull();
    expect(loadSession(null)).toBeNull();
  });

  test('clamps the step to what the restored artefacts allow', () => {
    const storage = memoryStorage();
    const flaky = {
      ...SAMPLE_SPEC,
      code: SAMPLE_SPEC.code.replace(
        "await page.goto('/');",
        "await page.goto('/'); await page.waitForTimeout(1);",
      ),
    };
    storage.setItem(SESSION_KEY, JSON.stringify({ ...snapshot(stateWithSpec()), step: 'run', spec: flaky }));
    expect(loadSession(storage)?.step).toBe('specs');

    storage.setItem(
      SESSION_KEY,
      JSON.stringify({
        ...snapshot(stateWithSpec()),
        step: 'plan',
        plan: null,
        spec: null,
        planSource: null,
        selected: [],
      }),
    );
    expect(loadSession(storage)?.step).toBe('brief');
  });

  test('filters selected ids that no longer exist in the plan', () => {
    const storage = memoryStorage();
    storage.setItem(SESSION_KEY, JSON.stringify({ ...snapshot(stateWithSpec()), selected: ['S1', 'S99'] }));
    expect(loadSession(storage)?.selected).toEqual(['S1']);
  });

  test('a throwing storage never breaks save, load or clear', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => saveSession(stateWithSpec(), broken)).not.toThrow();
    expect(loadSession(broken)).toBeNull();
    expect(() => clearSession(broken)).not.toThrow();
  });

  test('clearSession removes the entry', () => {
    const storage = memoryStorage();
    saveSession(stateWithSpec(), storage);
    clearSession(storage);
    expect(storage.map.has(SESSION_KEY)).toBe(false);
  });
});
