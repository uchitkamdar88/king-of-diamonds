import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArenaBackground } from "../components/ArenaBackground";
import { NeonButton } from "../components/NeonButton";

export function IntroPage() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <ArenaBackground />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center px-6 text-center">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-mono text-xs uppercase tracking-[0.5em] text-cyan-300"
        >
          ♢ Original Game
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-2 font-mono text-[10px] uppercase tracking-[0.4em] text-slate-400"
        >
          Where strategy crowns the worthy
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35 }}
          className="mt-8 text-4xl font-bold tracking-wide text-white drop-shadow-[0_0_30px_rgba(255,45,85,0.35)] md:text-6xl"
        >
          ♢ King of Diamonds ♢
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="mt-4 font-mono text-sm uppercase tracking-[0.35em] text-rose-300"
        >
          Beauty Contest
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-8 max-w-md text-slate-300"
        >
          Your number. Your strategy. Your survival.
        </motion.p>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="mt-10">
          <NeonButton onClick={() => navigate("/rules")}>Enter the arena</NeonButton>
        </motion.div>
      </div>
    </div>
  );
}
