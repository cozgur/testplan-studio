import type { Brief } from './domain/brief.js';
import type { LintResult } from './domain/guardrails.js';
import type { TestPlan } from './domain/plan-schema.js';
import type { GeneratedSpec } from './domain/spec-schema.js';
import type { WorkflowRun } from './github/dispatch.js';
import type { ModelId } from './llm/models.js';
import { EMPTY_BRIEF } from './domain/brief.js';
import { lintSpec } from './domain/guardrails.js';
import { DEFAULT_MODEL } from './llm/models.js';

export type Step = 'brief' | 'plan' | 'specs' | 'run';

export const STEPS: { id: Step; label: string; hint: string }[] = [
  { id: 'brief', label: 'Brief', hint: 'Describe the app and choose a risk focus' },
  { id: 'plan', label: 'Plan', hint: 'Risk register and scenarios' },
  { id: 'specs', label: 'Specs', hint: 'Playwright spec and lint verdict' },
  { id: 'run', label: 'Run', hint: 'Dispatch on GitHub Actions' },
];

export type PlanSource = 'sample' | 'generated';

export type RunState = {
  status: 'idle' | 'dispatching' | 'waiting' | 'completed' | 'failed';
  run: WorkflowRun | null;
  message: string | null;
};

export type State = {
  step: Step;
  apiKey: string;
  model: ModelId;
  brief: Brief;
  plan: TestPlan | null;
  planSource: PlanSource | null;
  selected: string[];
  spec: GeneratedSpec | null;
  lint: LintResult | null;
  busy: { kind: 'plan' | 'spec'; characters: number } | null;
  error: string | null;
  run: RunState;
};

export type Action =
  | { type: 'setStep'; step: Step }
  | { type: 'setApiKey'; apiKey: string }
  | { type: 'setModel'; model: ModelId }
  | { type: 'setBrief'; brief: Brief }
  | { type: 'start'; kind: 'plan' | 'spec' }
  | { type: 'progress'; characters: number }
  | { type: 'planReady'; plan: TestPlan; source: PlanSource }
  | { type: 'toggleScenario'; id: string }
  | { type: 'specReady'; spec: GeneratedSpec }
  | { type: 'fail'; message: string }
  | { type: 'cancel' }
  | { type: 'dismissError' }
  | { type: 'run'; run: RunState };

export const initialState: State = {
  step: 'brief',
  apiKey: '',
  model: DEFAULT_MODEL,
  brief: EMPTY_BRIEF,
  plan: null,
  planSource: null,
  selected: [],
  spec: null,
  lint: null,
  busy: null,
  error: null,
  run: { status: 'idle', run: null, message: null },
};

/** Browser-layer scenarios the studio can turn into a Playwright spec. */
export function defaultSelection(plan: TestPlan): string[] {
  return plan.scenarios
    .filter((s) => s.automatable && (s.layer === 'e2e' || s.layer === 'accessibility'))
    .map((s) => s.id);
}

export function canReach(state: State, step: Step): boolean {
  switch (step) {
    case 'brief':
      return true;
    case 'plan':
      return state.plan !== null;
    case 'specs':
      return state.spec !== null;
    case 'run':
      return state.spec !== null && state.lint?.passed === true;
  }
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setStep':
      return canReach(state, action.step) ? { ...state, step: action.step, error: null } : state;
    case 'setApiKey':
      return { ...state, apiKey: action.apiKey };
    case 'setModel':
      return { ...state, model: action.model };
    case 'setBrief':
      return { ...state, brief: action.brief };
    case 'start':
      return { ...state, busy: { kind: action.kind, characters: 0 }, error: null };
    case 'progress':
      return state.busy ? { ...state, busy: { ...state.busy, characters: action.characters } } : state;
    case 'planReady':
      return {
        ...state,
        plan: action.plan,
        planSource: action.source,
        selected: defaultSelection(action.plan),
        spec: null,
        lint: null,
        busy: null,
        error: null,
        step: 'plan',
        run: initialState.run,
      };
    case 'toggleScenario':
      return {
        ...state,
        selected: state.selected.includes(action.id)
          ? state.selected.filter((id) => id !== action.id)
          : [...state.selected, action.id],
      };
    case 'specReady':
      return {
        ...state,
        spec: action.spec,
        lint: lintSpec(action.spec.code),
        busy: null,
        error: null,
        step: 'specs',
        run: initialState.run,
      };
    case 'fail':
      return { ...state, busy: null, error: action.message };
    case 'cancel':
      return { ...state, busy: null };
    case 'dismissError':
      return { ...state, error: null };
    case 'run':
      return { ...state, run: action.run };
  }
}
