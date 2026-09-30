import type { UserProfile } from "@kod/shared";

/**
 * In local Vite, leave VITE_SERVER_URL empty to use the same-origin proxy
 * (cookies stay consistent with /auth via proxy only if the Set-Cookie host matches).
 * For Google OAuth redirects, the API must be absolute so the session cookie is set
 * on the API host — use VITE_SERVER_URL=http://localhost:3001 in development.
 */
const base = (import.meta.env.VITE_SERVER_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export type AuthConfig = {
  googleConfigured: boolean;
  googleClientIdConfigured: boolean;
  devAuth: boolean;
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error ?? "Request failed") as Error & {
      code?: string;
    };
    err.code = (data as { code?: string }).code;
    throw err;
  }
  return data as T;
}

export const api = {
  baseUrl: base,
  me: () => req<{ user: UserProfile }>("/auth/me"),
  authConfig: () => req<AuthConfig>("/auth/config"),
  logout: () => req<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  googleCredential: (credential: string) =>
    req<{ user: UserProfile }>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    }),
  devLogin: (slot = "1") =>
    req<{ user: UserProfile }>("/auth/dev", {
      method: "POST",
      body: JSON.stringify({ slot }),
    }),
  leaderboard: () =>
    req<{
      entries: Array<{
        rank: number;
        name: string;
        avatar: string | null;
        gamesPlayed: number;
        gamesWon: number;
        winRate: number;
        bestScore: number | null;
      }>;
    }>("/api/leaderboard"),
  /** Absolute API URL required so Google can redirect back to the server callback. */
  googleRedirectUrl: () => {
    const server = base || (typeof window !== "undefined" ? window.location.origin : "");
    return `${server}/auth/google`;
  },
};

export function authErrorMessage(code: string | null): string {
  switch (code) {
    case "cancelled":
      return "Google sign-in was cancelled.";
    case "config":
      return "Authentication configuration is incomplete. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.";
    case "redirect":
      return "The redirect URL is not authorized in Google Cloud Console.";
    case "exchange":
      return "Google authentication failed while exchanging the login code.";
    case "state":
      return "Login security check failed. Please try again.";
    case "session":
    case "session_expired":
      return "Your session could not be established.";
    case "google":
      return "Google authentication failed.";
    default:
      return code ? "Google authentication failed." : "";
  }
}
