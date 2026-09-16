# ADR-0006: A failed run is triaged by a human before anything is regenerated

**Status:** Accepted

## Context

Once the studio could run a generated spec, the obvious next feature was "regenerate from the
failure". It is also the most dangerous one. A failing test means one of two things, and the
difference matters more than anything else in the loop:

- the test is wrong, and should be rewritten;
- the application is wrong, and the test is doing its job.

A tool that feeds failures straight back to the model optimises for green, which is precisely how
an agent erases a real defect. Our own runs proved the risk is not theoretical: the first spec the
studio generated against the lab failed on a keyboard-focus assertion, and the assertion was right.
The lab had a real accessibility defect.

## Decision

The Run step reads the failing tests from the workflow's check-run annotations and shows each one
with its assertion and code excerpt. Every failure needs a human verdict before anything happens:

- **test is wrong** → included in the regeneration prompt, with an explicit instruction not to
  weaken an assertion to make it pass, and to report in the notes if the model concludes the
  application is at fault;
- **application is wrong** → collected into a Markdown bug report with the scenario, its risks, the
  reproduction steps and the runner output.

Both actions stay disabled while any failure is unreviewed.

## Consequences

- The loop closes without becoming a self-healing machine.
- Reading annotations needs `Checks: read` on the token in addition to `Actions: read and write`;
  a 403 is reported with that sentence rather than as an empty list.
- Annotations are capped by GitHub, so a very long failure is truncated. The link to the full run
  is always shown next to the verdict.
- Verdicts are deliberately not persisted across reloads: they describe one run, and a new run or a
  new set of failures resets them.
