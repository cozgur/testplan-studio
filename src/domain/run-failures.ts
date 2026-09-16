/**
 * A failing test from a runner workflow, and the human verdict on what it means.
 *
 * The whole point of this step is that a red test is ambiguous: either the test is
 * wrong, or the application is. Only a human can decide, and the tool must not quietly
 * "heal" a test into passing when the app is the thing that is broken (ADR-0004).
 */
export type RunFailure = {
  /** Stable key for triage state: file and line of the assertion that failed. */
  id: string;
  /** Full test title as Playwright reports it, without the project and file prefix. */
  test: string;
  file: string;
  line: number;
  /** The failure text: assertion, locator, expected/received and the code excerpt. */
  message: string;
};

/** Human verdict. `unreviewed` blocks both regeneration and the bug report. */
export type Verdict = 'unreviewed' | 'test' | 'app';

export type TriageMap = Record<string, Verdict>;

/** The subset of a GitHub check-run annotation this module reads. */
export type CheckAnnotation = {
  annotation_level?: string | null;
  path?: string | null;
  start_line?: number | null;
  title?: string | null;
  message?: string | null;
};

const TITLE_LINE = /^\s*\d+\)\s*(.+?)\s*$/;

/**
 * Turns Playwright's GitHub-reporter annotations into failures.
 * Ignores workflow-level noise ("Process completed with exit code 1") by requiring a
 * spec file path, and de-duplicates retries of the same assertion.
 */
export function parseAnnotations(annotations: readonly CheckAnnotation[]): RunFailure[] {
  const byId = new Map<string, RunFailure>();

  for (const annotation of annotations) {
    if (annotation.annotation_level !== 'failure') continue;
    const file = annotation.path ?? '';
    if (!file.endsWith('.spec.ts')) continue;

    const message = annotation.message ?? '';
    const [firstLine, ...rest] = message.split('\n');
    const headed = TITLE_LINE.exec(firstLine);
    // The message's first line carries the untruncated title; the annotation title is
    // capped by GitHub at 160 characters, so prefer the message and fall back to it.
    const fullTitle = headed ? headed[1] : (annotation.title ?? '');
    const line = annotation.start_line ?? 0;
    const id = `${file}:${line}`;
    if (byId.has(id)) continue;

    byId.set(id, {
      id,
      test: testNameOf(fullTitle),
      file,
      line,
      message: (headed ? rest.join('\n') : message).trim(),
    });
  }

  return [...byId.values()];
}

/** `[chromium] › file.spec.ts:12:3 › Suite › Test name` -> `Suite › Test name`. */
export function testNameOf(title: string): string {
  const parts = title
    .split('›')
    .map((part) => part.trim())
    .filter(Boolean);
  const meaningful = parts.filter((part) => !part.startsWith('[') && !/\.spec\.ts(:\d+)*$/.test(part));
  return (meaningful.length > 0 ? meaningful : parts).join(' › ');
}

export function countVerdicts(failures: readonly RunFailure[], triage: TriageMap) {
  let test = 0;
  let app = 0;
  let unreviewed = 0;
  for (const failure of failures) {
    const verdict = triage[failure.id] ?? 'unreviewed';
    if (verdict === 'test') test += 1;
    else if (verdict === 'app') app += 1;
    else unreviewed += 1;
  }
  return { test, app, unreviewed };
}

export function failuresWith(
  failures: readonly RunFailure[],
  triage: TriageMap,
  verdict: Verdict,
): RunFailure[] {
  return failures.filter((failure) => (triage[failure.id] ?? 'unreviewed') === verdict);
}
