import type { State, Step } from '../state.js';
import { findTarget } from '../domain/targets.js';
import { canReach, STEPS } from '../state.js';

type Props = { state: State; onSelect: (step: Step) => void };

/** Completed steps summarise what was decided in them, like a filled-in form. */
function completedHint(state: State, step: Step): string | null {
  switch (step) {
    case 'brief': {
      const target = findTarget(state.brief.targetId)?.id ?? 'described only';
      const depth = state.brief.depth === 'concise' ? 'Concise' : 'Standard';
      return `${target} · ${depth} depth`;
    }
    case 'plan':
      return state.plan
        ? `${state.selected.length} of ${state.plan.scenarios.length} scenarios selected`
        : null;
    case 'specs':
      return state.lint
        ? `lint ${state.lint.passed ? 'passed' : 'failed'} · ${state.lint.warnings} warning${state.lint.warnings === 1 ? '' : 's'}`
        : null;
    case 'run':
      return null;
  }
}

export function Stepper({ state, onSelect }: Props) {
  const currentIndex = STEPS.findIndex((s) => s.id === state.step);
  return (
    <nav className="rail" aria-label="Steps">
      <div className="rail-label">Steps</div>
      <ol className="steps">
        {STEPS.map((step, index) => {
          const done = index < currentIndex;
          const current = state.step === step.id;
          const reachable = canReach(state, step.id);
          return (
            <li key={step.id}>
              <button
                type="button"
                className={done ? 'step is-done' : 'step'}
                onClick={() => onSelect(step.id)}
                disabled={!reachable}
                aria-current={current ? 'step' : undefined}
              >
                <span className="num" aria-hidden="true">
                  {done ? '✓' : String(index + 1).padStart(2, '0')}
                </span>
                <span>
                  <span className="name">
                    {step.label}
                    {done && <span className="sr-only"> (completed)</span>}
                  </span>
                  <span className="desc">{(done && completedHint(state, step.id)) || step.hint}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
