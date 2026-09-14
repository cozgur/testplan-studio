export function StepHeader({ title, index, count }: { title: string; index: number; count: number }) {
  return (
    <div className="step-header">
      <h1>{title}</h1>
      <span className="counter">
        {String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
      </span>
    </div>
  );
}
