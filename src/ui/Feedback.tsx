import type { ReactNode } from 'react';

type AlertProps = { label?: string; children: ReactNode; onDismiss?: () => void };

export function Alert({ label = 'Error', children, onDismiss }: AlertProps) {
  return (
    <div className="alert" role="alert">
      <span className="label">{label}</span>
      <div className="body">
        <span>{children}</span>
        {onDismiss && (
          <button type="button" onClick={onDismiss}>
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

export function Progress({ label, characters }: { label: string; characters: number }) {
  return (
    <div className="progress" role="status" aria-live="polite">
      <div className="track" aria-hidden="true">
        <div className="fill" />
      </div>
      <div className="text">
        {label}
        {characters > 0 ? ` · ${characters.toLocaleString()} characters` : ''}
      </div>
    </div>
  );
}
