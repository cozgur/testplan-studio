# TestPlan Studio

[![CI](https://github.com/cozgur/testplan-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/cozgur/testplan-studio/actions/workflows/ci.yml)
[![Deploy](https://github.com/cozgur/testplan-studio/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/cozgur/testplan-studio/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-1.63-2EAD33?logo=playwright&logoColor=white)

**Live:** <https://studio.ozgurcetintas.dev/>

Describe an application or pick a demo target. Claude drafts a **risk-based test plan** with every
scenario placed at the right test layer. Turn the browser scenarios into a **Playwright spec**, pass
it through a **deterministic guardrail lint**, and **run it on GitHub Actions** with one click.

A static site with no backend. Your API key stays in your browser. No key? Load the sample plan and
walk the whole flow anyway.

<!-- screenshot: docs/screenshot-plan.png -->

## What it does

| Step | You | The studio |
|---|---|---|
| 1 · Brief | Pick a target (or describe an app), choose risk focus and depth | Validates the brief before spending a token |
| 2 · Plan | Read the risk register, tick scenarios | Claude returns a schema-constrained plan; ids, references and scores are re-validated; export Markdown or JSON |
| 3 · Specs | Review code and author notes | Claude writes a Playwright spec; `lintSpec()` blocks sleeps, CSS paths, non-retrying assertions, `test.only`; regenerate with the findings fed back |
| 4 · Run | Dispatch or copy a `gh` command | `workflow_dispatch` boots the target, runs the spec, uploads the report and traces |

## Why it is built this way

- **Risk first, layer second.** The planner prompt insists that a scenario lives at the lowest layer
  that can prove it. Most "E2E" ideas come back as API or unit scenarios, which is the point.
- **The model proposes, a linter decides.** Generated code that would flake never reaches a reviewer.
  Every rule is unit-tested. See [ADR-0004](docs/adr/0004-deterministic-guardrails-before-humans.md).
- **Structured outputs plus domain validation.** Shape is enforced by the API; meaning is enforced by
  the app. See [ADR-0005](docs/adr/0005-structured-output-plus-domain-validation.md).
- **No arbitrary targets.** The runner only accepts an allowlist. See [ADR-0002](docs/adr/0002-allowlisted-targets.md).
- **Designed like a document, not a dashboard.** A "printed test protocol" look from Claude Design: paper,
  ink, hairlines, stamps for verdicts, 3×3 squares for risk scores. Plain CSS variables, WCAG AA contrast,
  visible focus rings, reduced-motion respected. See [docs/design.md](docs/design.md#visual-design).
- **Work survives a reload, secrets never do.** The brief, plan, selection and spec are kept in
  `sessionStorage` and re-validated with the same schemas as model output on the way back in. The API key
  and the GitHub token live in memory only. "Start over" wipes the session.
- **Tested like a product.** 102 unit tests, Testing Library for the form, Playwright E2E with the
  Anthropic Messages API mocked as server-sent events at the network layer so the real SDK does the
  parsing, GitHub REST mocked the same way, axe-core on every step.

The demo target is my other repository, [modern-quality-engineering-lab](https://github.com/cozgur/modern-quality-engineering-lab),
which the runner boots inside the job.

## Run it locally

```bash
nvm use && npm ci
npm run dev                 # http://127.0.0.1:5173
```

```bash
npm run check               # lint + format + types + unit tests (with coverage thresholds)
npm run test:e2e            # Playwright E2E + accessibility, APIs mocked
npm run build && npm run preview
```

To generate for real, paste an Anthropic API key in the Brief step. It is sent only to
`api.anthropic.com` and discarded when the tab closes. Models: Claude Opus 5 (default), Sonnet 5, Haiku 4.5.

## Run a generated spec on Actions

Dispatching needs write access to the repository, so fork it first. Then either paste a
fine-grained token (Actions: read and write) into the Run step, or use the command the studio
prints:

```bash
gh workflow run run-generated-spec.yml --repo <you>/testplan-studio --ref main \
  -f target=lab -f spec_file_name=checkout-journey.spec.ts \
  -f spec_b64="$(base64 < checkout-journey.spec.ts | tr -d '\n')"
```

The job validates the file name, writes the spec under `runner/generated/`, resolves the base URL
from the target id, boots the lab if needed, runs Playwright and uploads the HTML report with traces.

## Project layout

```
src/
  domain/      plan schema + validation, brief, prompts, guardrail lint, targets, Markdown export
  llm/         planner orchestration (testable seam) and the browser Anthropic client
  github/      workflow_dispatch client with polling
  ui/          React components, one per step
  fixtures/    the sample plan and spec used in no-key mode
  state.ts     reducer: steps, artefacts, reachability
tests/
  unit/        Vitest (domain, planner with a fake stream, dispatch with a fake fetch, reducer, form)
  e2e/         Playwright with network-level mocks and axe scans
runner/        Playwright config used by the Actions runner
.github/       ci, deploy-pages, run-generated-spec, dependabot
docs/          design.md and ADRs
```

## Decisions

| ADR | Decision |
|---|---|
| [0001](docs/adr/0001-static-site-bring-your-own-key.md) | Static site with bring-your-own-key |
| [0002](docs/adr/0002-allowlisted-targets.md) | Generated specs run only against allowlisted targets |
| [0003](docs/adr/0003-github-actions-as-the-runner.md) | GitHub Actions is the runner |
| [0004](docs/adr/0004-deterministic-guardrails-before-humans.md) | A deterministic lint gates generated code |
| [0005](docs/adr/0005-structured-output-plus-domain-validation.md) | Structured outputs for shape, domain validation for meaning |

## Known limits

- Model output quality is probabilistic and not asserted in CI. The sample plan is the reference; the
  lint is the backstop for code.
- `workflow_dispatch` inputs are capped at 65k characters, so very long specs must be run locally.
- Chromium only in the runner. Adding Firefox or WebKit is a config change.
- No server-side refusal fallback yet; a refusal is shown to the user with the API's explanation.

## Author

**Özgür Çetintaş**, Rotterdam. Test automation and quality engineering.
GitHub: [@cozgur](https://github.com/cozgur)

## License

[MIT](LICENSE)
