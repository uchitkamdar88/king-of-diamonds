import { AnimatePresence, motion } from "framer-motion";

export function Countdown({ seconds, label }: { seconds: number; label?: string }) {
  return (
    <div className="text-center" aria-live="polite">
      {label && (
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-cyan-300/80">{label}</p>
      )}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={seconds}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.2, opacity: 0 }}
          className="font-mono text-5xl font-bold text-white drop-shadow-[0_0_18px_rgba(61,231,255,0.45)] md:text-6xl"
        >
          {String(seconds).padStart(2, "0")}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
