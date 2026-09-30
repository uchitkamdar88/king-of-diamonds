import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { CalculationPayload } from "@kod/shared";
import { sound } from "../services/sound";
import { announceWinner, unlockSpeech } from "../services/voice";

export function WinnerOverlay({
  payload,
  announcementKey,
}: {
  payload: CalculationPayload;
  /** Unique per round result so voice plays once across re-renders. */
  announcementKey: string;
}) {
  const winners = payload.players.filter((p) => payload.winnerIds.includes(p.id));
  const spokenRef = useRef<string | null>(null);
  const winnerNames = winners.map((w) => w.name).join(" and ");

  useEffect(() => {
    if (!winnerNames) return;
    if (spokenRef.current === announcementKey) return;
    spokenRef.current = announcementKey;

    unlockSpeech();
    sound.play("WINNER");

    const timer = window.setTimeout(() => {
      announceWinner(winnerNames, announcementKey);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [announcementKey, winnerNames]);

  if (!winners.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-label="Round winner"
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 16 }}
        animate={{
          scale: 1,
          opacity: 1,
          y: 0,
          x: [0, -3, 3, -2, 2, 0],
        }}
        transition={{ duration: 0.55, x: { duration: 0.35, delay: 0.15 } }}
        className="relative mx-4 w-full max-w-lg overflow-hidden rounded-2xl border border-rose-400/50 bg-slate-950/95 p-8 text-center shadow-[0_0_60px_rgba(255,45,85,0.35)]"
      >
        <motion.div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,45,85,0.22),transparent_55%)]"
          animate={{ opacity: [0.4, 0.85, 0.4] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        />
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.span
            key={i}
            className="pointer-events-none absolute h-1 w-1 rounded-full bg-rose-200"
            style={{ left: `${8 + ((i * 7) % 84)}%`, top: `${12 + ((i * 11) % 70)}%` }}
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1.4, 0.5] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.1 }}
          />
        ))}

        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative font-mono text-xs uppercase tracking-[0.45em] text-rose-200"
        >
          ♢ Winner ♢
        </motion.p>

        {winners.map((w) => (
          <div key={w.id} className="relative mt-5">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: [1, 1.08, 1], opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-rose-300/60 text-2xl text-rose-200 shadow-[0_0_24px_rgba(255,45,85,0.45)]"
              aria-hidden
            >
              ♢
            </motion.div>
            <motion.p
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 160 }}
              className="text-3xl font-semibold tracking-wide text-white drop-shadow-[0_0_18px_rgba(255,45,85,0.4)] md:text-4xl"
            >
              {w.name}
            </motion.p>
            <p className="mt-3 font-mono text-4xl text-cyan-100">{w.choice}</p>
            <p className="mt-2 font-mono text-xs uppercase tracking-[0.3em] text-slate-300">
              Closest to target
            </p>
          </div>
        ))}

        {payload.perfectHit && (
          <p className="relative mt-4 font-mono text-sm uppercase tracking-[0.35em] text-amber-300">
            Perfect hit
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}
