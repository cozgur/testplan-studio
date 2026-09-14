export const RISK_FOCUS = [
  {
    id: 'functional',
    label: 'Functional journeys',
    hint: 'Critical paths and their failure modes',
    tag: 'e2e',
  },
  {
    id: 'api',
    label: 'API & contracts',
    hint: 'Status codes, validation, consumer expectations',
    tag: 'api · contract',
  },
  { id: 'accessibility', label: 'Accessibility', hint: 'WCAG A/AA, keyboard, live regions', tag: 'axe' },
  { id: 'performance', label: 'Performance', hint: 'Latency budgets, load, rendering', tag: 'k6' },
  {
    id: 'security',
    label: 'Input validation & auth',
    hint: 'Boundaries, auth flows, data exposure',
    tag: 'negative',
  },
] as const;

export type RiskFocus = (typeof RISK_FOCUS)[number]['id'];
export type PlanDepth = 'concise' | 'standard';

export type Brief = {
  /** Allowlisted demo target id, or null for a described-only application. */
  targetId: string | null;
  description: string;
  focus: RiskFocus[];
  constraints: string;
  depth: PlanDepth;
};

export const EMPTY_BRIEF: Brief = {
  targetId: null,
  description: '',
  focus: ['functional', 'accessibility'],
  constraints: '',
  depth: 'standard',
};

export const MIN_DESCRIPTION_LENGTH = 30;

export function validateBrief(brief: Brief): string[] {
  const problems: string[] = [];
  if (!brief.targetId && brief.description.trim().length < MIN_DESCRIPTION_LENGTH) {
    problems.push(
      `Describe the application in at least ${MIN_DESCRIPTION_LENGTH} characters, or pick a demo target.`,
    );
  }
  if (brief.focus.length === 0) problems.push('Choose at least one risk focus.');
  if (brief.description.length > 4000) problems.push('Keep the description under 4000 characters.');
  return problems;
}
