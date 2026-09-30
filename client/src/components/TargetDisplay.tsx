import { motion } from "framer-motion";

export function TargetDisplay({
  target,
  multiplier,
  revealed,
}: {
  target: number | null;
  multiplier: number;
  revealed?: boolean;
}) {
  return (
    <div className="relative mx-auto flex h-40 w-40 items-center justify-center md:h-48 md:w-48">
      <motion.div
        className="absolute inset-0 rounded-full border border-cyan-400/30"
        animate={{ rotate: 360 }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute inset-3 rounded-full border border-rose-500/40"
        animate={{ rotate: -360 }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
      />
      <div className="relative z-10 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-300/80">Target</p>
        <p className="font-mono text-3xl font-bold text-white md:text-4xl">
          {revealed && target != null ? target.toFixed(2) : "??.??"}
        </p>
        <p className="mt-1 font-mono text-xs text-rose-300">× {multiplier.toFixed(2)}</p>
      </div>
    </div>
  );
}
