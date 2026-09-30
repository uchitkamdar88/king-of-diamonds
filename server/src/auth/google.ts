import type { Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import type { UserProfile } from "@kod/shared";
import { config } from "../config/env.js";
import { findUserById, upsertGoogleIdentity } from "../database/users.js";

const google = new OAuth2Client(
  config.googleClientId,
  config.googleClientSecret,
  `${config.serverUrl}/auth/google/callback`,
);

declare module "express-session" {
  interface SessionData {
    userId?: string;
    oauthState?: string;
  }
}

export function toProfile(user: {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  gamesPlayed: number;
  gamesWon: number;
  totalWins: number;
  totalLosses: number;
  bestScore: number | null;
}): UserProfile {
  const winRate =
    user.gamesPlayed === 0 ? 0 : Math.round((user.gamesWon / user.gamesPlayed) * 1000) / 10;
  return { ...user, winRate };
}

function clientLoginUrl(query?: Record<string, string>): string {
  const url = new URL("/login", config.clientUrl);
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  }
  return url.toString();
}

function clientCallbackUrl(): string {
  return new URL("/auth/callback", config.clientUrl).toString();
}

function mapOAuthError(code: string | undefined): string {
  switch (code) {
    case "access_denied":
      return "cancelled";
    case "redirect_uri_mismatch":
      return "redirect";
    case "invalid_client":
      return "config";
    case "invalid_grant":
    case "exchange_code_error":
      return "exchange";
    case "missing_code":
      return "exchange";
    case "state":
      return "state";
    case "no_id_token":
      return "exchange";
    case "not_configured":
      return "config";
    default:
      return "google";
  }
}

export async function verifyGoogleIdToken(idToken: string) {
  if (!config.googleClientId) {
    throw new Error("Google OAuth is not configured.");
  }
  const ticket = await google.verifyIdToken({
    idToken,
    audience: config.googleClientId,
  });
  const p = ticket.getPayload();
  if (!p?.sub || !p.email) throw new Error("Invalid Google token");
  return {
    googleId: p.sub,
    name: p.name ?? p.email.split("@")[0],
    email: p.email,
    avatar: p.picture ?? null,
  };
}

export function authConfig(_req: Request, res: Response): void {
  res.json({
    googleConfigured: Boolean(config.googleClientId && config.googleClientSecret),
    googleClientIdConfigured: Boolean(config.googleClientId),
    devAuth: config.devAuth,
  });
}

export async function googleCredentialLogin(req: Request, res: Response): Promise<void> {
  try {
    if (!config.googleClientId) {
      res.status(503).json({
        error: "Authentication configuration is incomplete.",
        code: "not_configured",
      });
      return;
    }
    const token = String(req.body?.credential ?? "");
    if (!token || token.length > 4096) {
      res.status(400).json({ error: "Missing Google credential.", code: "missing_credential" });
      return;
    }
    const identity = await verifyGoogleIdToken(token);
    const user = await upsertGoogleIdentity(identity);
    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) {
        console.error("[auth] session save failed", err);
        res.status(500).json({ error: "Your session could not be established.", code: "session" });
        return;
      }
      res.json({ user: toProfile(user) });
    });
  } catch (err) {
    console.error("[auth] Google credential login failed", err);
    res.status(401).json({
      error: "Google authentication failed.",
      code: "google",
    });
  }
}

export function googleRedirectStart(req: Request, res: Response): void {
  if (!config.googleClientId || !config.googleClientSecret) {
    res.redirect(clientLoginUrl({ error: "config" }));
    return;
  }
  const state = randomBytes(16).toString("hex");
  req.session.oauthState = state;
  req.session.save((err) => {
    if (err) {
      console.error("[auth] oauth state save failed", err);
      res.redirect(clientLoginUrl({ error: "session" }));
      return;
    }
    const url = google.generateAuthUrl({
      access_type: "online",
      scope: ["openid", "email", "profile"],
      prompt: "select_account",
      state,
      include_granted_scopes: true,
    });
    res.redirect(url);
  });
}

export async function googleRedirectCallback(req: Request, res: Response): Promise<void> {
  try {
    const oauthError = typeof req.query.error === "string" ? req.query.error : undefined;
    if (oauthError) {
      console.warn("[auth] Google returned error:", oauthError, req.query.error_description);
      res.redirect(clientLoginUrl({ error: mapOAuthError(oauthError) }));
      return;
    }

    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    if (!code) {
      res.redirect(clientLoginUrl({ error: "exchange" }));
      return;
    }
    if (!req.session.oauthState || state !== req.session.oauthState) {
      console.warn("[auth] OAuth state mismatch");
      res.redirect(clientLoginUrl({ error: "state" }));
      return;
    }
    delete req.session.oauthState;

    const { tokens } = await google.getToken(code);
    if (!tokens.id_token) {
      res.redirect(clientLoginUrl({ error: "exchange" }));
      return;
    }
    const identity = await verifyGoogleIdToken(tokens.id_token);
    const user = await upsertGoogleIdentity(identity);
    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) {
        console.error("[auth] session save after Google callback failed", err);
        res.redirect(clientLoginUrl({ error: "session" }));
        return;
      }
      res.redirect(clientCallbackUrl());
    });
  } catch (err) {
    console.error("[auth] Google redirect callback failed", err);
    const message = err instanceof Error ? err.message : "";
    if (/redirect_uri/i.test(message)) {
      res.redirect(clientLoginUrl({ error: "redirect" }));
      return;
    }
    if (/invalid_client/i.test(message)) {
      res.redirect(clientLoginUrl({ error: "config" }));
      return;
    }
    res.redirect(clientLoginUrl({ error: "google" }));
  }
}

export async function me(req: Request, res: Response): Promise<void> {
  try {
    if (!req.session.userId) {
      res.status(401).json({ error: "Session expired. Sign in again.", code: "session_expired" });
      return;
    }
    const user = await findUserById(req.session.userId);
    if (!user) {
      res.status(401).json({ error: "Session expired. Sign in again.", code: "session_expired" });
      return;
    }
    res.json({ user: toProfile(user) });
  } catch (err) {
    console.error("[auth] me error", err);
    res.status(500).json({ error: "Failed to load session profile." });
  }
}

export function logout(req: Request, res: Response): void {
  req.session.destroy((err) => {
    if (err) {
      console.error("[auth] logout failed", err);
      res.status(500).json({ error: "Could not clear session." });
      return;
    }
    res.clearCookie("kod.sid", {
      httpOnly: true,
      sameSite: config.isProduction ? "none" : "lax",
      secure: config.isProduction,
    });
    res.json({ ok: true });
  });
}

export async function devLogin(req: Request, res: Response): Promise<void> {
  try {
    if (!config.devAuth) {
      res.status(403).json({ error: "Dev auth is disabled.", code: "dev_disabled" });
      return;
    }
    const slot = String(req.body?.slot ?? "1").replace(/[^\w-]/g, "").slice(0, 8) || "1";
    const googleId = `dev-${slot}`;
    const user = await upsertGoogleIdentity({
      googleId,
      name: `Player ${slot}`,
      email: `dev${slot}@kod.local`,
      avatar: null,
    });
    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) {
        res.status(500).json({ error: "Your session could not be established.", code: "session" });
        return;
      }
      res.json({ user: toProfile(user) });
    });
  } catch (err) {
    console.error("[auth] devLogin error", err);
    res.status(500).json({ error: "Dev login failed." });
  }
}
