/**
 * The only targets the GitHub Actions runner will execute generated specs against.
 * Running arbitrary tests against arbitrary URLs is abuse waiting to happen, so the
 * allowlist is enforced here (UI) and again in the workflow (server side).
 */
export type DemoTarget = {
  id: 'lab' | 'todomvc' | 'saucedemo' | 'the-internet';
  name: string;
  url: string;
  description: string;
  /** Runner boots this target locally instead of hitting a public URL. */
  bootsLocally: boolean;
};

export const DEMO_TARGETS: readonly DemoTarget[] = [
  {
    id: 'lab',
    name: 'Modern Quality Engineering Lab',
    url: 'http://127.0.0.1:3000',
    description:
      'A tiny checkout app with a JSON API (health, users, checkout, orders). Booted inside the runner from github.com/cozgur/modern-quality-engineering-lab.',
    bootsLocally: true,
  },
  {
    id: 'todomvc',
    name: 'Playwright TodoMVC demo',
    url: 'https://demo.playwright.dev/todomvc',
    description: 'Classic TodoMVC: add, complete, filter and clear todos. Public Playwright demo site.',
    bootsLocally: false,
  },
  {
    id: 'saucedemo',
    name: 'Sauce Demo',
    url: 'https://www.saucedemo.com',
    description: 'E-commerce practice site with login, inventory, cart and checkout flows.',
    bootsLocally: false,
  },
  {
    id: 'the-internet',
    name: 'The Internet (Herokuapp)',
    url: 'https://the-internet.herokuapp.com',
    description: 'A collection of tricky UI patterns: dynamic loading, iframes, drag and drop, auth prompts.',
    bootsLocally: false,
  },
];

export function findTarget(id: string | null | undefined): DemoTarget | undefined {
  return DEMO_TARGETS.find((t) => t.id === id);
}

export function isAllowlistedUrl(url: string): boolean {
  return DEMO_TARGETS.some((t) => normalise(t.url) === normalise(url));
}

function normalise(url: string): string {
  return url.trim().replace(/\/+$/, '').toLowerCase();
}
