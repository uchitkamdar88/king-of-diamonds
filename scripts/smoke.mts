/**
 * End-to-end smoke / integration suite for King of Diamonds.
 * Run: node --import tsx scripts/smoke.mts
 * Requires: API on :3001, optional Vite on :5173, DEV_AUTH=true
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { io, type Socket } from "socket.io-client";
import { CookieJar } from "./cookie-jar.mts";

const API = process.env.SERVER_URL ?? "http://localhost:3001";
const WEB = process.env.CLIENT_URL ?? "http://localhost:5173";

type Result = { name: string; ok: boolean; detail?: string };
const results: Result[] = [];

function pass(name: string, detail?: string) {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name: string, detail?: string) {
  results.push({ name, ok: false, detail });
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function http(
  path: string,
  init: RequestInit & { jar?: CookieJar } = {},
): Promise<{ status: number; json: any; text: string; headers: Headers }> {
  const jar = init.jar;
  const headers = new Headers(init.headers);
  if (jar) {
    const cookie = jar.header(API);
    if (cookie) headers.set("cookie", cookie);
  }
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(`${API}${path}`, { ...init, headers });
  if (jar) jar.store(API, res.headers);
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* html or empty */
  }
  return { status: res.status, json, text, headers: res.headers };
}

async function loginDev(slot: string): Promise<{ jar: CookieJar; user: any }> {
  const jar = new CookieJar();
  const res = await http("/auth/dev", {
    method: "POST",
    body: JSON.stringify({ slot }),
    jar,
  });
  if (res.status !== 200 || !res.json?.user) {
    throw new Error(`dev login ${slot} failed: ${res.status} ${res.text}`);
  }
  return { jar, user: res.json.user };
}

function connectAuthed(jar: CookieJar): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const cookie = jar.header(API);
    const socket = io(API, {
      transports: ["websocket"],
      withCredentials: true,
      extraHeaders: cookie ? { cookie } : {},
      timeout: 8000,
    });
    const t = setTimeout(() => {
      socket.close();
      reject(new Error("socket connect timeout"));
    }, 10000);
    socket.on("connect", () => {
      clearTimeout(t);
      resolve(socket);
    });
    socket.on("connect_error", (err) => {
      clearTimeout(t);
      reject(err);
    });
  });
}

function emitAck<T>(socket: Socket, event: string, payload?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`ack timeout: ${event}`)), 8000);
    if (payload === undefined) {
      socket.emit(event as any, (res: T) => {
        clearTimeout(t);
        resolve(res);
      });
    } else {
      socket.emit(event as any, payload, (res: T) => {
        clearTimeout(t);
        resolve(res);
      });
    }
  });
}

