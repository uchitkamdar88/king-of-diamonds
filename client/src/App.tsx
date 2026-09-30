import { AnimatePresence, motion } from "framer-motion";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { NoticeToast } from "./components/NoticeToast";
import { useAuthBootstrap } from "./hooks/useAuth";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { ArenaPage } from "./pages/ArenaPage";
import { CreateRoomPage } from "./pages/CreateRoomPage";
import { IntroPage } from "./pages/IntroPage";
import { JoinRoomPage } from "./pages/JoinRoomPage";
import { LobbyPage } from "./pages/LobbyPage";
import { LoginPage } from "./pages/LoginPage";
import { MatchmakingPage } from "./pages/MatchmakingPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RoomLobbyPage } from "./pages/RoomLobbyPage";
import { RulesPage } from "./pages/RulesPage";
import { useAppStore } from "./stores/appStore";

export default function App() {
  useAuthBootstrap();
  const location = useLocation();
  const authLoading = useAppStore((s) => s.authLoading);

  const bootExempt =
    location.pathname === "/" ||
    location.pathname === "/rules" ||
    location.pathname === "/login" ||
    location.pathname === "/auth/callback";

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {authLoading && !bootExempt ? (
            <div className="flex min-h-dvh items-center justify-center bg-slate-950 font-mono text-cyan-200">
              Synchronizing session...
            </div>
          ) : (
            <Routes location={location}>
              <Route path="/" element={<IntroPage />} />
              <Route path="/rules" element={<RulesPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/lobby" element={<LobbyPage />} />
              <Route path="/matchmaking" element={<MatchmakingPage />} />
              <Route path="/create" element={<CreateRoomPage />} />
              <Route path="/join" element={<JoinRoomPage />} />
              <Route path="/room" element={<RoomLobbyPage />} />
              <Route path="/arena" element={<ArenaPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
        </motion.div>
      </AnimatePresence>
      <NoticeToast />
    </>
  );
}
