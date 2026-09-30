import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { sound } from "../services/sound";
import { unlockSpeech } from "../services/voice";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface Props {
  children: ReactNode;
  variant?: Variant;
  full?: boolean;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  "aria-label"?: string;
}

const styles: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-rose-600 to-red-500 text-white shadow-[0_0_24px_rgba(255,45,85,0.35)] border border-rose-300/30",
  secondary:
    "bg-cyan-500/10 text-cyan-200 border border-cyan-400/40 shadow-[0_0_18px_rgba(61,231,255,0.15)]",
  danger: "bg-red-950/80 text-red-200 border border-red-500/50",
  ghost: "bg-white/5 text-slate-200 border border-white/10",
};

export function NeonButton({
  children,
  variant = "primary",
  full,
  className = "",
  onClick,
  disabled,
  type = "button",
  ...rest
}: Props) {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      whileHover={disabled ? undefined : { scale: 1.02 }}
      className={`focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 font-mono text-sm font-semibold uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${full ? "w-full" : ""} ${className}`}
      onClick={() => {
        if (disabled) return;
        unlockSpeech();
        sound.play("UI_CLICK");
        onClick?.();
      }}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
