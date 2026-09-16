import type { TestPlan } from './plan-schema.js';
import type { RunFailure } from './run-failures.js';
import type { DemoTarget } from './targets.js';

/**
 * Failures a human judged to be application defects become a bug report, not a
 * regenerated test. The report carries the evidence a developer needs: which scenario
 * the test came from, what the runner saw, and how to reproduce it.
 */
export function failuresToBugReport(
  plan: TestPlan,
  target: DemoTarget | undefined,
  failures: readonly RunFailure[],
  runUrl?: string,
): string {
  const lines: string[] = [];
  lines.push(`# Defects found by ${plan.title}`, '');
  lines.push(
    `${failures.length} failing ${failures.length === 1 ? 'test was' : 'tests were'} reviewed and judged to be application defects rather than test defects.`,
    '',
  );
  if (target) lines.push(`- **Target:** ${target.name} (${target.url})`);
  if (runUrl) lines.push(`- **Runner evidence:** ${runUrl}`);
  lines.push('', '---', '');

  failures.forEach((failure, index) => {
    lines.push(`## ${index + 1}. ${failure.test}`, '');
    lines.push(`- **Test:** \`${failure.file}:${failure.line}\``);

    const scenario = matchScenario(plan, failure);
    if (scenario) {
      lines.push(
        `- **Scenario:** ${scenario.id} · ${scenario.title} (${scenario.priority}, ${scenario.layer})`,
      );
      const risks = plan.risks.filter((risk) => scenario.riskIds.includes(risk.id));
      if (risks.length > 0) {
        lines.push(`- **Risks:** ${risks.map((risk) => `${risk.id} ${risk.description}`).join(' · ')}`);
      }
      lines.push(
        '',
        '**Steps to reproduce**',
        '',
        ...scenario.steps.map((step, i) => `${i + 1}. ${step}`),
        '',
      );
      lines.push('**Expected**', '', ...scenario.expected.map((item) => `- ${item}`), '');
    } else {
      lines.push('');
    }

    lines.push('**What the runner saw**', '', '```', failure.message, '```', '');
  });

  return lines.join('\n').trimEnd() + '\n';
}

/** Specs are asked to prefix each test with its scenario id, so `S7 …` finds the scenario. */
function matchScenario(plan: TestPlan, failure: RunFailure) {
  return plan.scenarios.find((scenario) => new RegExp(`\\b${scenario.id}\\b`).test(failure.test));
}
