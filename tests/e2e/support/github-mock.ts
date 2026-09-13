import type { Page } from '@playwright/test';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

/** Mocks the three GitHub REST calls the run panel makes: dispatch, list runs, get run. */
export async function mockGitHub(page: Page, options: { conclusion?: 'success' | 'failure' } = {}) {
  const conclusion = options.conclusion ?? 'success';
  const dispatches: unknown[] = [];
  let polls = 0;

  await page.route('https://api.github.com/**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });

    const url = request.url();
    if (url.endsWith('/dispatches') && request.method() === 'POST') {
      dispatches.push(request.postDataJSON());
      return route.fulfill({ status: 204, headers: CORS });
    }
    if (url.includes('/runs?event=workflow_dispatch')) {
      return route.fulfill({
        status: 200,
        headers: { ...CORS, 'content-type': 'application/json' },
        body: JSON.stringify({ workflow_runs: [run('queued', null)] }),
      });
    }
    if (/\/actions\/runs\/\d+$/.test(url)) {
      polls += 1;
      const done = polls >= 2;
      return route.fulfill({
        status: 200,
        headers: { ...CORS, 'content-type': 'application/json' },
        body: JSON.stringify(run(done ? 'completed' : 'in_progress', done ? conclusion : null)),
      });
    }
    return route.fulfill({ status: 404, headers: CORS, body: '{}' });
  });

  return dispatches;
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
