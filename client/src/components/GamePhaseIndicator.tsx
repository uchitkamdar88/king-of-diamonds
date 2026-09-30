import type { GamePhase } from "@kod/shared";

const labels: Record<GamePhase, string> = {
  WAITING_FOR_PLAYERS: "Waiting",
  LOBBY: "Lobby",
  COUNTDOWN: "Countdown",
  CHOOSING: "Choose",
  LOCKED: "Locked",
  CALCULATING: "Calculating",
  RESULT: "Result",
  ELIMINATION: "Elimination",
  NEXT_ROUND: "Next Round",
  GAME_OVER: "Game Over",
};

export function GamePhaseIndicator({ phase }: { phase: GamePhase }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-200">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" aria-hidden />
      {labels[phase]}
    </span>
  );
}
