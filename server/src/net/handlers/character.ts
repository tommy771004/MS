import type { Connection } from '../Connection.ts';
import type { PacketReader } from '../../packet/PacketReader.ts';
import type { PlayerEntity } from '../../world/types.ts';
import * as build from '../build/character.ts';
import { characterList } from '../build/login.ts';

/** [name, gender, hair, skin] → create a character (unique name enforced). */
export function handleCreateCharacter(conn: Connection, reader: PacketReader): void {
  const name = reader.readString();
  const gender = reader.readByte();
  const hair = reader.readShort();
  const skin = reader.readByte();
  if (!conn.account) return;

  const created = conn.ctx.characters.create({ accountId: conn.account.id, name, gender, hair, skin });
  if (!created) {
    // Name taken — resend the (unchanged) list so the client can react.
    conn.send(characterList(conn.ctx.characters.listByAccount(conn.account.id)));
    return;
  }
  conn.send(build.characterCreated(created));
}

/** [characterId] */
export function handleDeleteCharacter(conn: Connection, reader: PacketReader): void {
  const characterId = reader.readInt();
  if (!conn.account) return;
  if (conn.ctx.characters.delete(characterId, conn.account.id)) {
    conn.send(build.characterDeleted(characterId));
  }
}

/** [characterId] → enter the game world and spawn into the map. */
export function handleSelectCharacter(conn: Connection, reader: PacketReader): void {
  const characterId = reader.readInt();
  if (!conn.account) return;

  const character = conn.ctx.characters.findById(characterId);
  if (!character || character.accountId !== conn.account.id) return;

  conn.character = character;
  conn.mapId = character.mapId;

  const player: PlayerEntity = {
    character,
    x: character.x,
    y: character.y,
    stance: 0,
    lastAttackAt: 0,
    send: (packet: Buffer) => conn.send(packet),
  };
  conn.player = player;
  conn.ctx.world.getMap(character.mapId).addPlayer(player);
  console.log(`[conn ${conn.id}] ${character.name} entered map ${character.mapId}`);
}
