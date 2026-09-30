import type { PublicPlayer } from "@kod/shared";
import { PlayerCard } from "./PlayerCard";

export function PlayerList({ players }: { players: PublicPlayer[] }) {
  return (
    <div className="space-y-2" role="list" aria-label="Players in room">
      {players.map((p) => (
        <div key={p.id} role="listitem">
          <PlayerCard player={p} />
        </div>
      ))}
    </div>
  );
}
