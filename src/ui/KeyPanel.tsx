import type { ModelId } from '../llm/models.js';
import { MODELS } from '../llm/models.js';

type Props = {
  apiKey: string;
  model: ModelId;
  onApiKeyChange: (value: string) => void;
  onModelChange: (value: ModelId) => void;
};

export function KeyPanel({ apiKey, model, onApiKeyChange, onModelChange }: Props) {
  return (
    <section className="card" aria-labelledby="key-heading">
      <div className="card-head">
        <h2 id="key-heading">Your Claude API key</h2>
        <span className="badge">memory only</span>
      </div>
      <div className="stack">
        <div className="field">
          <label htmlFor="api-key">API key</label>
          <input
            id="api-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-ant-…"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
          />
          <span className="hint">
            Sent directly from your browser to api.anthropic.com and kept in memory until you close the tab.
            There is no backend. Without a key you can still explore the sample plan.
          </span>
        </div>
        <div className="field">
          <label htmlFor="model">Model</label>
          <select id="model" value={model} onChange={(e) => onModelChange(e.target.value as ModelId)}>
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <span className="hint">{MODELS.find((m) => m.id === model)?.note}</span>
        </div>
      </div>
    </section>
  );
}
