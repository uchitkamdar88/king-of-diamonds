import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { connectSocket, disconnectSocket } from "../services/socket";
import { useAppStore } from "../stores/appStore";

export function useAuthBootstrap() {
  const setUser = useAppStore((s) => s.setUser);
  const setAuthLoading = useAppStore((s) => s.setAuthLoading);
  const user = useAppStore((s) => s.user);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user } = await api.me();
        if (!cancelled) {
          setUser(user);
          connectSocket();
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setUser, setAuthLoading]);

  useEffect(() => {
    if (user) connectSocket();
    else disconnectSocket();
  }, [user]);
}

export function useRequireAuth() {
  const user = useAppStore((s) => s.user);
  const authLoading = useAppStore((s) => s.authLoading);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login", { replace: true });
  }, [authLoading, user, navigate]);

  return { user, authLoading };
}
