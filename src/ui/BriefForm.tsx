import type { Brief, PlanDepth, RiskFocus } from '../domain/brief.js';
import { MIN_DESCRIPTION_LENGTH, RISK_FOCUS } from '../domain/brief.js';
import { DEMO_TARGETS } from '../domain/targets.js';

type Props = {
  brief: Brief;
  hasKey: boolean;
  busy: boolean;
  onChange: (brief: Brief) => void;
  onGenerate: () => void;
  onLoadSample: () => void;
};

export function BriefForm({ brief, hasKey, busy, onChange, onGenerate, onLoadSample }: Props) {
  const update = (patch: Partial<Brief>) => onChange({ ...brief, ...patch });
  const toggleFocus = (id: RiskFocus) =>
    update({ focus: brief.focus.includes(id) ? brief.focus.filter((f) => f !== id) : [...brief.focus, id] });

  return (
    <form
      className="card"
      aria-labelledby="brief-heading"
      onSubmit={(e) => {
        e.preventDefault();
        onGenerate();
      }}
    >
      <div className="card-head">
        <h2 id="brief-heading">Brief</h2>
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          What are we testing, and what would hurt if it broke?
        </span>
      </div>

      <div className="stack">
        <fieldset>
          <legend>Application under test</legend>
          <div className="choice-grid">
            {DEMO_TARGETS.map((target) => (
              <label key={target.id} className="choice">
                <input
                  type="radio"
                  name="target"
                  value={target.id}
                  checked={brief.targetId === target.id}
                  onChange={() => update({ targetId: target.id })}
                />
                <span className="title">{target.name}</span>
                <span className="desc">{target.description}</span>
              </label>
            ))}
            <label className="choice">
              <input
                type="radio"
                name="target"
                value=""
                checked={brief.targetId === null}
                onChange={() => update({ targetId: null })}
              />
              <span className="title">Describe only</span>
              <span className="desc">
                No live URL. The plan is built from your description; specs will state their assumptions.
              </span>
            </label>
          </div>
        </fieldset>

        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={brief.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="Who uses it, what the critical journeys are, what has broken before, anything the plan must respect."
          />
          <span className="hint">
            {brief.targetId
              ? 'Optional for demo targets. Add context to sharpen the risks.'
              : `At least ${MIN_DESCRIPTION_LENGTH} characters when no demo target is selected.`}
          </span>
        </div>

        <fieldset>
          <legend>Risk focus</legend>
          <div className="checks">
            {RISK_FOCUS.map((focus) => (
              <label key={focus.id} title={focus.hint}>
                <input
                  type="checkbox"
                  checked={brief.focus.includes(focus.id)}
                  onChange={() => toggleFocus(focus.id)}
                />
                {focus.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="constraints">Constraints</label>
            <input
              id="constraints"
              type="text"
              value={brief.constraints}
              onChange={(e) => update({ constraints: e.target.value })}
              placeholder="e.g. no destructive actions, Chromium only, must finish under 2 minutes"
            />
          </div>
          <fieldset>
            <legend>Depth</legend>
            <div className="checks">
              {(['concise', 'standard'] as PlanDepth[]).map((depth) => (
                <label key={depth}>
                  <input
                    type="radio"
                    name="depth"
                    value={depth}
                    checked={brief.depth === depth}
                    onChange={() => update({ depth })}
                  />
                  {depth === 'concise' ? 'Concise (3-5 risks)' : 'Standard (5-8 risks)'}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="row">
          <button type="submit" className="btn btn-primary" disabled={busy || !hasKey}>
            Generate plan
          </button>
          <button type="button" className="btn" onClick={onLoadSample} disabled={busy}>
            Load sample plan
          </button>
          {!hasKey && (
            <span className="muted" style={{ fontSize: '0.85rem' }}>
              Add an API key to generate, or load the sample to explore.
            </span>
          )}
        </div>
      </div>
    </form>
  );
}
