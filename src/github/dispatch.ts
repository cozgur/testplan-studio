import type { CheckAnnotation, RunFailure } from '../domain/run-failures.js';
import type { DemoTarget } from '../domain/targets.js';
import { parseAnnotations } from '../domain/run-failures.js';

/**
 * Runs a generated spec on GitHub Actions through workflow_dispatch. No backend:
 * the browser calls api.github.com with a fine-grained token the user supplies
 * (Actions: read and write on the repo). The token stays in memory.
 */
export type DispatchConfig = {
  owner: string;
  repo: string;
  workflowFile: string;
  ref: string;
  token: string;
};

export type DispatchInput = {
  target: DemoTarget['id'];
  specFileName: string;
  specCode: string;
};

export type WorkflowJob = {
  id: number;
  name: string;
  conclusion: string | null;
};

export type WorkflowRun = {
  id: number;
  status: 'queued' | 'in_progress' | 'completed' | string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
};

export class GitHubError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

export const DEFAULT_DISPATCH: Omit<DispatchConfig, 'token'> = {
  owner: 'cozgur',
  repo: 'testplan-studio',
  workflowFile: 'run-generated-spec.yml',
  ref: 'main',
};

/** workflow_dispatch inputs are capped at 65,535 characters in total. */
export const MAX_SPEC_BYTES = 48_000;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function encodeSpec(code: string): string {
  const bytes = new TextEncoder().encode(code);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function ghCliCommand(cfg: Omit<DispatchConfig, 'token'>, input: DispatchInput): string {
  return [
    `gh workflow run ${cfg.workflowFile} --repo ${cfg.owner}/${cfg.repo} --ref ${cfg.ref} \\`,
    `  -f target=${input.target} \\`,
    `  -f spec_file_name=${input.specFileName} \\`,
    `  -f spec_b64="$(base64 < ${input.specFileName} | tr -d '\\n')"`,
  ].join('\n');
}

export async function dispatchSpecRun(
  cfg: DispatchConfig,
  input: DispatchInput,
  fetchImpl: FetchLike = fetch,
) {
  const spec_b64 = encodeSpec(input.specCode);
  if (spec_b64.length > MAX_SPEC_BYTES) {
    throw new GitHubError(
      413,
      `Spec is too large for workflow_dispatch (${spec_b64.length} > ${MAX_SPEC_BYTES}).`,
    );
  }
  const response = await fetchImpl(
    `${apiBase(cfg)}/actions/workflows/${encodeURIComponent(cfg.workflowFile)}/dispatches`,
    {
      method: 'POST',
      headers: headers(cfg.token),
      body: JSON.stringify({
        ref: cfg.ref,
        inputs: { target: input.target, spec_file_name: input.specFileName, spec_b64 },
      }),
    },
  );
  if (response.status !== 204) throw await toError(response, 'Dispatch failed');
}

export async function findDispatchedRun(
  cfg: DispatchConfig,
  since: Date,
  fetchImpl: FetchLike = fetch,
): Promise<WorkflowRun | null> {
  const response = await fetchImpl(
    `${apiBase(cfg)}/actions/workflows/${encodeURIComponent(cfg.workflowFile)}/runs?event=workflow_dispatch&per_page=5`,
    { headers: headers(cfg.token) },
  );
  if (!response.ok) throw await toError(response, 'Could not list workflow runs');
  const body = (await response.json()) as { workflow_runs: WorkflowRun[] };
  const threshold = since.getTime() - 60_000;
  return body.workflow_runs.find((run) => new Date(run.created_at).getTime() >= threshold) ?? null;
}

export async function getRun(
  cfg: DispatchConfig,
  id: number,
  fetchImpl: FetchLike = fetch,
): Promise<WorkflowRun> {
  const response = await fetchImpl(`${apiBase(cfg)}/actions/runs/${id}`, { headers: headers(cfg.token) });
  if (!response.ok) throw await toError(response, 'Could not read workflow run');
  return (await response.json()) as WorkflowRun;
}

/**
 * Reads the failures of a finished run. Playwright's GitHub reporter writes one
 * check-run annotation per failing test, which is the only machine-readable failure
 * detail available to a browser: artifacts are zipped and job logs redirect to a host
 * that does not allow cross-origin reads.
 */
export async function collectRunFailures(
  cfg: DispatchConfig,
  runId: number,
  fetchImpl: FetchLike = fetch,
): Promise<RunFailure[]> {
  const jobs = await listRunJobs(cfg, runId, fetchImpl);
  const failed = jobs.filter((job) => job.conclusion === 'failure');
  const annotations = await Promise.all(failed.map((job) => listJobAnnotations(cfg, job.id, fetchImpl)));
  return parseAnnotations(annotations.flat());
}

export async function listRunJobs(
  cfg: DispatchConfig,
  runId: number,
  fetchImpl: FetchLike = fetch,
): Promise<WorkflowJob[]> {
  const response = await fetchImpl(`${apiBase(cfg)}/actions/runs/${runId}/jobs`, {
    headers: headers(cfg.token),
  });
  if (!response.ok) throw await toError(response, 'Could not read the run jobs');
  const body = (await response.json()) as { jobs?: WorkflowJob[] };
  return body.jobs ?? [];
}

/** A workflow job is also a check run, so its id addresses the annotations endpoint. */
export async function listJobAnnotations(
  cfg: DispatchConfig,
  jobId: number,
  fetchImpl: FetchLike = fetch,
): Promise<CheckAnnotation[]> {
  const response = await fetchImpl(`${apiBase(cfg)}/check-runs/${jobId}/annotations`, {
    headers: headers(cfg.token),
  });
  if (response.status === 403) {
    throw new GitHubError(
      403,
      'Could not read the failure details: the token also needs Checks: read permission.',
    );
  }
  if (!response.ok) throw await toError(response, 'Could not read the failure details');
  return (await response.json()) as CheckAnnotation[];
}

export type WaitOptions = {
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  pollMs?: number;
  timeoutMs?: number;
  onUpdate?: (run: WorkflowRun | null) => void;
};

/** Polls until the dispatched run completes. Injected sleep keeps the unit test instant. */
export async function waitForRun(
  cfg: DispatchConfig,
  since: Date,
  options: WaitOptions = {},
): Promise<WorkflowRun> {
  const {
    fetchImpl = fetch,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    pollMs = 5_000,
    timeoutMs = 15 * 60_000,
    onUpdate,
  } = options;
  const deadline = Date.now() + timeoutMs;

  let run: WorkflowRun | null = null;
  while (!run) {
    if (Date.now() > deadline) throw new GitHubError(408, 'Timed out waiting for the run to appear.');
    run = await findDispatchedRun(cfg, since, fetchImpl);
    onUpdate?.(run);
    if (!run) await sleep(pollMs);
  }

  while (run.status !== 'completed') {
    if (Date.now() > deadline) throw new GitHubError(408, 'Timed out waiting for the run to complete.');
    await sleep(pollMs);
    run = await getRun(cfg, run.id, fetchImpl);
    onUpdate?.(run);
  }
  return run;
}

function apiBase(cfg: DispatchConfig): string {
  return `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`;
}

function headers(token: string): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

async function toError(response: Response, prefix: string): Promise<GitHubError> {
  let detail: string;
  try {
    const body = (await response.json()) as { message?: string };
    detail = body.message ?? '';
  } catch {
    detail = '';
  }
  return new GitHubError(response.status, `${prefix} (${response.status})${detail ? `: ${detail}` : ''}`);
}
