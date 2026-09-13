import type { CSSProperties } from 'react';
export function Header() {
  return (
    <>
      <header className="header">
        <div className="wordmark">
          TestPlan <strong>Studio</strong>
        </div>
        <nav aria-label="Project links">
          <a href="https://github.com/cozgur/testplan-studio">Source</a>
          <a href="https://github.com/cozgur/modern-quality-engineering-lab">Demo target</a>
          <a href="https://github.com/cozgur/testplan-studio/blob/main/docs/design.md">How it works</a>
        </nav>
      </header>
      <section className="hero">
        <div className="reveal">
          <p className="kicker">Risk-based test planning, reviewed by a linter, run on Actions</p>
          <h1>
            Plan the tests <em>before</em> you write them.
          </h1>
        </div>
        <p className="reveal" style={{ '--i': 1 } as CSSProperties}>
          Describe an application or pick a demo target. Claude drafts a risk register and scenarios placed at
          the right test layer. Turn the browser scenarios into a Playwright spec, pass it through a
          deterministic guardrail lint, and run it on GitHub Actions. Your API key never leaves your browser.
        </p>
      </section>
    </>
  );
}
