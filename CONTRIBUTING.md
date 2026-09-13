# Contributing

```bash
nvm use && npm ci
npx playwright install --with-deps chromium
npm run dev            # http://127.0.0.1:5173
npm run check          # lint + format + types + unit tests
npm run test:e2e       # Playwright, APIs mocked at the network layer
```

- Decisions that are not obvious from the code get an ADR in `docs/adr/`.
- New guardrail rules need a unit test that triggers them and one that shows they stay quiet.
- Adding a run target is a two-place change (UI allowlist and workflow) and needs an ADR update.
- Never commit keys or tokens; the app is designed so they are never needed in the repository.
