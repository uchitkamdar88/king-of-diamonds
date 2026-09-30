import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import session from "express-session";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@kod/shared";
import { config, productionConfigErrors } from "./config/env.js";
import {
  authConfig,
  devLogin,
  googleCredentialLogin,
  googleRedirectCallback,
  googleRedirectStart,
  logout,
  me,
} from "./auth/google.js";
import { Matchmaker } from "./matchmaking/matchmaker.js";
import { RoomManager } from "./rooms/manager.js";
import { registerSockets } from "./websocket/index.js";
import { checkDatabase, listLeaderboard } from "./database/users.js";

const app = express();
const server = http.createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: config.clientUrl,
    credentials: true,
  },
  pingTimeout: 20000,
  pingInterval: 8000,
});

const sessionMiddleware = session({
  name: "kod.sid",
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: config.isProduction ? "none" : "lax",
    secure: config.isProduction,
    maxAge: 1000 * 60 * 60 * 24 * 14,
  },
});

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
});
app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
  }),
);
app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());
app.use(sessionMiddleware);

io.engine.use(sessionMiddleware);

const rooms = new RoomManager(io);
const matchmaker = new Matchmaker(rooms);
registerSockets(io, rooms, matchmaker);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "king-of-diamonds" });
});

app.post("/auth/google", googleCredentialLogin);
app.get("/auth/google", googleRedirectStart);
app.get("/auth/google/callback", googleRedirectCallback);
app.get("/auth/config", authConfig);
app.get("/auth/me", me);
app.post("/auth/logout", logout);
app.post("/auth/dev", devLogin);

app.get("/api/leaderboard", async (_req, res) => {
  try {
    const users = await listLeaderboard(20);
    res.json({
      entries: users.map((u, i) => ({
        rank: i + 1,
        name: u.name,
        avatar: u.avatar,
        gamesPlayed: u.gamesPlayed,
        gamesWon: u.gamesWon,
        winRate: u.gamesPlayed === 0 ? 0 : Math.round((u.gamesWon / u.gamesPlayed) * 1000) / 10,
        bestScore: u.bestScore,
      })),
    });
  } catch {
    res.status(503).json({ error: "Leaderboard unavailable." });
  }
});

const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
app.use(express.static(clientDist));
app.get("/{*splat}", (req, res, next) => {
  if (req.path.startsWith("/auth") || req.path.startsWith("/api") || req.path.startsWith("/socket.io")) {
    next();
    return;
  }
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) next();
  });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[server] Unhandled error:", err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error." });
  }
});

void checkDatabase().then((ok) => {
  const configErrors = productionConfigErrors();
  if (configErrors.length || (config.isProduction && !ok)) {
    for (const error of configErrors) console.error(`[kod] ${error}`);
    if (config.isProduction && !ok) console.error("[kod] PostgreSQL is required in production.");
    process.exitCode = 1;
    return;
  }
  server.listen(config.port, () => {
    console.log(`King of Diamonds server on ${config.serverUrl}`);
    console.log(`Database: ${ok ? "PostgreSQL connected" : "in-memory fallback"}`);
  });
});
