const REVISION = 'QA-TP · rev 0.1';

export function TopBar({ stepIndex, stepCount }: { stepIndex: number; stepCount: number }) {
  return (
    <header className="topbar">
      <div className="brand">
        <strong>TestPlan Studio</strong>
        <span>{REVISION}</span>
      </div>
      <div className="meta">
        Static · GitHub Pages · No data leaves the browser except to api.anthropic.com ·{' '}
        <a href="https://github.com/cozgur/testplan-studio">Source ↗</a>
      </div>
      <div className="step-counter" aria-hidden="true">
        {String(stepIndex + 1).padStart(2, '0')} / {String(stepCount).padStart(2, '0')}
      </div>
    </header>
  );
}
