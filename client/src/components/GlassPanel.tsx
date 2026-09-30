import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  glow?: "red" | "blue" | "violet" | "none";
}

const glowMap = {
  red: "shadow-[0_0_40px_rgba(255,45,85,0.12)] border-rose-500/30",
  blue: "shadow-[0_0_40px_rgba(61,231,255,0.12)] border-cyan-400/30",
  violet: "shadow-[0_0_40px_rgba(139,92,246,0.12)] border-violet-400/30",
  none: "border-white/10",
};

export function GlassPanel({ children, className = "", glow = "blue" }: Props) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-slate-950/70 backdrop-blur-xl ${glowMap[glow]} ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-cyan-500/5" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
