import type { Character } from '../db/models.ts';

/**
 * A logged-in player inside a map. Decoupled from the network layer via a bare
 * `send` callback so the world doesn't import the Connection class (avoids a
 * cycle). The Connection encrypts whatever raw packet is handed to `send`.
 */
export interface PlayerEntity {
  character: Character;
  x: number;
  y: number;
  stance: number;
  /** Server timestamp of the last accepted attack (cooldown gate). */
  lastAttackAt: number;
  send(packet: Buffer): void;
}

/** A live monster instance (object id `oid` is map-unique). */
export interface MonsterEntity {
  oid: number;
  monsterId: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  spawnX: number;
  spawnY: number;
  alive: boolean;
}
