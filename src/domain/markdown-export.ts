import type { TestPlan } from './plan-schema.js';
import { riskLevel, riskScore } from './plan-schema.js';

export function planToMarkdown(plan: TestPlan): string {
  const lines: string[] = [];
  lines.push(`# ${plan.title}`, '', plan.summary, '');

  if (plan.assumptions.length) {
    lines.push('## Assumptions', '', ...plan.assumptions.map((a) => `- ${a}`), '');
  }

  lines.push(
    '## Risk register',
    '',
    '| Id | Area | Risk | L | I | Score | Level | Mitigation |',
    '|---|---|---|---|---|---|---|---|',
  );
  for (const r of plan.risks) {
    const score = riskScore(r);
    lines.push(
      `| ${r.id} | ${r.area} | ${escapeCell(r.description)} | ${r.likelihood} | ${r.impact} | ${score} | ${riskLevel(score)} | ${escapeCell(r.mitigation)} |`,
    );
  }
  lines.push('');

  lines.push('## Scenarios', '');
  for (const s of plan.scenarios) {
    lines.push(`### ${s.id} · ${s.title}`, '');
    lines.push(
      `- **Priority:** ${s.priority}  ·  **Layer:** ${s.layer}  ·  **Risks:** ${s.riskIds.join(', ') || '-'}  ·  **Automatable:** ${s.automatable ? 'yes' : 'no'}`,
    );
    if (s.preconditions.length) lines.push(`- **Preconditions:** ${s.preconditions.join('; ')}`);
    lines.push('', '**Steps**', '', ...s.steps.map((step, i) => `${i + 1}. ${step}`), '');
    lines.push('**Expected**', '', ...s.expected.map((e) => `- ${e}`), '');
    lines.push(`**Oracle:** ${s.oracle}`, '');
  }

  if (plan.outOfScope.length) lines.push('## Out of scope', '', ...plan.outOfScope.map((o) => `- ${o}`), '');
  if (plan.openQuestions.length)
    lines.push('## Open questions', '', ...plan.openQuestions.map((q) => `- ${q}`), '');

  return lines.join('\n').trimEnd() + '\n';
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
