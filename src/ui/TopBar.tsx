const REVISION = 'QA-TP · rev 0.1';

type Props = { stepIndex: number; stepCount: number; onReset: () => void };

export function TopBar({ stepIndex, stepCount, onReset }: Props) {
  return (
    <header className="topbar">
      <div className="brand">
        <strong>TestPlan Studio</strong>
        <span>{REVISION}</span>
      </div>
      <div className="meta">
        Static · GitHub Pages · No data leaves the browser except to api.anthropic.com ·{' '}
        <a href="https://github.com/cozgur/testplan-studio">Source ↗</a> ·{' '}
        <button type="button" className="linklike" onClick={onReset}>
          Start over
        </button>
      </div>
      <div className="step-counter" aria-hidden="true">
        {String(stepIndex + 1).padStart(2, '0')} / {String(stepCount).padStart(2, '0')}
      </div>
    </header>
  );
}