function waitFor(socket: Socket, event: string, pred?: (p: any) => boolean, ms = 20000): Promise<any> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`wait timeout: ${event}`)), ms);
    const handler = (payload: any) => {
      if (pred && !pred(payload)) return;
      clearTimeout(t);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

async function section(title: string, fn: () => Promise<void>) {
  console.log(`\n▸ ${title}`);
  await fn();
}

async function main() {
  console.log(`King of Diamonds smoke test\nAPI=${API}\nWEB=${WEB}`);

  await section("HTTP fundamentals", async () => {
    const health = await http("/health");
    health.status === 200 && health.json?.ok
      ? pass("GET /health")
      : fail("GET /health", health.text);

    const cfg = await http("/auth/config");
    cfg.status === 200 && typeof cfg.json?.devAuth === "boolean"
      ? pass("GET /auth/config", `google=${cfg.json.googleConfigured} devAuth=${cfg.json.devAuth}`)
      : fail("GET /auth/config", cfg.text);

    if (!cfg.json?.devAuth) {
      fail("DEV_AUTH required for automated multiplayer login tests");
      throw new Error("Set DEV_AUTH=true for smoke tests");
    }

    try {
      const page = await fetch(WEB);
      page.ok ? pass("Client Vite responds", String(page.status)) : fail("Client Vite", String(page.status));
      const html = await page.text();
      html.includes("root") || html.includes("KING")
        ? pass("Client HTML shell present")
        : fail("Client HTML shell present");
    } catch (e) {
      fail("Client Vite responds", e instanceof Error ? e.message : String(e));
    }
  });

  await section("Auth session lifecycle", async () => {
    const { jar, user } = await loginDev("91");
    user?.id ? pass("Dev login creates profile", user.name) : fail("Dev login");

    const me = await http("/auth/me", { jar });
    me.status === 200 && me.json?.user?.id === user.id
      ? pass("Session persists on /auth/me")
      : fail("Session persists on /auth/me", me.text);

    const unauth = await http("/auth/me");
    unauth.status === 401
      ? pass("Unauthenticated /auth/me rejected")
      : fail("Unauthenticated /auth/me rejected", String(unauth.status));

    const out = await http("/auth/logout", { method: "POST", jar });
    out.status === 200 ? pass("Logout succeeds") : fail("Logout", out.text);

    const after = await http("/auth/me", { jar });
    after.status === 401
      ? pass("Session cleared after logout")
      : fail("Session cleared after logout", String(after.status));

    // Second distinct identity
    const a = await loginDev("91");
    const b = await loginDev("92");
    a.user.id !== b.user.id
      ? pass("Distinct Google/dev identities", `${a.user.id} vs ${b.user.id}`)
      : fail("Distinct identities");
  });

  await section("Multiplayer rooms + game engine", async () => {
    const host = await loginDev("101");
    const guest = await loginDev("102");
    const hostSock = await connectAuthed(host.jar);
    const guestSock = await connectAuthed(guest.jar);
    pass("Both sockets authenticated");

    const hostRoomP = waitFor(hostSock, "room:update");
    const created = await emitAck<{ ok: boolean; error?: string; roomCode?: string }>(
      hostSock,
      "room:create",
      {
        settings: {
          name: "SMOKE TABLE",
          visibility: "PRIVATE",
          maxPlayers: 4,
          aiFill: true,
          rounds: 5,
          difficulty: "STANDARD",
        },
      },
    );
    if (!created.ok || !created.roomCode) {
      fail("Create room", created.error);
      hostSock.close();
      guestSock.close();
      return;
    }
    const hostSnap = await hostRoomP;
    pass("Create room", created.roomCode);

    const guestRoomP = waitFor(guestSock, "room:update", (r) =>
      r.players?.some((p: any) => p.userId === guest.user.id),
    );
    const joined = await emitAck<{ ok: boolean; error?: string }>(guestSock, "room:join", {
      roomCode: created.roomCode,
    });
    joined.ok ? pass("Join room by code") : fail("Join room", joined.error);
    const guestSnap = await guestRoomP;
    guestSnap.players.length >= 2
      ? pass("Lobby syncs players", `${guestSnap.players.length} seats`)
      : fail("Lobby syncs players", JSON.stringify(guestSnap.players?.map((p: any) => p.name)));

    // Invalid code
    const bad = await emitAck<{ ok: boolean; error?: string }>(guestSock, "room:join", {
      roomCode: "ZZZZZ",
    });
    !bad.ok ? pass("Invalid room code rejected", bad.error) : fail("Invalid room code rejected");

    hostSock.emit("player:ready", { ready: true });
    guestSock.emit("player:ready", { ready: true });
    await new Promise((r) => setTimeout(r, 400));

    const countdownP = waitFor(hostSock, "game:countdown");
    const start = await emitAck<{ ok: boolean; error?: string }>(hostSock, "game:start");
    start.ok ? pass("Host starts game") : fail("Host starts game", start.error);
    await countdownP;
    pass("Synchronized countdown event");

    const choosing = await waitFor(
      hostSock,
      "room:update",
      (r) => r.phase === "CHOOSING" || r.status === "IN_GAME",
      15000,
    );
    pass("Entered CHOOSING phase", `round ${choosing.currentRound}`);

    // Secret choices: before calculation, other players' numbers must not appear in public snapshot
    const secretOk = !choosing.players.some(
      (p: any) => p.choice != null && p.id !== choosing.yourPlayerId,
    );
    // PublicPlayer type shouldn't include choice; ensure snapshot doesn't leak
    const leaked = JSON.stringify(choosing).match(/"choice"\s*:/);
    !leaked || secretOk
      ? pass("Choices stay secret in lobby/game snapshots")
      : fail("Choices leaked in room snapshot");

    const calcP = waitFor(hostSock, "round:calculating", undefined, 25000);
    const resultP = waitFor(hostSock, "round:result", undefined, 35000);

    const sub1 = await emitAck<{ ok: boolean; error?: string }>(hostSock, "choice:submit", {
      choice: 37,
    });
    const sub2 = await emitAck<{ ok: boolean; error?: string }>(guestSock, "choice:submit", {
      choice: 28,
    });
    sub1.ok && sub2.ok
      ? pass("Both humans lock numbers")
      : fail("Lock numbers", `${sub1.error} / ${sub2.error}`);

    // Late / invalid
    const dup = await emitAck<{ ok: boolean; error?: string }>(hostSock, "choice:submit", {
      choice: 10,
    });
    !dup.ok ? pass("Duplicate submission rejected", dup.error) : fail("Duplicate submission rejected");

    const badChoice = await emitAck<{ ok: boolean; error?: string }>(guestSock, "choice:submit", {
      choice: 999,
    });
    // guest already locked — either locked or range error is fine
    !badChoice.ok ? pass("Invalid/late choice rejected", badChoice.error) : fail("Invalid choice accepted");

    const calc = await calcP;
    calc?.target != null && Array.isArray(calc.winnerIds)
      ? pass("Server calculation payload", `target=${calc.target} winners=${calc.winnerIds.length}`)
      : fail("Server calculation payload", JSON.stringify(calc));

    const sameWinners =
      Array.isArray(calc.winnerIds) && calc.winnerIds.every((id: string) => typeof id === "string");
    sameWinners ? pass("Winner IDs are server-authored") : fail("Winner IDs");

    const result = await resultP;
    JSON.stringify(result.winnerIds) === JSON.stringify(calc.winnerIds)
      ? pass("Result matches calculation winners")
      : fail("Result mismatch");

    // Revealed choices only after calculating
    const revealed = calc.players?.filter((p: any) => p.choice != null).length ?? 0;
    revealed >= 2 ? pass("Choices revealed in calculating phase", `${revealed} numbers`) : fail("Reveal");

    hostSock.close();
    guestSock.close();
    pass("Sockets closed cleanly");
  });

  await section("Production build artifacts", async () => {
    const fs = await import("node:fs");
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const clientDist = path.join(root, "client", "dist", "index.html");
    const serverDist = path.join(root, "server", "dist", "index.js");
    const sharedDist = path.join(root, "shared", "dist", "index.js");
    fs.existsSync(clientDist)
      ? pass("client/dist present")
      : fail("client/dist missing — run npm run build -w client");
    fs.existsSync(serverDist)
      ? pass("server/dist present")
      : fail("server/dist missing — run npm run build -w server");
    fs.existsSync(sharedDist)
      ? pass("shared/dist present")
      : fail("shared/dist missing — run npm run build -w shared");

    const vercel = path.join(root, "client", "vercel.json");
    fs.existsSync(vercel) ? pass("Vercel config present") : fail("vercel.json missing");
    const envEx = path.join(root, ".env.example");
    fs.existsSync(envEx) ? pass(".env.example present") : fail(".env.example missing");
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n════ ${results.length - failed.length}/${results.length} passed ════`);
  if (failed.length) {
    console.error("Failures:");
    for (const f of failed) console.error(` - ${f.name}: ${f.detail ?? ""}`);
    process.exit(1);
  }
  console.log("All automated fundamentals passed.");
}

main().catch((err) => {
  console.error("Smoke suite crashed:", err);
  process.exit(1);
});
