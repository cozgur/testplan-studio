import type { Brief, RiskFocus } from '../domain/brief.js';
import { MIN_DESCRIPTION_LENGTH, RISK_FOCUS } from '../domain/brief.js';
import { DEMO_TARGETS } from '../domain/targets.js';
import { Progress } from './Feedback.js';

type Props = {
  brief: Brief;
  hasKey: boolean;
  busy: { characters: number } | null;
  onChange: (brief: Brief) => void;
  onGenerate: () => void;
  onLoadSample: () => void;
  onCancel: () => void;
};

export function BriefForm({ brief, hasKey, busy, onChange, onGenerate, onLoadSample, onCancel }: Props) {
  const update = (patch: Partial<Brief>) => onChange({ ...brief, ...patch });
  const toggleFocus = (id: RiskFocus) =>
    update({ focus: brief.focus.includes(id) ? brief.focus.filter((f) => f !== id) : [...brief.focus, id] });

  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        onGenerate();
      }}
    >
      <fieldset className="section tight">
        <legend className="section-label">1.2 · Target</legend>
        <div className="target-grid">
          {DEMO_TARGETS.map((target) => (
            <label key={target.id} className="target-card">
              <input
                type="radio"
                name="target"
                value={target.id}
                checked={brief.targetId === target.id}
                onChange={() => update({ targetId: target.id })}
              />
              <span className="title">{target.name}</span>
              <span className="meta">{target.short}</span>
            </label>
          ))}
        </div>
        <label className="radio-row mt-12">
          <input
            type="radio"
            name="target"
            value=""
            checked={brief.targetId === null}
            onChange={() => update({ targetId: null })}
          />
          Describe only — no demo target
        </label>
      </fieldset>

      <div className="stack-6">
        <label className="field-label" htmlFor="description">
          Description
        </label>
        <textarea
          id="description"
          className="textarea"
          rows={5}
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

      <fieldset className="section tight">
        <legend className="section-label">1.3 · Risk focus</legend>
        <div className="check-rows">
          {RISK_FOCUS.map((focus) => (
            <label key={focus.id} className="check-row" title={focus.hint}>
              <input
                type="checkbox"
                checked={brief.focus.includes(focus.id)}
                onChange={() => toggleFocus(focus.id)}
              />
              {focus.label}
              <span className="tag" aria-hidden="true">
                {focus.tag}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid-main-aside align-end">
        <div className="stack-6">
          <label className="field-label" htmlFor="constraints">
            Constraints
          </label>
          <input
            id="constraints"
            className="input"
            type="text"
            value={brief.constraints}
            onChange={(e) => update({ constraints: e.target.value })}
            placeholder="e.g. no destructive actions, Chromium only, must finish under 2 minutes"
          />
        </div>
        <fieldset>
          <legend className="field-label">Depth</legend>
          <div className="segmented">
            <label>
              <input
                type="radio"
                name="depth"
                value="concise"
                checked={brief.depth === 'concise'}
                onChange={() => update({ depth: 'concise' })}
              />
              Concise
            </label>
            <label>
              <input
                type="radio"
                name="depth"
                value="standard"
                checked={brief.depth === 'standard'}
                onChange={() => update({ depth: 'standard' })}
              />
              Standard
            </label>
          </div>
        </fieldset>
      </div>

      <div className="actions">
        {busy && <Progress label="Drafting the test plan" characters={busy.characters} />}
        <div className="row">
          {busy ? (
            <button type="button" className="btn btn-primary" disabled aria-busy="true">
              Generating…
            </button>
          ) : (
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!hasKey}
              aria-describedby={hasKey ? undefined : 'key-hint'}
            >
              Generate plan
            </button>
          )}
          {busy ? (
            <button type="button" className="btn" onClick={onCancel}>
              Cancel
            </button>
          ) : (
            <button type="button" className="btn" onClick={onLoadSample}>
              Load sample plan
            </button>
          )}
          {!hasKey && !busy && (
            <span id="key-hint" className="hint">
              Add an API key to generate, or load the sample plan to continue without one.
            </span>
          )}
        </div>
      </div>
    </form>
  );
}
