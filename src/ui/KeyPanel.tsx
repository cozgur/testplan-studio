import type { ModelId } from '../llm/models.js';
import { MODELS } from '../llm/models.js';

type Props = {
  apiKey: string;
  model: ModelId;
  onApiKeyChange: (value: string) => void;
  onModelChange: (value: ModelId) => void;
};

export function KeyPanel({ apiKey, model, onApiKeyChange, onModelChange }: Props) {
  const trimmed = apiKey.trim();
  const looksWrong = trimmed.length > 0 && !trimmed.startsWith('sk-ant-');

  return (
    <section className="section" aria-labelledby="s-model">
      <div className="section-label" id="s-model">
        1.1 · Model access
      </div>
      <div className="grid-main-aside">
        <div className="stack-6">
          <label className="field-label" htmlFor="api-key">
            Anthropic API key
          </label>
          <input
            id="api-key"
            className="input mono"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-ant-…"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            aria-invalid={looksWrong || undefined}
            aria-describedby={looksWrong ? 'api-key-error' : undefined}
          />
          {looksWrong && (
            <span id="api-key-error" className="field-error">
              Anthropic keys start with sk-ant-. Check what you pasted.
            </span>
          )}
        </div>
        <div className="stack-6">
          <label className="field-label" htmlFor="model">
            Model
          </label>
          <select
            id="model"
            className="select"
            value={model}
            onChange={(e) => onModelChange(e.target.value as ModelId)}
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="hint">
        Sent directly from your browser to api.anthropic.com. Kept in memory until you close the tab.{' '}
        {MODELS.find((m) => m.id === model)?.note}
      </p>
    </section>
  );
}
