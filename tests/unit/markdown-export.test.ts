import { describe, expect, test } from 'vitest';
import { planToMarkdown } from '../../src/domain/markdown-export.js';
import { SAMPLE_PLAN } from '../../src/fixtures/sample-plan.js';

describe('planToMarkdown', () => {
  const markdown = planToMarkdown(SAMPLE_PLAN);

  test('starts with the title and includes every section', () => {
    expect(markdown.startsWith(`# ${SAMPLE_PLAN.title}\n`)).toBe(true);
    for (const heading of [
      '## Assumptions',
      '## Risk register',
      '## Scenarios',
      '## Out of scope',
      '## Open questions',
    ]) {
      expect(markdown).toContain(heading);
    }
  });

  test('renders one table row per risk with the computed score and level', () => {
    expect(markdown).toContain('| R1 | functional |');
    expect(markdown).toContain('| 2 | 3 | 6 | high |');
  });

  test('escapes pipes and newlines inside table cells', () => {
    const plan = {
      ...SAMPLE_PLAN,
      risks: [{ ...SAMPLE_PLAN.risks[0], description: 'a | b\nc' }],
      scenarios: [{ ...SAMPLE_PLAN.scenarios[0], riskIds: ['R1'] }],
    };
    expect(planToMarkdown(plan)).toContain('| a \\| b c |');
  });

  test('omits empty optional sections', () => {
    const plan = { ...SAMPLE_PLAN, assumptions: [], outOfScope: [], openQuestions: [] };
    const out = planToMarkdown(plan);
    expect(out).not.toContain('## Assumptions');
    expect(out).not.toContain('## Out of scope');
    expect(out.endsWith('\n')).toBe(true);
  });
});
