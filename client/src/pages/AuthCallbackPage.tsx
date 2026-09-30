import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArenaBackground } from "../components/ArenaBackground";
import { GlassPanel } from "../components/GlassPanel";
import { api, authErrorMessage } from "../services/api";
import { connectSocket } from "../services/socket";
import { unlockSpeech } from "../services/voice";
import { useAppStore } from "../stores/appStore";

/**
 * Landing page after Google OAuth server callback.
 * Confirms the session cookie, loads profile, then enters the game.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate();
  const setUser = useAppStore((s) => s.setUser);
  const setNotice = useAppStore((s) => s.setNotice);
  const setAuthLoading = useAppStore((s) => s.setAuthLoading);
  const [status, setStatus] = useState("Establishing session...");

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const run = async () => {
      unlockSpeech();
      while (!cancelled && attempts < 8) {
        attempts += 1;
        try {
          const { user } = await api.me();
          if (cancelled) return;
          setUser(user);
          setAuthLoading(false);
          connectSocket();
          setStatus("Profile loaded. Entering arena...");
          navigate("/profile", { replace: true });
          return;
        } catch (e) {
          const code = (e as Error & { code?: string }).code;
          if (attempts >= 8) {
            setNotice(authErrorMessage(code ?? "session") || "Your session could not be established.");
            setAuthLoading(false);
            navigate("/login?error=session", { replace: true });
            return;
          }
          setStatus(`Synchronizing session (${attempts}/8)...`);
          await new Promise((r) => window.setTimeout(r, 350));
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [navigate, setUser, setNotice, setAuthLoading]);

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <ArenaBackground />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md items-center px-4">
        <GlassPanel className="w-full p-8 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-cyan-300">♢ King of Diamonds</p>
          <p className="mt-6 font-mono text-sm text-slate-200">{status}</p>
        </GlassPanel>
      </div>
    </div>
  );
}
