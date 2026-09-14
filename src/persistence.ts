import { z } from 'zod';
import type { RiskFocus } from './domain/brief.js';
import type { ModelId } from './llm/models.js';
import type { State, Step } from './state.js';
import { RISK_FOCUS } from './domain/brief.js';
import { lintSpec } from './domain/guardrails.js';
import { findPlanProblems, TestPlanWireSchema } from './domain/plan-schema.js';
import { GeneratedSpecWireSchema } from './domain/spec-schema.js';
import { MODELS } from './llm/models.js';
import { canReach, initialState, STEPS } from './state.js';

/**
 * Keeps the work-in-progress across a reload. Only artefacts are stored: the brief,
 * the plan, the selection, the spec, the model and the step. Never the API key, the
 * GitHub token, run status or transient UI state. Everything read back is validated
 * with the same schemas and rules as model output, so a stale or tampered entry is
 * dropped rather than trusted.
 */
export const SESSION_KEY = 'testplan-studio:session:v1';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const focusIds = RISK_FOCUS.map((f) => f.id) as [RiskFocus, ...RiskFocus[]];
const modelIds = MODELS.map((m) => m.id) as [ModelId, ...ModelId[]];
const stepIds = STEPS.map((s) => s.id) as [Step, ...Step[]];

const BriefSchema = z.object({
  targetId: z.string().nullable(),
  description: z.string(),
  focus: z.array(z.enum(focusIds)),
  constraints: z.string(),
  depth: z.enum(['concise', 'standard']),
});

const SessionSchema = z.object({
  version: z.literal(1),
  step: z.enum(stepIds),
  model: z.enum(modelIds),
  brief: BriefSchema,
  plan: TestPlanWireSchema.nullable(),
  planSource: z.enum(['sample', 'generated']).nullable(),
  selected: z.array(z.string()),
  spec: GeneratedSpecWireSchema.nullable(),
});

export type PersistedSession = z.infer<typeof SessionSchema>;

export function browserStorage(): StorageLike | null {
  try {
    const storage = globalThis.sessionStorage;
    storage.getItem(SESSION_KEY);
    return storage;
  } catch {
    return null;
  }
}

export function snapshot(state: State): PersistedSession {
  return {
    version: 1,
    step: state.step,
    model: state.model,
    brief: state.brief,
    plan: state.plan,
    planSource: state.planSource,
    selected: state.selected,
    spec: state.spec,
  };
}

export function saveSession(state: State, storage: StorageLike | null = browserStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(SESSION_KEY, JSON.stringify(snapshot(state)));
  } catch {
    // Quota or privacy mode: persistence is a convenience, never a requirement.
  }
}

export function clearSession(storage: StorageLike | null = browserStorage()): void {
  try {
    storage?.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

/** Returns the state fields to restore, or null when nothing valid is stored. */
export function loadSession(storage: StorageLike | null = browserStorage()): Partial<State> | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = SessionSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const data = parsed.data;

    if (data.plan && (findPlanProblems(data.plan).length > 0 || data.planSource === null)) return null;

    const plan = data.plan;
    const candidate: State = {
      ...initialState,
      model: data.model,
      brief: data.brief,
      plan,
      planSource: plan ? data.planSource : null,
      selected: plan ? data.selected.filter((id) => plan.scenarios.some((s) => s.id === id)) : [],
      spec: plan ? data.spec : null,
      lint: plan && data.spec ? lintSpec(data.spec.code) : null,
    };
    return { ...candidate, step: highestReachable(candidate, data.step) };
  } catch {
    return null;
  }
}

function highestReachable(state: State, wanted: Step): Step {
  const order = STEPS.map((s) => s.id);
  let index = order.indexOf(wanted);
  while (index > 0 && !canReach(state, order[index])) index -= 1;
  return order[Math.max(index, 0)];
}
