# ADR-0005: Structured outputs for shape, domain validation for meaning

**Status:** Accepted

## Context

The plan and the spec are rendered from JSON the model produces. Free-text parsing is fragile,
and a schema alone cannot express rules like "every scenario references an existing risk".

## Decision

Two layers. A **wire schema** (Zod, refinement-free) is passed to the API as a structured-output
format so the response is constrained to the right shape. A **domain validator** then checks
business rules: unique ids, valid risk references, likelihood and impact in 1-3, safe spec file
names. Failures surface as a single error listing every problem.

## Consequences

- The wire schema stays within the JSON Schema subset the API accepts.
- Validation errors are specific enough to show to the user and to unit test.
- The SDK parses structured output inside `finalMessage()`; refusals and truncations are detected
  from the accumulated message when that parse fails, and typed API errors are re-thrown untouched.
