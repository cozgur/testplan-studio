/**
 * Deterministic lint for generated Playwright specs. The model proposes; this
 * decides whether a proposal is even worth a human's time. Every rule here maps
 * to a flakiness or maintainability failure seen in real suites.
 */
export type Severity = 'error' | 'warning';

export type Finding = {
  rule: string;
  severity: Severity;
  line: number;
  message: string;
};

export type LintResult = {
  findings: Finding[];
  errors: number;
  warnings: number;
  passed: boolean;
};

type LineRule = { id: string; severity: Severity; pattern: RegExp; message: string };
type FileRule = { id: string; severity: Severity; test: (code: string) => boolean; message: string };

const LINE_RULES: LineRule[] = [
  {
    id: 'no-wait-for-timeout',
    severity: 'error',
    pattern: /\.waitForTimeout\(/,
    message: 'Fixed sleeps hide timing bugs and slow the suite. Use a web-first assertion instead.',
  },
  {
    id: 'no-sleep',
    severity: 'error',
    pattern: /setTimeout\(|\bsleep\(/,
    message: 'Do not sleep in tests. Wait on a condition with expect(locator).',
  },
  {
    id: 'no-element-handles',
    severity: 'error',
    pattern: /\bpage\.\$\$?\(/,
    message: 'page.$ returns a stale handle. Use a locator.',
  },
  {
    id: 'no-xpath',
    severity: 'error',
    pattern: /locator\(\s*['"`](\/\/|xpath=)/,
    message: 'XPath couples the test to DOM structure. Use getByRole or getByLabel.',
  },
  {
    id: 'no-test-only',
    severity: 'error',
    pattern: /\b(test|describe)\.only\(/,
    message: 'test.only would silently skip the rest of the suite in CI.',
  },
  {
    id: 'prefer-web-first-assertions',
    severity: 'error',
    pattern:
      /expect\(\s*await\s+.+?\.(isVisible|isEnabled|isChecked|isHidden|textContent|innerText|inputValue|count)\(/,
    message: 'expect(await locator.isVisible()) does not retry. Use expect(locator).toBeVisible().',
  },
  {
    id: 'no-force',
    severity: 'warning',
    pattern: /force:\s*true/,
    message: 'force: true bypasses actionability checks and hides real bugs.',
  },
  {
    id: 'no-network-idle',
    severity: 'warning',
    pattern: /waitForLoadState\(\s*['"`]networkidle/,
    message: 'networkidle is discouraged by Playwright; assert on what the user sees instead.',
  },
  {
    id: 'prefer-semantic-locators',
    severity: 'warning',
    pattern: /locator\(\s*['"`][#.[]/,
    message:
      'CSS id/class/attribute selectors break on refactors. Prefer getByRole, getByLabel, getByText or getByTestId.',
  },
  {
    id: 'no-hardcoded-host',
    severity: 'warning',
    pattern: /goto\(\s*['"`]https?:\/\//,
    message: 'Hard-coded hosts bypass baseURL and break across environments.',
  },
];

const FILE_RULES: FileRule[] = [
  {
    id: 'missing-playwright-import',
    severity: 'error',
    test: (code) => !/from\s+['"]@playwright\/test['"]/.test(code),
    message: "The spec must import from '@playwright/test'.",
  },
  {
    id: 'no-assertions',
    severity: 'error',
    test: (code) => !/\bexpect\(/.test(code),
    message: 'A spec without expect() cannot fail meaningfully.',
  },
  {
    id: 'no-tests',
    severity: 'error',
    test: (code) => !/\btest\(/.test(code),
    message: 'No test() blocks found.',
  },
  {
    id: 'no-semantic-locators',
    severity: 'warning',
    test: (code) => !/getBy(Role|Label|Text|TestId|Placeholder|AltText|Title)\(/.test(code),
    message: 'No role/label/text based locators found. The spec is probably coupled to DOM structure.',
  },
];

export function lintSpec(code: string): LintResult {
  const findings: Finding[] = [];

  code.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) return;
    for (const rule of LINE_RULES) {
      if (rule.pattern.test(line)) {
        findings.push({ rule: rule.id, severity: rule.severity, line: index + 1, message: rule.message });
      }
    }
  });

  for (const rule of FILE_RULES) {
    if (rule.test(code))
      findings.push({ rule: rule.id, severity: rule.severity, line: 1, message: rule.message });
  }

  findings.sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule));
  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.length - errors;
  return { findings, errors, warnings, passed: errors === 0 };
}

/** Every rule id, for documentation and for the verdict panel. */
export const RULE_IDS: readonly string[] = [...LINE_RULES.map((r) => r.id), ...FILE_RULES.map((r) => r.id)];
