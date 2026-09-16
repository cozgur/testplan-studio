import type { Page } from '@playwright/test';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export type MockFailure = { file: string; line: number; test: string; message: string };

export type GitHubMockOptions = {
  conclusion?: 'success' | 'failure';
  /** Failing tests the check-run annotations should report. */
  failures?: MockFailure[];
  /** Simulate a token without the Checks: read permission. */
  annotationsForbidden?: boolean;
};

/** Mocks the GitHub REST calls the run panel makes: dispatch, runs, run, jobs, annotations. */
export async function mockGitHub(page: Page, options: GitHubMockOptions = {}) {
  const conclusion = options.conclusion ?? 'success';
  const failures = options.failures ?? [];
  const dispatches: unknown[] = [];
  let polls = 0;

  await page.route('https://api.github.com/**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const url = request.url();
    const json = (status: number, body: unknown) =>
      route.fulfill({
        status,
        headers: { ...CORS, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

    if (url.endsWith('/dispatches') && request.method() === 'POST') {
      dispatches.push(request.postDataJSON());
      return route.fulfill({ status: 204, headers: CORS });
    }
    if (url.includes('/runs?event=workflow_dispatch'))
      return json(200, { workflow_runs: [run('queued', null)] });
    if (/\/actions\/runs\/\d+\/jobs$/.test(url)) {
      return json(200, { jobs: [{ id: 99, name: 'Run spec against lab', conclusion }] });
    }
    if (/\/actions\/runs\/\d+$/.test(url)) {
      polls += 1;
      const done = polls >= 2;
      return json(200, run(done ? 'completed' : 'in_progress', done ? conclusion : null));
    }
    if (/\/check-runs\/\d+\/annotations$/.test(url)) {
      if (options.annotationsForbidden)
        return json(403, { message: 'Resource not accessible by personal access token' });
      return json(200, failures.map(annotation));
    }
    return json(404, {});
  });

  return dispatches;
}

/** Mirrors what Playwright's GitHub reporter writes, including the numbered header. */
function annotation(failure: MockFailure) {
  const title = `[chromium] › ${failure.file}:1:3 › ${failure.test}`;
  return {
    annotation_level: 'failure',
    path: failure.file,
    start_line: failure.line,
    title,
    message: `  1) ${title} \n    ${failure.message}`,
  };
}

function run(status: string, conclusion: string | null) {
  return {
    id: 4242,
    status,
    conclusion,
    html_url: 'https://github.com/cozgur/testplan-studio/actions/runs/4242',
    created_at: new Date().toISOString(),
  };
}
