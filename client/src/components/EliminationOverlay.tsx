import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

export function EliminationOverlay({
  names,
  scores,
}: {
  names: string[];
  scores: number[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-red-950/80 backdrop-blur-md"
      role="alertdialog"
      aria-label="Player eliminated"
    >
      <motion.div
        animate={{ x: [0, -6, 6, -4, 4, 0] }}
        transition={{ duration: 0.45 }}
        className="relative mx-4 w-full max-w-lg overflow-hidden rounded-2xl border border-red-400/50 bg-black/80 p-8 text-center shadow-[0_0_60px_rgba(255,0,40,0.35)]"
      >
        <div className="pointer-events-none absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_center,rgba(255,0,60,0.25),transparent_60%)]" />
        <AlertTriangle className="relative mx-auto mb-4 text-red-400" size={40} />
        <p className="relative font-mono text-sm uppercase tracking-[0.4em] text-red-300">
          ⚠ Player eliminated ⚠
        </p>
        {names.map((name, i) => (
          <div key={name} className="relative mt-6">
            <p className="text-3xl font-semibold tracking-wide text-white">{name}</p>
            <p className="mt-4 font-mono text-xs uppercase tracking-[0.3em] text-slate-400">Score</p>
            <p className="font-mono text-4xl text-red-400">{scores[i]}</p>
            <p className="mt-4 font-mono text-xs uppercase tracking-[0.35em] text-red-300">Eliminated</p>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}
