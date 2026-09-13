import { useState, type CSSProperties } from 'react';
import type { LintResult } from '../domain/guardrails.js';
import type { GeneratedSpec } from '../domain/spec-schema.js';
import { copyText, downloadText } from './download.js';

type Props = {
  spec: GeneratedSpec;
  lint: LintResult;
  hasKey: boolean;
  busy: boolean;
  onRegenerate: () => void;
  onContinue: () => void;
};

export function SpecView({ spec, lint, hasKey, busy, onRegenerate, onContinue }: Props) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="stack">
      <section className="card reveal" aria-labelledby="lint-heading">
        <div className="card-head">
          <h2 id="lint-heading">Guardrail lint</h2>
          <div className="row">
            <span className={lint.passed ? 'badge badge-teal' : 'badge badge-red'} data-testid="lint-verdict">
              {lint.passed ? 'passed' : 'failed'}
            </span>
            <span className="badge">{lint.errors} errors</span>
            <span className="badge">{lint.warnings} warnings</span>
          </div>
        </div>
        {lint.findings.length === 0 ? (
          <p className="muted">
            No anti-patterns found: role-based locators, web-first assertions, no sleeps, no forced actions.
          </p>
        ) : (
          <ul className="findings">
            {lint.findings.map((f) => (
              <li key={`${f.rule}-${f.line}`}>
                <span className="where">
                  L{f.line}
                  <br />
                  <span className={f.severity === 'error' ? 'badge badge-red' : 'badge badge-amber'}>
                    {f.severity}
                  </span>
                </span>
                <span>
                  <strong className="mono">{f.rule}</strong> · {f.message}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="row" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={onContinue} disabled={!lint.passed}>
            Continue to run
          </button>
          <button type="button" className="btn" onClick={onRegenerate} disabled={busy || !hasKey}>
            {lint.passed ? 'Regenerate' : 'Regenerate with lint feedback'}
          </button>
          {!lint.passed && (
            <span className="muted" style={{ fontSize: '0.85rem' }}>
              Errors block the run. Warnings are for the reviewer.
            </span>
          )}
        </div>
      </section>

      <section className="card reveal" style={{ '--i': 1 } as CSSProperties} aria-labelledby="code-heading">
        <div className="card-head">
          <h2 id="code-heading" className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem' }}>
            {spec.fileName}
          </h2>
          <div className="row">
            <button
              type="button"
              className="btn btn-sm"
              onClick={async () => {
                setCopied(await copyText(spec.code));
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => downloadText(spec.fileName, spec.code, 'text/typescript;charset=utf-8')}
            >
              Download
            </button>
          </div>
        </div>
        <pre className="code" tabIndex={0} aria-label={`Contents of ${spec.fileName}`}>
          {spec.code}
        </pre>
        {spec.notes.length > 0 && (
          <>
            <h3 style={{ marginTop: 18 }}>Author notes to confirm</h3>
            <ul className="muted" style={{ margin: '6px 0 0', paddingLeft: 20, fontSize: '0.9rem' }}>
              {spec.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
