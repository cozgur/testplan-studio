import { z } from 'zod';

export const TEST_LAYERS = [
  'unit',
  'api',
  'contract',
  'integration',
  'e2e',
  'accessibility',
  'performance',
  'manual',
] as const;
export const PRIORITIES = ['P0', 'P1', 'P2'] as const;
export const RISK_AREAS = [
  'functional',
  'data',
  'integration',
  'accessibility',
  'performance',
  'security',
  'usability',
] as const;

export type TestLayer = (typeof TEST_LAYERS)[number];
export type Priority = (typeof PRIORITIES)[number];
export type RiskArea = (typeof RISK_AREAS)[number];

/**
 * Wire schema: the shape the model is constrained to via structured outputs.
 * Deliberately free of regex/min/max refinements so it maps cleanly onto the
 * JSON Schema subset the API accepts. Business rules live in validatePlan().
 */
export const RiskWireSchema = z.object({
  id: z.string().describe('Short id such as R1, R2'),
  area: z.enum(RISK_AREAS),
  description: z.string().describe('What could go wrong, from the user or business perspective'),
  likelihood: z.number().int().describe('1 (rare) to 3 (likely)'),
  impact: z.number().int().describe('1 (minor) to 3 (severe)'),
  mitigation: z.string().describe('How testing reduces this risk, and at which layer'),
});

export const ScenarioWireSchema = z.object({
  id: z.string().describe('Short id such as S1, S2'),
  title: z.string(),
  riskIds: z.array(z.string()).describe('Risks this scenario addresses'),
  layer: z.enum(TEST_LAYERS).describe('Lowest layer that can prove the behaviour'),
  priority: z.enum(PRIORITIES),
  preconditions: z.array(z.string()),
  steps: z.array(z.string()),
  expected: z.array(z.string()),
  oracle: z.string().describe('How pass/fail is decided, e.g. server state, ARIA role text, axe violations'),
  automatable: z.boolean(),
});

export const TestPlanWireSchema = z.object({
  title: z.string(),
  summary: z.string(),
  assumptions: z.array(z.string()),
  risks: z.array(RiskWireSchema),
  scenarios: z.array(ScenarioWireSchema),
  outOfScope: z.array(z.string()),
  openQuestions: z.array(z.string()),
});

export type Risk = z.infer<typeof RiskWireSchema>;
export type Scenario = z.infer<typeof ScenarioWireSchema>;
export type TestPlan = z.infer<typeof TestPlanWireSchema>;

export class PlanValidationError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Test plan failed validation:\n- ${problems.join('\n- ')}`);
    this.name = 'PlanValidationError';
  }
}

export function riskScore(risk: Pick<Risk, 'likelihood' | 'impact'>): number {
  return risk.likelihood * risk.impact;
}

export function riskLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 6) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

/** Business rules the wire schema cannot express. Returns a list of problems, empty when valid. */
export function findPlanProblems(plan: TestPlan): string[] {
  const problems: string[] = [];
  if (plan.risks.length === 0) problems.push('plan has no risks');
  if (plan.scenarios.length === 0) problems.push('plan has no scenarios');

  const riskIds = new Set<string>();
  for (const risk of plan.risks) {
    if (riskIds.has(risk.id)) problems.push(`duplicate risk id ${risk.id}`);
    riskIds.add(risk.id);
    if (risk.likelihood < 1 || risk.likelihood > 3) problems.push(`${risk.id}: likelihood must be 1-3`);
    if (risk.impact < 1 || risk.impact > 3) problems.push(`${risk.id}: impact must be 1-3`);
  }

  const scenarioIds = new Set<string>();
  for (const scenario of plan.scenarios) {
    if (scenarioIds.has(scenario.id)) problems.push(`duplicate scenario id ${scenario.id}`);
    scenarioIds.add(scenario.id);
    if (scenario.steps.length === 0) problems.push(`${scenario.id}: no steps`);
    if (scenario.expected.length === 0) problems.push(`${scenario.id}: no expected results`);
    for (const riskId of scenario.riskIds) {
      if (!riskIds.has(riskId)) problems.push(`${scenario.id}: references unknown risk ${riskId}`);
    }
  }
  return problems;
}

/** Parses model output (JSON, optionally fenced) into a validated TestPlan. */
export function parsePlan(text: string): TestPlan {
  const json = extractJson(text);
  const parsed = TestPlanWireSchema.safeParse(json);
  if (!parsed.success) {
    throw new PlanValidationError(
      parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    );
  }
  const problems = findPlanProblems(parsed.data);
  if (problems.length > 0) throw new PlanValidationError(problems);
  return parsed.data;
}

export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/m.exec(trimmed);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    throw new PlanValidationError(['model output is not valid JSON']);
  }
}
