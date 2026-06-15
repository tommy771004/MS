import type { Connection } from '../Connection.ts';
import type { PacketReader } from '../../packet/PacketReader.ts';

/** Resolve the player's current map, or null if not in-game. */
function currentMap(conn: Connection) {
  if (!conn.player || conn.mapId === null) return null;
  return conn.ctx.world.getMap(conn.mapId);
}

/** [x, y, stance] */
export function handlePlayerMove(conn: Connection, reader: PacketReader): void {
  const x = reader.readShort();
  const y = reader.readShort();
  const stance = reader.readByte();
  const map = currentMap(conn);
  if (!map || !conn.player) return;
  map.movePlayer(conn.player.character.id, x, y, stance);
}

/** [monsterOid, skillId] — request an attack; the server decides the outcome. */
export function handlePlayerAttack(conn: Connection, reader: PacketReader): void {
  const monsterOid = reader.readInt();
  const skillId = reader.readInt();
  const map = currentMap(conn);
  if (!map || !conn.player) return;
  map.attack(conn.player.character.id, monsterOid, skillId, Date.now());
}

/** [text] */
export function handlePlayerChat(conn: Connection, reader: PacketReader): void {
  const text = reader.readString();
  const map = currentMap(conn);
  if (!map || !conn.player) return;
  map.chat(conn.player.character.id, text);
}
