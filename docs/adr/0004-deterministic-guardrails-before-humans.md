# ADR-0004: A deterministic lint gates generated code

**Status:** Accepted

## Context

Model-written Playwright code fails in predictable ways: fixed sleeps, CSS-path locators,
`expect(await locator.isVisible())`, `force: true`, `test.only`. A reviewer's time should not be
spent finding those.

## Decision

Every generated spec passes through `lintSpec()`: line rules and file rules with a severity.
Errors block the run step; warnings are shown to the reviewer. Regeneration feeds the findings
back into the prompt. The rules are unit-tested individually.

## Consequences

- The model proposes; the lint decides whether a proposal is worth a human's time.
- Rules are cheap to add and visible in one file, so the quality bar is explicit and versioned.
- The lint is syntactic. It cannot judge whether a test asserts the right thing; that remains the
  reviewer's job, which the author notes in each spec are meant to support.
