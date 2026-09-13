import type { ReactNode } from 'react';

type Props = { kind: 'error' | 'ok' | 'info'; children: ReactNode; onDismiss?: () => void };

export function Notice({ kind, children, onDismiss }: Props) {
  const className = kind === 'error' ? 'notice notice-error' : kind === 'ok' ? 'notice notice-ok' : 'notice';
  return (
    <div className={className} role={kind === 'error' ? 'alert' : 'status'}>
      <div>{children}</div>
      {onDismiss && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  );
}

export function Progress({ label, characters }: { label: string; characters: number }) {
  return (
    <div className="progress" role="status" aria-live="polite">
      <span>
        {label}
        {characters > 0 ? ` · ${characters.toLocaleString()} characters` : ''}
      </span>
      <span className="bar" aria-hidden="true" />
    </div>
  );
}
