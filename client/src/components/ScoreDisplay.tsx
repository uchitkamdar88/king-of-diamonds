export function ScoreDisplay({ score, label = "Score" }: { score: number; label?: string }) {
  return (
    <div className="text-center" aria-label={`${label} ${score}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-500">{label}</p>
      <p className="font-mono text-3xl text-white tabular-nums">{score}</p>
    </div>
  );
}
