import { useState } from 'react';
import type { LintResult } from '../domain/guardrails.js';
import type { GeneratedSpec } from '../domain/spec-schema.js';
import { RULE_IDS } from '../domain/guardrails.js';
import { CodeBlock } from './CodeBlock.js';
import { Progress } from './Feedback.js';

type Props = {
  spec: GeneratedSpec;
  lint: LintResult;
  hasKey: boolean;
  busy: { characters: number } | null;
  onRegenerate: () => void;
  onContinue: () => void;
  onCancel: () => void;
};

export function SpecView({ spec, lint, hasKey, busy, onRegenerate, onContinue, onCancel }: Props) {
  const [confirmed, setConfirmed] = useState<number[]>([]);
  const toggleNote = (i: number) =>
    setConfirmed((ids) => (ids.includes(i) ? ids.filter((x) => x !== i) : [...ids, i]));
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  return (
    <>
      <section className="section tight" aria-labelledby="s-lint">
        <div className="section-label" id="s-lint">
          3.1 · Lint verdict · deterministic, runs in the browser
        </div>
        <div className={lint.passed ? 'verdict mt-16' : 'verdict failed mt-16'}>
          <span className={lint.passed ? 'stamp-lg passed' : 'stamp-lg failed'} data-testid="lint-verdict">
            {lint.passed ? 'passed' : 'failed'}
          </span>
          <div>
            <div className="counts">
              {plural(lint.errors, 'error')} · {plural(lint.warnings, 'warning')}
            </div>
            <div className="desc">
              {lint.passed
                ? `Rules checked: ${RULE_IDS.join(', ')}.`
                : 'Fix the errors or regenerate. The run step stays locked while errors remain.'}
            </div>
          </div>
        </div>
        {lint.findings.length > 0 && (
          <div className="rows mt-16">
            {lint.findings.map((f) => (
              <div className="finding" key={`${f.rule}-${f.line}`}>
                <span className="where">L{f.line}</span>
                <span className={`sev ${f.severity}`}>{f.severity}</span>
                <span className="rule">{f.rule}</span>
                <span className="msg">{f.message}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <CodeBlock
        name={spec.fileName}
        nameAsHeading
        numbered
        code={spec.code}
        ariaLabel="Generated Playwright spec"
        download={{ fileName: spec.fileName, type: 'text/typescript;charset=utf-8' }}
      />

      {spec.notes.length > 0 && (
        <section className="section tight notes" aria-labelledby="s-notes">
          <div className="section-label no-rule" id="s-notes">
            3.2 · Author notes to confirm
          </div>
          <div className="rows mt-8">
            {spec.notes.map((note, i) => (
              <label key={note} className="check-row">
                <input type="checkbox" checked={confirmed.includes(i)} onChange={() => toggleNote(i)} />
                <span>{note}</span>
              </label>
            ))}
          </div>
        </section>
      )}

      <div className="actions">
        {busy && <Progress label="Writing the Playwright spec" characters={busy.characters} />}
        <div className="row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onContinue}
            disabled={!lint.passed || busy !== null}
          >
            Continue to run
          </button>
          {busy ? (
            <button type="button" className="btn" onClick={onCancel}>
              Cancel
            </button>
          ) : (
            <button type="button" className="btn" onClick={onRegenerate} disabled={!hasKey}>
              {lint.passed ? 'Regenerate' : 'Regenerate with lint feedback'}
            </button>
          )}
          {!lint.passed && <span className="hint">Blocked by {plural(lint.errors, 'lint error')}.</span>}
          {lint.passed && !hasKey && (
            <span className="hint">Add an API key in the Brief step to regenerate.</span>
          )}
        </div>
      </div>
    </>
  );
}
