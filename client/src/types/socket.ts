/// <reference types="vite/client" />

import type { ClientToServerEvents, ServerToClientEvents } from "@kod/shared";

export type TypedSocket = import("socket.io-client").Socket<
  ServerToClientEvents,
  ClientToServerEvents
>;
