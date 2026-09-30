import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArenaBackground } from "../components/ArenaBackground";
import { GlassPanel } from "../components/GlassPanel";
import { NeonButton } from "../components/NeonButton";

const RULES = [
  "Choose a number between 0 and 100.",
  "Everyone chooses secretly.",
  "The average is calculated.",
  "The average is multiplied by 0.8.",
  "The closest player wins.",
  "Everyone else loses 1 point.",
  "Reach -10 and you're eliminated.",
  "New rules may appear as the game progresses.",
];

export function RulesPage() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <ArenaBackground />
      <div className="relative z-10 mx-auto max-w-2xl px-4 py-10">
        <GlassPanel className="p-6 md:p-8">
          <h1 className="text-center text-2xl font-semibold tracking-wide">Rules of the Table</h1>
          <ol className="mt-8 space-y-4">
            {RULES.map((rule, i) => (
              <motion.li
                key={rule}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex gap-4"
              >
                <span className="font-mono text-cyan-300">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-slate-200">{rule}</span>
              </motion.li>
            ))}
          </ol>
          <div className="mt-10 flex justify-center">
            <NeonButton onClick={() => navigate("/login")}>Enter the arena</NeonButton>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
