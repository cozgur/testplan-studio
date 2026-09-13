import { useState, type CSSProperties } from 'react';
import type { GeneratedSpec } from '../domain/spec-schema.js';
import type { DemoTarget } from '../domain/targets.js';
import type { DispatchConfig } from '../github/dispatch.js';
import type { RunState } from '../state.js';
import { DEFAULT_DISPATCH, ghCliCommand } from '../github/dispatch.js';
import { copyText } from './download.js';

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
  const [copied, setCopied] = useState(false);
  const busy = run.status === 'dispatching' || run.status === 'waiting';

  if (!target) {
    return (
      <section className="card reveal" aria-labelledby="run-heading">
        <h2 id="run-heading">Run</h2>
        <p className="muted" style={{ marginTop: 10 }}>
          This plan was written for a described-only application, so there is no allowlisted target to run
          against. Download the spec and run it in your own project with{' '}
          <code className="mono">npx playwright test</code>.
        </p>
      </section>
    );
  }

  const command = ghCliCommand(DEFAULT_DISPATCH, {
    target: target.id,
    specFileName: spec.fileName,
    specCode: spec.code,
  });

  return (
    <div className="stack">
      <section className="card reveal" aria-labelledby="run-heading">
        <div className="card-head">
          <h2 id="run-heading">Run on GitHub Actions</h2>
          <span className="badge badge-amber">target: {target.id}</span>
        </div>
        <p className="muted">
          The runner workflow accepts only allowlisted targets.{' '}
          {target.bootsLocally
            ? 'This target is booted inside the job, so the spec runs against a fresh instance.'
            : `This target is a public practice site at ${target.url}.`}
        </p>
      </section>

      <section
        className="card reveal"
        style={{ '--i': 1 } as CSSProperties}
        aria-labelledby="dispatch-heading"
      >
        <div className="card-head">
          <h2 id="dispatch-heading">Dispatch from here</h2>
          <span className="badge">token in memory only</span>
        </div>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            onDispatch({ ...DEFAULT_DISPATCH, owner, repo, token });
          }}
        >
          <div className="grid-2">
            <div className="field">
              <label htmlFor="gh-owner">Repository owner</label>
              <input id="gh-owner" type="text" value={owner} onChange={(e) => setOwner(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="gh-repo">Repository</label>
              <input id="gh-repo" type="text" value={repo} onChange={(e) => setRepo(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="gh-token">Fine-grained GitHub token</label>
            <input
              id="gh-token"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="github_pat_…"
            />
            <span className="hint">
              Needs Actions: read and write on a fork or clone of this repository. Sent only to
              api.github.com.
            </span>
          </div>
          <div className="row">
            <button type="submit" className="btn btn-primary" disabled={busy || token.trim() === ''}>
              {busy ? 'Running…' : 'Dispatch workflow'}
            </button>
            <RunStatus run={run} />
          </div>
        </form>
      </section>

      <section className="card reveal" style={{ '--i': 2 } as CSSProperties} aria-labelledby="cli-heading">
        <div className="card-head">
          <h2 id="cli-heading">Or dispatch with the GitHub CLI</h2>
          <button
            type="button"
            className="btn btn-sm"
            onClick={async () => {
              setCopied(await copyText(command));
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? 'Copied' : 'Copy command'}
          </button>
        </div>
        <p className="muted" style={{ marginBottom: 10 }}>
          Download the spec first so the file exists next to your shell.
        </p>
        <pre className="code" tabIndex={0} aria-label="GitHub CLI command">
          {command}
        </pre>
      </section>
    </div>
  );
}

function RunStatus({ run }: { run: RunState }) {
  if (run.status === 'idle') return null;
  const tone =
    run.status === 'failed'
      ? 'badge badge-red'
      : run.status === 'completed'
        ? 'badge badge-teal'
        : 'badge badge-amber';
  return (
    <span role="status" className="row">
      <span className={tone} data-testid="run-status">
        {run.status}
        {run.run?.conclusion ? ` · ${run.run.conclusion}` : ''}
      </span>
      {run.message && <span className="muted">{run.message}</span>}
      {run.run && (
        <a href={run.run.html_url} target="_blank" rel="noreferrer">
          Open run #{run.run.id}
        </a>
      )}
    </span>
  );
}
