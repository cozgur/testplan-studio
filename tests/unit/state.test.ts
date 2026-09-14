import { describe, expect, test } from 'vitest';
import { SAMPLE_PLAN } from '../../src/fixtures/sample-plan.js';
import { SAMPLE_SPEC } from '../../src/fixtures/sample-spec.js';
import { canReach, defaultSelection, initialState, reducer } from '../../src/state.js';

describe('studio state', () => {
  test('defaultSelection picks automatable browser-layer scenarios only', () => {
    expect(defaultSelection(SAMPLE_PLAN)).toEqual(['S1', 'S2', 'S3', 'S5']);
  });

  test('a ready plan advances to the plan step and resets downstream artefacts', () => {
    const withSpec = reducer(initialState, { type: 'specReady', spec: SAMPLE_SPEC });
    const state = reducer(withSpec, { type: 'planReady', plan: SAMPLE_PLAN, source: 'sample' });
    expect(state.step).toBe('plan');
    expect(state.spec).toBeNull();
    expect(state.selected).toEqual(defaultSelection(SAMPLE_PLAN));
  });

  test('a ready spec is linted immediately', () => {
    const state = reducer(initialState, { type: 'specReady', spec: SAMPLE_SPEC });
    expect(state.step).toBe('specs');
    expect(state.lint?.passed).toBe(true);
  });

  test('steps cannot be reached before their artefacts exist', () => {
    expect(canReach(initialState, 'plan')).toBe(false);
    expect(reducer(initialState, { type: 'setStep', step: 'run' }).step).toBe('brief');

    const failing = reducer(initialState, {
      type: 'specReady',
      spec: {
        ...SAMPLE_SPEC,
        code: SAMPLE_SPEC.code.replace("page.goto('/');", "page.goto('/'); await page.waitForTimeout(1);"),
      },
    });
    expect(failing.lint?.passed).toBe(false);
    expect(canReach(failing, 'run')).toBe(false);
  });

  test('progress updates only while busy and failures clear busy', () => {
    expect(reducer(initialState, { type: 'progress', characters: 5 }).busy).toBeNull();
    const busy = reducer(initialState, { type: 'start', kind: 'plan' });
    expect(reducer(busy, { type: 'progress', characters: 5 }).busy).toEqual({ kind: 'plan', characters: 5 });
    const failed = reducer(busy, { type: 'fail', message: 'nope' });
    expect(failed.busy).toBeNull();
    expect(failed.error).toBe('nope');
    const cancelled = reducer(busy, { type: 'cancel' });
    expect(cancelled.busy).toBeNull();
    expect(cancelled.error).toBeNull();
  });

  test('toggleScenario adds and removes ids', () => {
    const state = reducer(initialState, { type: 'planReady', plan: SAMPLE_PLAN, source: 'sample' });
    const off = reducer(state, { type: 'toggleScenario', id: 'S1' });
    expect(off.selected).not.toContain('S1');
    expect(reducer(off, { type: 'toggleScenario', id: 'S1' }).selected).toContain('S1');
  });
});
