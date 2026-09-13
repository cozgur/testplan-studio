# ADR-0001: Static site with bring-your-own-key

**Status:** Accepted

## Context

A test-planning assistant needs a model API. Hosting a backend with a shared key means paying for
strangers' usage, storing secrets, and running abuse controls. A portfolio project should be
demonstrably safe to leave online.

## Decision

The studio is a static site. Visitors paste their own Anthropic API key, which is held in memory
and sent only to api.anthropic.com from the browser. A sample plan and spec make the whole flow
explorable without a key.

## Consequences

- Zero hosting cost, zero secret storage, no server logs that could leak keys.
- Direct browser access to the API requires the SDK's explicit opt-in; this is appropriate here
  because every visitor supplies their own credential.
- Browser-only means the site cannot execute Playwright itself; see ADR-0003.
