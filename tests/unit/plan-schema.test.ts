import { describe, expect, test } from 'vitest';
import {
  findPlanProblems,
  parsePlan,
  PlanValidationError,
  riskLevel,
  riskScore,
} from '../../src/domain/plan-schema.js';
import { SAMPLE_PLAN } from '../../src/fixtures/sample-plan.js';

describe('parsePlan', () => {
  test('accepts the sample plan round-tripped through JSON', () => {
    expect(parsePlan(JSON.stringify(SAMPLE_PLAN))).toEqual(SAMPLE_PLAN);
  });

  test('tolerates a fenced JSON block', () => {
    const fenced = '```json\n' + JSON.stringify(SAMPLE_PLAN) + '\n```';
    expect(parsePlan(fenced).title).toBe(SAMPLE_PLAN.title);
  });

  test('rejects text that is not JSON', () => {
    expect(() => parsePlan('Sure! Here is your plan:')).toThrow(PlanValidationError);
  });

  test('reports schema problems with their path', () => {
    const broken = { ...SAMPLE_PLAN, risks: [{ ...SAMPLE_PLAN.risks[0], area: 'vibes' }] };
    expect(() => parsePlan(JSON.stringify(broken))).toThrow(/risks\.0\.area/);
  });

  test('rejects scenarios that reference unknown risks', () => {
    const broken = {
      ...SAMPLE_PLAN,
      scenarios: [{ ...SAMPLE_PLAN.scenarios[0], riskIds: ['R99'] }],
    };
    expect(() => parsePlan(JSON.stringify(broken))).toThrow(/unknown risk R99/);
  });
});

describe('findPlanProblems', () => {
  test('returns no problems for the sample plan', () => {
    expect(findPlanProblems(SAMPLE_PLAN)).toEqual([]);
  });

  test.each([
    ['likelihood 0', { likelihood: 0 }, /likelihood must be 1-3/],
    ['likelihood 4', { likelihood: 4 }, /likelihood must be 1-3/],
    ['impact 0', { impact: 0 }, /impact must be 1-3/],
  ])('flags %s', (_label, patch, expected) => {
    const plan = {
      ...SAMPLE_PLAN,
      risks: [{ ...SAMPLE_PLAN.risks[0], ...patch }, ...SAMPLE_PLAN.risks.slice(1)],
    };
    expect(findPlanProblems(plan).join('\n')).toMatch(expected);
  });

  test('flags duplicate ids and empty steps', () => {
    const plan = {
      ...SAMPLE_PLAN,
      risks: [SAMPLE_PLAN.risks[0], SAMPLE_PLAN.risks[0]],
      scenarios: [{ ...SAMPLE_PLAN.scenarios[0], riskIds: ['R1'], steps: [], expected: [] }],
    };
    const problems = findPlanProblems(plan);
    expect(problems).toContain('duplicate risk id R1');
    expect(problems).toContain('S1: no steps');
    expect(problems).toContain('S1: no expected results');
  });

  test('flags empty plans', () => {
    expect(findPlanProblems({ ...SAMPLE_PLAN, risks: [], scenarios: [] })).toEqual([
      'plan has no risks',
      'plan has no scenarios',
    ]);
  });
});

describe('risk scoring', () => {
  test('score is likelihood times impact', () => {
    expect(riskScore({ likelihood: 2, impact: 3 })).toBe(6);
  });

  test.each([
    [1, 'low'],
    [2, 'low'],
    [3, 'medium'],
    [4, 'medium'],
    [6, 'high'],
    [9, 'high'],
  ])('score %i is %s', (score, level) => {
    expect(riskLevel(score)).toBe(level);
  });
});
