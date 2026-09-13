import type { TestPlan } from '../domain/plan-schema.js';

/**
 * A hand-written plan for the Modern Quality Engineering Lab so the studio is
 * explorable without an API key. It is labelled as a sample in the UI.
 */
export const SAMPLE_PLAN: TestPlan = {
  title: 'Risk-based test plan: Quality Lab checkout',
  summary:
    'A single-page checkout demo backed by a small JSON API. The business-critical path is the checkout button producing a confirmed order that exists server-side. Most risk sits in request validation and in how failures are communicated to the user, so the plan pushes validation coverage down to API tests and keeps the browser suite to the journey and its visible failure modes.',
  assumptions: [
    'The app runs on the configured baseURL with an in-memory order store; no test data setup is needed.',
    'The demo user 42 and product id "quality-lab" are stable fixtures.',
    'No authentication is involved in Phase 1.',
  ],
  risks: [
    {
      id: 'R1',
      area: 'functional',
      description:
        'A customer clicks checkout and no order is created, or the UI claims success without a server-side order.',
      likelihood: 2,
      impact: 3,
      mitigation:
        'E2E journey that reads the order id from the UI and verifies the order through GET /api/orders/:id.',
    },
    {
      id: 'R2',
      area: 'data',
      description:
        'Invalid payloads (missing product, zero or fractional quantity, string quantity) are accepted and persisted.',
      likelihood: 3,
      impact: 2,
      mitigation:
        'Table-driven API tests on POST /api/checkout boundaries; a database CHECK constraint as a second line of defence.',
    },
    {
      id: 'R3',
      area: 'usability',
      description:
        'When the API fails, the user sees a stuck "Processing" state or a raw error instead of a clear message.',
      likelihood: 2,
      impact: 2,
      mitigation:
        'E2E tests that mock 503 JSON and 502 HTML responses at the network layer and assert the status message and button state.',
    },
    {
      id: 'R4',
      area: 'accessibility',
      description:
        'The status region is not announced to screen readers, or the page has colour-contrast or labelling defects.',
      likelihood: 2,
      impact: 2,
      mitigation: 'axe-core scan before and after interaction; assert role="status" text updates.',
    },
    {
      id: 'R5',
      area: 'integration',
      description:
        'The UI client and the User API drift apart (renamed field, changed type) without any test noticing until production.',
      likelihood: 2,
      impact: 3,
      mitigation: 'Pact consumer contract for GET /api/users/:id verified against the real provider in CI.',
    },
    {
      id: 'R6',
      area: 'performance',
      description:
        'Health and checkout endpoints degrade under modest concurrency, making the demo unreliable.',
      likelihood: 1,
      impact: 2,
      mitigation: 'k6 protocol test with p95 and error-rate thresholds on a schedule.',
    },
  ],
  scenarios: [
    {
      id: 'S1',
      title: 'Customer completes the demo checkout and the order exists server-side',
      riskIds: ['R1'],
      layer: 'e2e',
      priority: 'P0',
      preconditions: ['App is reachable at baseURL'],
      steps: [
        'Open the home page',
        'Click the "Run demo checkout" button',
        'Read the order id from the status region',
      ],
      expected: [
        'Status region contains "Order confirmed:"',
        'GET /api/orders/{id} returns 200 with productId "quality-lab" and status "confirmed"',
      ],
      oracle: 'Server state via the API, not the UI text alone',
      automatable: true,
    },
    {
      id: 'S2',
      title: 'Checkout API unavailable shows a clear failure and re-enables the button',
      riskIds: ['R3'],
      layer: 'e2e',
      priority: 'P0',
      preconditions: ['POST /api/checkout mocked to return 503 with a JSON body'],
      steps: ['Open the home page', 'Click "Run demo checkout"'],
      expected: ['Status region reads exactly "Checkout failed"', 'The checkout button is enabled again'],
      oracle: 'Role-based text assertion plus toBeEnabled',
      automatable: true,
    },
    {
      id: 'S3',
      title: 'Non-JSON gateway error page is handled without a stuck state',
      riskIds: ['R3'],
      layer: 'e2e',
      priority: 'P1',
      preconditions: ['POST /api/checkout mocked to return 502 with text/html'],
      steps: ['Open the home page', 'Click "Run demo checkout"'],
      expected: ['Status region reads "Checkout failed"'],
      oracle: 'Role-based text assertion',
      automatable: true,
    },
    {
      id: 'S4',
      title: 'Checkout validation boundaries',
      riskIds: ['R2'],
      layer: 'api',
      priority: 'P0',
      preconditions: [],
      steps: [
        'POST /api/checkout with quantity 0, 1, 100, 101, 1.5 and "2"',
        'POST with a missing and a blank productId',
        'POST with malformed JSON',
      ],
      expected: [
        '1 and 100 return 201',
        '0, 101, 1.5, "2" return 400 with a reason',
        'Malformed JSON returns 400 invalid_json, not 500',
      ],
      oracle: 'HTTP status and error body shape',
      automatable: true,
    },
    {
      id: 'S5',
      title: 'Homepage has no automatically detectable WCAG A/AA violations, before and after checkout',
      riskIds: ['R4'],
      layer: 'accessibility',
      priority: 'P1',
      preconditions: [],
      steps: [
        'Open the home page',
        'Run axe with wcag2a, wcag2aa, wcag21a, wcag21aa tags',
        'Click checkout and wait for confirmation',
        'Run axe again',
      ],
      expected: ['Zero violations in both scans'],
      oracle: 'axe-core violations array is empty',
      automatable: true,
    },
    {
      id: 'S6',
      title: 'User API response shape matches the consumer contract',
      riskIds: ['R5'],
      layer: 'contract',
      priority: 'P1',
      preconditions: ['Consumer pact generated'],
      steps: ['Run the Pact provider verification against the Express app'],
      expected: ['All interactions verified'],
      oracle: 'Pact verifier result',
      automatable: true,
    },
    {
      id: 'S7',
      title: 'Health endpoint stays within latency budget under 10 virtual users',
      riskIds: ['R6'],
      layer: 'performance',
      priority: 'P2',
      preconditions: ['k6 installed'],
      steps: ['Run the k6 API load script for 20 seconds'],
      expected: ['p95 < 250 ms', 'Error rate < 1%'],
      oracle: 'k6 thresholds',
      automatable: true,
    },
    {
      id: 'S8',
      title: 'Exploratory session: keyboard-only checkout and screen reader announcement',
      riskIds: ['R4'],
      layer: 'manual',
      priority: 'P2',
      preconditions: ['VoiceOver or NVDA available'],
      steps: [
        'Tab to the checkout button',
        'Activate with Enter and Space',
        'Listen for the status announcement',
      ],
      expected: ['Announcement is made once and is understandable'],
      oracle: 'Human judgement',
      automatable: false,
    },
  ],
  outOfScope: [
    'Visual regression baselines',
    'Cross-browser matrix beyond Chromium',
    'Authentication flows (not present in Phase 1)',
  ],
  openQuestions: [
    'Should quantity above 100 be a business rule or a temporary limit?',
    'Is a Pact Broker planned once the consumer moves to its own repo?',
  ],
};
