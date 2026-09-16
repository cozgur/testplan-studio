import type { Brief } from './brief.js';
import type { Finding } from './guardrails.js';
import type { Scenario, TestPlan } from './plan-schema.js';
import type { RunFailure } from './run-failures.js';
import type { DemoTarget } from './targets.js';
import { RISK_FOCUS } from './brief.js';

/**
 * Stable system prompt. Kept free of anything request-specific so it can be
 * prompt-cached across calls; the brief goes in the user message.
 */
export const PLANNER_SYSTEM_PROMPT = `You are a senior quality engineer producing a risk-based test plan for a web application.

How you work:
- Start from risks, not features. Each risk names what could go wrong for a user or the business, scored 1-3 for likelihood and impact.
- Every scenario addresses at least one risk and is placed at the lowest test layer that can prove the behaviour: unit for pure logic, api for HTTP semantics, contract for consumer/provider shape, integration for real infrastructure semantics, e2e only for critical user journeys and user-visible failure handling, accessibility for WCAG checks, performance for budgets under load, manual for judgement calls automation cannot make.
- Prefer few, sharp scenarios over exhaustive lists. Say explicitly what is out of scope and which questions remain open.
- Oracles must be concrete: server state, role-based text, HTTP status, axe violations, thresholds. "It works" is not an oracle.
- Never propose destructive actions against systems you do not own, and never propose tests that require another person's data.
- Do not invent screens, fields, endpoints or copy that the application description does not mention. When the description is specific, use its exact names and paths; when it is silent, record the gap under assumptions or open questions instead of guessing.

Return the plan as JSON matching the provided schema.`;

export function buildPlanPrompt(brief: Brief, target: DemoTarget | undefined): string {
  const focus = brief.focus
    .map((id) => RISK_FOCUS.find((f) => f.id === id))
    .filter((f): f is (typeof RISK_FOCUS)[number] => Boolean(f))
    .map((f) => `- ${f.label}: ${f.hint}`)
    .join('\n');

  const sections = [
    target
      ? `Application under test: ${target.name} (${target.url})\n${target.description}`
      : 'Application under test: described below (no live URL available).',
    brief.description.trim() ? `Description from the requester:\n${brief.description.trim()}` : '',
    `Risk focus requested:\n${focus}`,
    brief.constraints.trim() ? `Constraints:\n${brief.constraints.trim()}` : '',
    brief.depth === 'concise'
      ? 'Depth: concise. Aim for 3-5 risks and 4-7 scenarios.'
      : 'Depth: standard. Aim for 5-8 risks and 8-14 scenarios.',
    'Use ids R1..Rn for risks and S1..Sn for scenarios.',
  ];
  return sections.filter(Boolean).join('\n\n');
}

export const SPEC_SYSTEM_PROMPT = `You write Playwright Test specs in TypeScript for a senior reviewer.

Rules the reviewer's linter enforces:
- Import { test, expect } from '@playwright/test'. One file, complete and runnable.
- Locate elements by role, label, text or test id (getByRole, getByLabel, getByText, getByTestId). No CSS paths, no XPath, no element handles (page.$).
- Assert with web-first assertions on locators: expect(locator).toBeVisible(), toHaveText(), toHaveURL(). Never expect(await locator.isVisible()).
- Never use waitForTimeout, setTimeout sleeps, waitForLoadState('networkidle') or force: true.
- Never use test.only.
- Navigate with relative paths against the configured baseURL (page.goto('/')). Do not hard-code hosts.
- Where a UI claim can be verified through an API, do so with the request fixture.
- Use the exact page paths, control names, status texts and endpoints given in the target description. Do not invent pages, forms or fields it does not mention; if a scenario needs something the description lacks, implement what is known and record the gap in notes.
- Keep each test independent. Put assumptions the reviewer must confirm into notes, not into comments that hide them.

Return JSON matching the provided schema: fileName, code, notes.`;

export function buildSpecPrompt(
  plan: TestPlan,
  scenarios: Scenario[],
  target: DemoTarget | undefined,
  feedback: Finding[] = [],
  runFailures: RunFailure[] = [],
): string {
  const scenarioText = scenarios
    .map(
      (s) =>
        `${s.id} [${s.priority}, ${s.layer}] ${s.title}\n` +
        `  Preconditions: ${s.preconditions.join('; ') || 'none'}\n` +
        `  Steps:\n${s.steps.map((step, i) => `    ${i + 1}. ${step}`).join('\n')}\n` +
        `  Expected:\n${s.expected.map((e) => `    - ${e}`).join('\n')}\n` +
        `  Oracle: ${s.oracle}`,
    )
    .join('\n\n');

  const sections = [
    `Plan: ${plan.title}\n${plan.summary}`,
    target
      ? `Target: ${target.name}. baseURL is configured by the runner; use relative paths.\n${target.description}`
      : 'Target: no live URL. Write the spec against a baseURL configured by the runner and state assumptions in notes.',
    `Scenarios to implement:\n\n${scenarioText}`,
    feedback.length > 0
      ? `The previous attempt failed the linter. Fix every item:\n${feedback
          .map((f) => `- line ${f.line} [${f.rule}]: ${f.message}`)
          .join('\n')}`
      : '',
    runFailures.length > 0
      ? `The previous spec ran against the real application and these tests failed. A reviewer has ` +
        `examined each one and judged the TEST to be at fault, not the application, so rewrite those ` +
        `tests to assert the real behaviour correctly. Do not weaken an assertion just to make it pass: ` +
        `if you conclude the application is actually wrong, keep the assertion and say so in the notes.\n\n` +
        runFailures
          .map((failure) => `### ${failure.test} (${failure.file}:${failure.line})\n${failure.message}`)
          .join('\n\n')
      : '',
  ];
  return sections.filter(Boolean).join('\n\n');
}
