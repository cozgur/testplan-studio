# ADR-0003: GitHub Actions is the runner, dispatched from the browser

**Status:** Accepted

## Context

Running Playwright needs a machine with browsers. Options: a paid container service, a
serverless function with a headless browser (cold starts, size limits), or GitHub Actions.

## Decision

A `workflow_dispatch` workflow receives the target id and the spec (base64) as inputs, boots the
lab when needed, runs Playwright and uploads the HTML report and traces. The browser dispatches it
through the GitHub REST API with a fine-grained token the user supplies, or the user copies a
`gh workflow run` command.

## Consequences

- No infrastructure to operate; reports and traces are first-class artifacts.
- Dispatch requires write access, so the runner cannot be used anonymously. Reviewers fork the
  repository to run their own specs.
- Inputs are capped at 65k characters; the studio refuses oversized specs before dispatching.
