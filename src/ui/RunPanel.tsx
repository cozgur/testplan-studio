import { useState } from 'react';
import type { GeneratedSpec } from '../domain/spec-schema.js';
import type { DemoTarget } from '../domain/targets.js';
import type { DispatchConfig } from '../github/dispatch.js';
import type { RunState } from '../state.js';
import { DEFAULT_DISPATCH, ghCliCommand } from '../github/dispatch.js';
import { CodeBlock } from './CodeBlock.js';
import { Alert } from './Feedback.js';

type Props = {
  spec: GeneratedSpec;
  target: DemoTarget | undefined;
  run: RunState;
  onDispatch: (config: DispatchConfig) => void;
};

export function RunPanel({ spec, target, run, onDispatch }: Props) {
  const [owner, setOwner] = useState(DEFAULT_DISPATCH.owner);
  const [repo, setRepo] = useState(DEFAULT_DISPATCH.repo);
  const [token, setToken] = useState('');
  const busy = run.status === 'dispatching' || run.status === 'waiting';

  if (!target) {
    return (
      <div className="run-intro">
        <span className="stamp">no target</span>
        <p>
          This plan was written for a described-only application, so there is no allowlisted target to run
          against. Download the spec from the Specs step and run it in your own project with{' '}
          <code>npx playwright test</code>.
        </p>
      </div>
    );
  }

  const command = ghCliCommand(
    { ...DEFAULT_DISPATCH, owner, repo },
    { target: target.id, specFileName: spec.fileName, specCode: spec.code },
  );

  return (
    <>
      <div className="run-intro">
        <span className="stamp">target: {target.id}</span>
        <p>
          Dispatches <code>run-generated-spec.yml</code> on{' '}
          <code>
            {owner}/{repo}
          </code>{' '}
          with <code>{spec.fileName}</code> passed as a workflow input.{' '}
          {target.bootsLocally
            ? 'The target is booted inside the job.'
            : `The spec runs against ${target.url}.`}{' '}
          The token is used from this tab and never stored.
        </p>
      </div>

      <form
        className="section"
        aria-labelledby="s-repo"
        onSubmit={(e) => {
          e.preventDefault();
          onDispatch({ ...DEFAULT_DISPATCH, owner, repo, token });
        }}
      >
        <div className="section-label" id="s-repo">
          4.1 · Repository
        </div>
        <div className="grid-2">
          <div className="stack-6">
            <label className="field-label" htmlFor="gh-owner">
              Owner
            </label>
            <input
              id="gh-owner"
              className="input mono"
              type="text"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            />
          </div>
          <div className="stack-6">
            <label className="field-label" htmlFor="gh-repo">
              Repository
            </label>
            <input
              id="gh-repo"
              className="input mono"
              type="text"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
            />
          </div>
        </div>
        <div className="stack-6">
          <label className="field-label" htmlFor="gh-token">
            Fine-grained token
          </label>
          <input
            id="gh-token"
            className="input mono"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="github_pat_…"
            aria-describedby="token-hint"
          />
          <span id="token-hint" className="hint">
            Needs Actions: read and write on this repository only. Sent only to api.github.com.
          </span>
        </div>
        <div className="row-8">
          <button type="submit" className="btn btn-primary" disabled={busy || token.trim() === ''}>
            {busy ? 'Running…' : 'Dispatch workflow'}
          </button>
        </div>
      </form>

      <section className="section tight" aria-labelledby="s-status">
        <div className="section-label no-rule" id="s-status">
          4.2 · Status
        </div>
        <StatusRows run={run} />
      </section>

      <section className="section tight" aria-labelledby="s-cli">
        <div className="section-label" id="s-cli">
          4.3 · Equivalent gh CLI
        </div>
        <p className="hint mt-8" style={{ marginBottom: 8 }}>
          Download the spec first so the file exists next to your shell.
        </p>
        <CodeBlock name="shell" code={command} ariaLabel="GitHub CLI command" />
      </section>
    </>
  );
}

const STAGES = [
  { label: 'dispatching', detail: 'POST /actions/workflows/run-generated-spec.yml/dispatches' },
  { label: 'waiting', detail: 'queued · waiting for a runner' },
  { label: 'in_progress', detail: 'running on ubuntu-latest' },
] as const;

/** Which stage the run has reached: -1 idle, 0-2 in flight, 3 finished. */
function stageOf(run: RunState): number {
  if (run.status === 'idle') return -1;
  if (run.status === 'dispatching') return 0;
  if (run.status === 'waiting') return run.run?.status === 'in_progress' ? 2 : 1;
  return 3;
}

function StatusRows({ run }: { run: RunState }) {
  const stage = stageOf(run);
  const finished = stage === 3;
  const success = finished && run.run?.conclusion === 'success';

  return (
    <div className="status-rows mt-8" role="status" aria-live="polite">
      {stage === -1 && (
        <div className="status-row">
          <span className="box pending" aria-hidden="true" />
          <span className="name muted">idle</span>
          <span className="detail">nothing dispatched yet</span>
        </div>
      )}
      {STAGES.filter((_, i) => i <= Math.min(stage, 2)).map((s, i) => {
        const done = finished || i < stage;
        return (
          <div className="status-row" key={s.label}>
            <span className={done ? 'box' : 'box pending'} aria-hidden="true">
              {done ? '✓' : '…'}
            </span>
            <span className="name">{s.label}</span>
            <span className="detail">{!done && run.message ? run.message : s.detail}</span>
          </div>
        );
      })}
      {finished && run.run && (
        <div className="status-row final">
          <span className={success ? 'box fill-green' : 'box fill-red'} aria-hidden="true">
            {success ? '✓' : '✕'}
          </span>
          <span className="name strong" data-testid="run-status">
            completed · {run.run.conclusion ?? 'unknown'}
          </span>
          <span className={success ? 'outcome ok' : 'outcome bad'}>
            {success ? 'all green' : 'needs a look'}
          </span>
          <a className="link" href={run.run.html_url} target="_blank" rel="noreferrer">
            Open run #{run.run.id} ↗
          </a>
        </div>
      )}
      {finished && !run.run && (
        <div className="status-row final">
          <span className="box fill-red" aria-hidden="true">
            ✕
          </span>
          <span className="name strong" data-testid="run-status">
            failed
          </span>
          <span className="detail">{run.message ?? 'The dispatch did not go through.'}</span>
        </div>
      )}
      {finished && !success && (
        <div className="mt-16">
          <Alert label="Run failed">
            {run.run
              ? `The workflow finished with conclusion "${run.run.conclusion}". Open the run for the Playwright report and traces.`
              : (run.message ?? 'The dispatch did not go through.')}
          </Alert>
        </div>
      )}
    </div>
  );
}
