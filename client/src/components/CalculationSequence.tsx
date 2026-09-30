import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { CalculationPayload } from "@kod/shared";
import { sound } from "../services/sound";
import { GlassPanel } from "./GlassPanel";

export function CalculationSequence({ payload }: { payload: CalculationPayload }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
    const timers = [
      window.setTimeout(() => setStep(1), 700),
      window.setTimeout(() => setStep(2), 1600),
      window.setTimeout(() => {
        setStep(3);
        sound.play("TARGET_REVEAL");
      }, 2800),
      window.setTimeout(() => setStep(4), 3800),
      window.setTimeout(() => setStep(5), 4800),
    ];
    return () => timers.forEach(clearTimeout);
  }, [payload.round, payload.target]);

  const revealed = step >= 2;

  return (
    <GlassPanel glow="violet" className="p-5 md:p-8">
      <p className="mb-4 text-center font-mono text-xs uppercase tracking-[0.35em] text-violet-200">
        {step === 0 ? "All players locked" : "Calculating average..."}
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {payload.players
          .filter((p) => !p.status || p.choice != null || p.valid !== undefined)
          .map((p, i) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm"
            >
              <span className="truncate text-slate-300">{p.name}</span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={revealed ? String(p.choice) : "hide"}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={p.valid === false ? "text-red-400 line-through" : "text-cyan-200"}
                >
                  {revealed && step >= 2 ? (p.choice ?? "—") : "??"}
                </motion.span>
              </AnimatePresence>
              <span className="sr-only">Reveal order {i + 1}</span>
            </div>
          ))}
      </div>

      {step >= 3 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-400">Average</p>
          <p className="font-mono text-3xl text-white">{payload.average.toFixed(2)}</p>
          <p className="mt-2 font-mono text-cyan-300">× {payload.multiplier.toFixed(2)}</p>
        </motion.div>
      )}

      {step >= 4 && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mt-6 text-center"
        >
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-rose-300">Target</p>
          <p className="font-mono text-5xl font-bold text-rose-200 drop-shadow-[0_0_24px_rgba(255,45,85,0.45)]">
            {payload.target.toFixed(2)}
          </p>
        </motion.div>
      )}

      {step >= 5 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 overflow-x-auto">
          <p className="mb-3 text-center font-mono text-xs uppercase tracking-[0.3em] text-violet-200">
            Comparing distances
          </p>
          <table className="w-full min-w-[280px] font-mono text-sm">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="pb-2">Player</th>
                <th className="pb-2">Choice</th>
                <th className="pb-2">Distance</th>
              </tr>
            </thead>
            <tbody>
              {payload.players.map((p) => (
                <tr
                  key={p.id}
                  className={payload.winnerIds.includes(p.id) ? "text-rose-300" : "text-slate-200"}
                >
                  <td className="py-1">{p.name}</td>
                  <td className="py-1">{p.choice ?? "—"}</td>
                  <td className="py-1">{p.distance != null ? p.distance.toFixed(2) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-center font-mono text-xs text-slate-400">{payload.tieBreak}</p>
          {payload.perfectHit && (
            <p className="mt-2 text-center font-mono text-sm uppercase tracking-[0.3em] text-amber-300">
              Perfect hit
            </p>
          )}
        </motion.div>
      )}
    </GlassPanel>
  );
}
