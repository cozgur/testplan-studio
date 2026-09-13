import { describe, expect, test } from 'vitest';
import { EMPTY_BRIEF } from '../../src/domain/brief.js';
import {
  buildPlanPrompt,
  buildSpecPrompt,
  PLANNER_SYSTEM_PROMPT,
  SPEC_SYSTEM_PROMPT,
} from '../../src/domain/prompts.js';
import { findTarget } from '../../src/domain/targets.js';
import { SAMPLE_PLAN } from '../../src/fixtures/sample-plan.js';

describe('buildPlanPrompt', () => {
  test('includes the target, focus areas and depth for a demo target', () => {
    const prompt = buildPlanPrompt({ ...EMPTY_BRIEF, targetId: 'lab', depth: 'concise' }, findTarget('lab'));
    expect(prompt).toContain('Modern Quality Engineering Lab');
    expect(prompt).toContain('- Functional journeys');
    expect(prompt).toContain('- Accessibility');
    expect(prompt).toContain('Depth: concise');
    expect(prompt).not.toContain('Constraints:');
  });

  test('describes a no-URL application and passes constraints through', () => {
    const prompt = buildPlanPrompt(
      { ...EMPTY_BRIEF, description: 'An internal invoicing tool.', constraints: 'No destructive actions' },
      undefined,
    );
    expect(prompt).toContain('no live URL available');
    expect(prompt).toContain('An internal invoicing tool.');
    expect(prompt).toContain('Constraints:\nNo destructive actions');
    expect(prompt).toContain('Depth: standard');
  });

  test('the system prompt is request-independent so it can be cached', () => {
    expect(PLANNER_SYSTEM_PROMPT).not.toMatch(/\{\{|\$\{/);
    expect(SPEC_SYSTEM_PROMPT).toContain('getByRole');
  });
});

describe('buildSpecPrompt', () => {
  const scenarios = SAMPLE_PLAN.scenarios.slice(0, 2);

  test('renders each scenario with steps, expectations and oracle', () => {
    const prompt = buildSpecPrompt(SAMPLE_PLAN, scenarios, findTarget('lab'));
    expect(prompt).toContain('S1 [P0, e2e]');
    expect(prompt).toContain('    1. Open the home page');
    expect(prompt).toContain('Oracle: Server state via the API');
    expect(prompt).toContain('use relative paths');
    expect(prompt).not.toContain('failed the linter');
  });

  test('appends lint feedback when regenerating', () => {
    const prompt = buildSpecPrompt(SAMPLE_PLAN, scenarios, undefined, [
      { rule: 'no-wait-for-timeout', severity: 'error', line: 7, message: 'Fixed sleeps hide timing bugs.' },
    ]);
    expect(prompt).toContain('failed the linter');
    expect(prompt).toContain('- line 7 [no-wait-for-timeout]: Fixed sleeps hide timing bugs.');
    expect(prompt).toContain('no live URL');
  });
});
