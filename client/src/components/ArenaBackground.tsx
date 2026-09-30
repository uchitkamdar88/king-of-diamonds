import { motion } from "framer-motion";

export function ArenaBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-slate-950" />
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,45,85,0.18),transparent_35%),radial-gradient(circle_at_80%_30%,rgba(61,231,255,0.12),transparent_40%),radial-gradient(circle_at_50%_80%,rgba(139,92,246,0.12),transparent_45%)]" />
      <div className="noise absolute inset-0" />
      <div className="scanlines absolute inset-0" />
      {Array.from({ length: 18 }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute h-1 w-1 rounded-full bg-cyan-200/70"
          style={{ left: `${(i * 17) % 100}%`, top: `${(i * 29) % 100}%` }}
          animate={{ opacity: [0.2, 0.9, 0.2], y: [0, -12, 0] }}
          transition={{ duration: 3 + (i % 5), repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}
