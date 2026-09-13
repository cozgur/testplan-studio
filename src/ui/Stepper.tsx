import type { State, Step } from '../state.js';
import { canReach, STEPS } from '../state.js';

type Props = { state: State; onSelect: (step: Step) => void };

export function Stepper({ state, onSelect }: Props) {
  const currentIndex = STEPS.findIndex((s) => s.id === state.step);
  return (
    <nav aria-label="Workflow steps">
      <ol className="stepper">
        {STEPS.map((step, index) => {
          const reachable = canReach(state, step.id);
          const done = index < currentIndex;
          return (
            <li key={step.id} className={done ? 'done' : undefined}>
              <button
                type="button"
                onClick={() => onSelect(step.id)}
                disabled={!reachable}
                aria-current={state.step === step.id ? 'step' : undefined}
              >
                <span className="num">{String(index + 1).padStart(2, '0')}</span>
                <span>
                  <span style={{ display: 'block', fontWeight: 600 }}>{step.label}</span>
                  <span className="muted" style={{ fontSize: '0.78rem' }}>
                    {step.hint}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
