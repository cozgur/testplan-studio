import { describe, expect, test, vi } from 'vitest';
import type { DispatchConfig, WorkflowRun } from '../../src/github/dispatch.js';
import {
  dispatchSpecRun,
  encodeSpec,
  findDispatchedRun,
  ghCliCommand,
  GitHubError,
  MAX_SPEC_BYTES,
  waitForRun,
} from '../../src/github/dispatch.js';

const cfg: DispatchConfig = {
  owner: 'cozgur',
  repo: 'testplan-studio',
  workflowFile: 'run-generated-spec.yml',
  ref: 'main',
  token: 'tok',
};
const input = { target: 'lab' as const, specFileName: 'checkout.spec.ts', specCode: "test('ü', () => {});" };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function run(overrides: Partial<WorkflowRun>): WorkflowRun {
  return {
    id: 1,
    status: 'queued',
    conclusion: null,
    html_url: 'https://github.com/cozgur/testplan-studio/actions/runs/1',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('encodeSpec', () => {
  test('base64-encodes UTF-8 so non-ASCII survives the round trip', () => {
    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(encodeSpec(input.specCode)), (c) => c.charCodeAt(0)),
    );
    expect(decoded).toBe(input.specCode);
  });
});

describe('dispatchSpecRun', () => {
  test('POSTs the workflow_dispatch payload with auth headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await dispatchSpecRun(cfg, input, fetchMock);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://api.github.com/repos/cozgur/testplan-studio/actions/workflows/run-generated-spec.yml/dispatches',
    );
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(String(init.body))).toEqual({
      ref: 'main',
      inputs: { target: 'lab', spec_file_name: 'checkout.spec.ts', spec_b64: encodeSpec(input.specCode) },
    });
  });

  test('surfaces the GitHub error message on failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { message: 'Bad credentials' }));
    await expect(dispatchSpecRun(cfg, input, fetchMock)).rejects.toMatchObject({
      name: 'GitHubError',
      status: 401,
      message: 'Dispatch failed (401): Bad credentials',
    });
  });

  test('refuses specs that would exceed the workflow_dispatch input limit before calling GitHub', async () => {
    const fetchMock = vi.fn();
    const huge = { ...input, specCode: 'x'.repeat(MAX_SPEC_BYTES) };
    await expect(dispatchSpecRun(cfg, huge, fetchMock)).rejects.toBeInstanceOf(GitHubError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('findDispatchedRun', () => {
  test('returns the first run created after the dispatch (with a minute of clock slack)', async () => {
    const since = new Date('2026-09-13T10:00:00Z');
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        workflow_runs: [
          run({ id: 3, created_at: '2026-09-13T09:59:30Z' }),
          run({ id: 2, created_at: '2026-09-13T09:00:00Z' }),
        ],
      }),
    );
    await expect(findDispatchedRun(cfg, since, fetchMock)).resolves.toMatchObject({ id: 3 });
  });

  test('returns null when only older runs exist', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { workflow_runs: [run({ id: 2, created_at: '2026-09-13T09:00:00Z' })] }),
      );
    await expect(findDispatchedRun(cfg, new Date('2026-09-13T10:00:00Z'), fetchMock)).resolves.toBeNull();
  });
});

describe('waitForRun', () => {
  test('polls until the run appears and completes, without real sleeping', async () => {
    const since = new Date();
    const responses = [
      jsonResponse(200, { workflow_runs: [] }),
      jsonResponse(200, { workflow_runs: [run({ id: 7, status: 'queued' })] }),
      jsonResponse(200, run({ id: 7, status: 'in_progress' })),
      jsonResponse(200, run({ id: 7, status: 'completed', conclusion: 'success' })),
    ];
    const fetchMock = vi.fn().mockImplementation(async () => responses.shift());
    const sleep = vi.fn().mockResolvedValue(undefined);
    const onUpdate = vi.fn();

    const result = await waitForRun(cfg, since, { fetchImpl: fetchMock, sleep, onUpdate });

    expect(result).toMatchObject({ id: 7, status: 'completed', conclusion: 'success' });
    expect(sleep).toHaveBeenCalledTimes(3);
    expect(onUpdate.mock.calls.map(([r]) => (r as WorkflowRun | null)?.status ?? null)).toEqual([
      null,
      'queued',
      'in_progress',
      'completed',
    ]);
  });

  test('gives up when the run never appears before the deadline', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { workflow_runs: [] }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(
      waitForRun(cfg, new Date(), { fetchImpl: fetchMock, sleep, timeoutMs: -1 }),
    ).rejects.toMatchObject({ status: 408 });
  });
});

describe('ghCliCommand', () => {
  test('produces a copy-pasteable gh command', () => {
    const command = ghCliCommand(cfg, input);
    expect(command).toContain(
      'gh workflow run run-generated-spec.yml --repo cozgur/testplan-studio --ref main',
    );
    expect(command).toContain('-f target=lab');
    expect(command).toContain('-f spec_file_name=checkout.spec.ts');
    expect(command).toContain('base64 < checkout.spec.ts');
  });
});
