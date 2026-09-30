import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  port: num("PORT", 3001),
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",
  serverUrl: process.env.SERVER_URL ?? "http://localhost:3001",
  databaseUrl: process.env.DATABASE_URL ?? "",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  sessionSecret: process.env.SESSION_SECRET ?? "dev-only-change-me",
  matchmakingTimeoutMs: num("MATCHMAKING_TIMEOUT_MS", 20_000),
  choiceTimeMs: num("CHOICE_TIME_MS", 15_000),
  reconnectGraceMs: num("RECONNECT_GRACE_MS", 30_000),
  calculationDurationMs: num("CALCULATION_DURATION_MS", 8_000),
  eliminationDurationMs: num("ELIMINATION_DURATION_MS", 4_500),
  resultDurationMs: num("RESULT_DURATION_MS", 5_000),
  countdownMs: 3_000,
  devAuth: process.env.DEV_AUTH === "true" && process.env.NODE_ENV !== "production",
  isProduction: process.env.NODE_ENV === "production",
};

export function productionConfigErrors(): string[] {
  if (!config.isProduction) return [];
  const errors: string[] = [];
  if (config.sessionSecret.length < 32 || config.sessionSecret === "dev-only-change-me") {
    errors.push("SESSION_SECRET must be at least 32 characters in production.");
  }
  if (!config.databaseUrl) errors.push("DATABASE_URL is required in production.");
  if (!config.googleClientId || !config.googleClientSecret) {
    errors.push("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required in production.");
  }
  if (!config.clientUrl.startsWith("https://") || !config.serverUrl.startsWith("https://")) {
    errors.push("CLIENT_URL and SERVER_URL must use HTTPS in production.");
  }
  if (config.devAuth) errors.push("DEV_AUTH must be disabled in production.");
  return errors;
}
