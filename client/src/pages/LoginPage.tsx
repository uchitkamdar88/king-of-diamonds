import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArenaBackground } from "../components/ArenaBackground";
import { GlassPanel } from "../components/GlassPanel";
import { NeonButton } from "../components/NeonButton";
import { api, authErrorMessage, type AuthConfig } from "../services/api";
import { connectSocket } from "../services/socket";
import { unlockSpeech } from "../services/voice";
import { useAppStore } from "../stores/appStore";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: {
            client_id: string;
            callback: (res: { credential: string }) => void;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            el: HTMLElement,
            cfg: { theme: string; size: string; width: number; shape: string; text: string },
          ) => void;
        };
      };
    };
  }
}

export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setUser = useAppStore((s) => s.setUser);
  const setNotice = useAppStore((s) => s.setNotice);
  const user = useAppStore((s) => s.user);
  const btnRef = useRef<HTMLDivElement>(null);
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();
  const error = params.get("error");
  const [cfg, setCfg] = useState<AuthConfig | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate("/profile", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    const msg = authErrorMessage(error);
    if (msg) setNotice(msg);
  }, [error, setNotice]);

  useEffect(() => {
    let cancelled = false;
    void api
      .authConfig()
      .then((c) => {
        if (!cancelled) setCfg(c);
      })
      .catch(() => {
        if (!cancelled) {
          setCfg({ googleConfigured: false, googleClientIdConfigured: false, devAuth: false });
          setNotice("Server unavailable. Start the API and try again.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [setNotice]);

  useEffect(() => {
    if (!clientId || !btnRef.current || !cfg?.googleConfigured) return;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      if (!window.google || !btnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        cancel_on_tap_outside: true,
        callback: async (res) => {
          unlockSpeech();
          setBusy(true);
          try {
            const { user } = await api.googleCredential(res.credential);
            setUser(user);
            connectSocket();
            navigate("/profile", { replace: true });
          } catch (e) {
            const err = e as Error & { code?: string };
            console.error("[auth] GIS credential login failed", err);
            setNotice(authErrorMessage(err.code ?? "google") || err.message);
          } finally {
            setBusy(false);
          }
        },
      });
      window.google.accounts.id.renderButton(btnRef.current, {
        theme: "filled_black",
        size: "large",
        width: 320,
        shape: "pill",
        text: "continue_with",
      });
    };
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, [clientId, cfg?.googleConfigured, navigate, setUser, setNotice]);

  // Redirect-based flow removed; using Google One Tap (GIS) only.

  const devLogin = async (slot: string) => {
    unlockSpeech();
    setBusy(true);
    try {
      const { user } = await api.devLogin(slot);
      setUser(user);
      connectSocket();
      navigate("/profile", { replace: true });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Dev login unavailable.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <ArenaBackground />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
          <GlassPanel glow="red" className="p-8 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.45em] text-cyan-300">♢ King of Diamonds</p>
            <h1 className="mt-6 text-3xl font-bold tracking-wide md:text-4xl">The number is your weapon.</h1>
            <p className="mt-3 text-slate-400">Continue with Google to enter the multiplayer arena.</p>

            <div className="mt-8">
              {clientId && cfg?.googleConfigured ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.4 }}
                  className="group relative flex flex-col items-center gap-3"
                >
                  {/* Decorative label */}
                  <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-slate-500">
                    Sign in to continue
                  </p>

                  {/* Glow ring wrapper */}
                  <div className="relative rounded-full p-[2px] transition-all duration-500"
                    style={{
                      background: "linear-gradient(135deg, rgba(99,102,241,0.6), rgba(236,72,153,0.6), rgba(99,102,241,0.6))",
                      boxShadow: "0 0 24px rgba(99,102,241,0.35), 0 0 48px rgba(236,72,153,0.15)",
                    }}
                  >
                    <div className="rounded-full bg-[#0d1117] px-1 py-1">
                      <div ref={btnRef} className="min-h-12" aria-label="Google One Tap sign-in" />
                    </div>
                  </div>

                  {/* Subtle shimmer hint */}
                  <p className="text-[11px] text-slate-600">
                    Secured by Google OAuth
                  </p>
                </motion.div>
              ) : cfg !== null && !cfg.googleConfigured ? null : (
                /* Loading skeleton */
                <div className="flex justify-center">
                  <div className="h-12 w-64 animate-pulse rounded-full bg-white/5" />
                </div>
              )}
            </div>

            {cfg && !cfg.googleConfigured && (
              <p className="mt-4 font-mono text-[10px] leading-relaxed text-amber-300/90">
                Google OAuth is not configured on the server. Set GOOGLE_CLIENT_ID and
                GOOGLE_CLIENT_SECRET (and VITE_GOOGLE_CLIENT_ID), then restart.
              </p>
            )}

            {cfg?.devAuth && (
              <div className="mt-8 border-t border-white/10 pt-6">
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-slate-500">
                  Local multiplayer testing only
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <NeonButton variant="ghost" disabled={busy} onClick={() => void devLogin("1")}>
                    Dev Player 1
                  </NeonButton>
                  <NeonButton variant="ghost" disabled={busy} onClick={() => void devLogin("2")}>
                    Dev Player 2
                  </NeonButton>
                </div>
              </div>
            )}

            <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.35em] text-slate-500">
              ♢ King of Diamonds — Outsmart. Outplay. Outlast.
            </p>
          </GlassPanel>
        </motion.div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l.1.1 6.2 5.2C39.2 36.3 44 31 44 24c0-1.3-.1-2.5-.4-3.5z" />
    </svg>
  );
}
