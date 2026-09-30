import type { GameOverPayload } from "@kod/shared";
import { GlassPanel } from "./GlassPanel";
import { NeonButton } from "./NeonButton";

export function Leaderboard({
  payload,
  onRematch,
  onLobby,
}: {
  payload: GameOverPayload;
  onRematch: () => void;
  onLobby: () => void;
}) {
  return (
    <GlassPanel glow="red" className="mx-auto max-w-xl p-6 md:p-10">
      <p className="text-center font-mono text-xs uppercase tracking-[0.4em] text-rose-300">
        ♢ King of Diamonds ♢
      </p>
      <h1 className="mt-3 text-center text-3xl font-semibold tracking-wide">Game Over</h1>
      <p className="mt-6 text-center font-mono text-xs uppercase tracking-[0.3em] text-slate-400">Winner</p>
      <p className="text-center text-3xl font-bold text-cyan-100">{payload.winnerName ?? "—"}</p>
      <div className="mt-8 space-y-2">
        {payload.placements.map((row) => (
          <div
            key={row.playerId}
            className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-4 py-3 font-mono text-sm"
          >
            <span className="text-slate-400">
              {row.placement === 1 ? "1ST" : row.placement === 2 ? "2ND" : row.placement === 3 ? "3RD" : `${row.placement}TH`}
            </span>
            <span className="flex-1 px-3 truncate">{row.name}</span>
            <span className="text-cyan-200">{row.score}</span>
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <NeonButton onClick={onRematch}>Play again</NeonButton>
        <NeonButton variant="ghost" onClick={onLobby}>
          Return to lobby
        </NeonButton>
      </div>
    </GlassPanel>
  );
}
