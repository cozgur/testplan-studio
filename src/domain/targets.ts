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
  /** One-line mono summary shown on the target card. */
  short: string;
  /** Runner boots this target locally instead of hitting a public URL. */
  bootsLocally: boolean;
};

export const DEMO_TARGETS: readonly DemoTarget[] = [
  {
    id: 'lab',
    name: 'Modern Quality Engineering Lab',
    url: 'http://127.0.0.1:3000',
    description:
      'A single page served at / with the heading "Modern Quality Engineering Lab", one button named "Run demo checkout" and a paragraph with role="status" that reads "No checkout yet." initially. Clicking the button POSTs {"productId":"quality-lab","quantity":1} to /api/checkout and the status becomes "Order confirmed: <orderId>", or "Checkout failed" if the API responds with an error or non-JSON; the button is disabled while the request is in flight and re-enabled afterwards. There is no form, no navigation and no authentication. JSON API: GET /api/health -> {"status":"ok"}; GET /api/users/42 -> {"id":42,"name":"Ada Tester","plan":"pro"} (any other id -> 404 {"error":"user_not_found"}); POST /api/checkout requires productId (non-empty string) and quantity (integer 1-100, default 1) -> 201 {"orderId","status":"confirmed","productId","quantity"}, invalid input -> 400 {"error":"invalid_checkout","reason"}, malformed JSON -> 400 {"error":"invalid_json"}; GET /api/orders/:id -> the stored order or 404 {"error":"order_not_found"}. Orders live in memory; ids look like order-<uuid>. Booted inside the runner from github.com/cozgur/modern-quality-engineering-lab.',
    short: 'lab · checkout, orders API, /health',
    bootsLocally: true,
  },
  {
    id: 'todomvc',
    name: 'Playwright TodoMVC demo',
    url: 'https://demo.playwright.dev/todomvc',
    description: 'Classic TodoMVC: add, complete, filter and clear todos. Public Playwright demo site.',
    short: 'todomvc · CRUD list',
    bootsLocally: false,
  },
  {
    id: 'saucedemo',
    name: 'Sauce Demo',
    url: 'https://www.saucedemo.com',
    description: 'E-commerce practice site with login, inventory, cart and checkout flows.',
    short: 'saucedemo · login, cart',
    bootsLocally: false,
  },
  {
    id: 'the-internet',
    name: 'The Internet (Herokuapp)',
    url: 'https://the-internet.herokuapp.com',
    description: 'A collection of tricky UI patterns: dynamic loading, iframes, drag and drop, auth prompts.',
    short: 'the-internet · widget zoo',
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
