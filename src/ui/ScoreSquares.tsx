/** 3×3 grid: L×I filled squares, printed in signal red from 6 upwards. */
export function ScoreSquares({ score }: { score: number }) {
  const hot = score >= 6;
  return (
    <div className="score">
      <div className="squares" role="img" aria-label={`score ${score} of 9`}>
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className={i < score ? (hot ? 'hot' : 'on') : undefined} />
        ))}
      </div>
      <span className="value">{score}</span>
    </div>
  );
}
