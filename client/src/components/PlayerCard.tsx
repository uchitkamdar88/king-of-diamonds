import { motion } from "framer-motion";
import { Bot, Crown, Wifi, WifiOff } from "lucide-react";
import type { PublicPlayer } from "@kod/shared";

const statusColor: Record<PublicPlayer["status"], string> = {
  WAITING: "text-slate-400",
  READY: "text-emerald-400",
  THINKING: "text-amber-300",
  LOCKED: "text-cyan-300",
  WINNER: "text-rose-300",
  ELIMINATED: "text-red-500",
  DISCONNECTED: "text-orange-400",
};

export function PlayerCard({ player, compact }: { player: PublicPlayer; compact?: boolean }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border border-white/10 bg-slate-900/80 p-3 ${
        player.status === "ELIMINATED" ? "opacity-50 grayscale" : ""
      } ${player.status === "WINNER" ? "border-rose-400/50 shadow-[0_0_20px_rgba(255,45,85,0.25)]" : ""}`}
    >
      <div className="flex items-center gap-3">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-cyan-400/30 bg-slate-800">
          {player.avatar ? (
            <img src={player.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-mono text-cyan-300">
              {player.isAI ? <Bot size={18} /> : player.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          {player.isHost && (
            <Crown size={12} className="absolute -right-1 -top-1 text-amber-300" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium tracking-wide">{player.name}</p>
            {player.isAI && (
              <span className="rounded bg-violet-500/20 px-1.5 py-0.5 font-mono text-[10px] text-violet-300">
                AI
              </span>
            )}
          </div>
          {!compact && (
            <p className={`font-mono text-xs uppercase tracking-widest ${statusColor[player.status]}`}>
              {player.status}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="font-mono text-lg text-white tabular-nums">{player.score}</p>
          <span className="sr-only">Score {player.score}</span>
          <div className="mt-1 flex justify-end text-slate-400" aria-label={player.connected ? "Connected" : "Disconnected"}>
            {player.connected ? <Wifi size={12} className="text-emerald-400" /> : <WifiOff size={12} className="text-orange-400" />}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
