# ADR-0002: Generated specs run only against allowlisted targets

**Status:** Accepted

## Context

"Paste any URL and we will run tests against it" is a denial-of-service tool with a nicer UI.
It also invites testing systems the user does not own.

## Decision

The studio offers a fixed list of targets: the Modern Quality Engineering Lab (booted inside the
runner) and three public practice sites that exist to be automated against. The list is enforced
in the UI and again in the workflow, where the base URL is resolved from the target id, never
from user input. A described-only brief produces a plan and a spec but no run.

## Consequences

- The run step cannot be pointed at an arbitrary host.
- Adding a target is a deliberate, reviewed change in two places.
- Users who want to test their own application download the spec and run it locally.
