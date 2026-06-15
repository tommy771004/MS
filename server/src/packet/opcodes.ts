/**
 * Packet OpCodes (design.md §4). Plain `as const` maps (not TS enums) so the
 * file runs under Node's type-stripping. RecvOp = client→server, SendOp =
 * server→client.
 */

export const RecvOp = {
  /** [username, password] */
  Login: 0x01,
  /** (no body) request the world/channel list */
  WorldListRequest: 0x02,
  /** [worldId, channelId] enter channel → expect character list */
  SelectChannel: 0x03,
  /** [name, gender, hair, skin] */
  CreateCharacter: 0x04,
  /** [characterId] */
  DeleteCharacter: 0x05,
  /** [characterId] enter the game world */
  SelectCharacter: 0x06,
  /** [x, y, stance] */
  PlayerMove: 0x10,
  /** [monsterOid, skillId] */
  PlayerAttack: 0x11,
  /** [text] */
  PlayerChat: 0x12,
  /** keep-alive */
  Pong: 0x18,
} as const;

export const SendOp = {
  Handshake: 0x00,
  /** [status, accountId, username] */
  LoginStatus: 0x01,
  /** [worldId, name, channelCount] */
  WorldList: 0x02,
  /** [count, (id,name,level,job,x,y)...] */
  CharacterList: 0x03,
  /** [character] */
  CharacterCreated: 0x04,
  /** [characterId] */
  CharacterDeleted: 0x05,
  /** [mapId, character, playerCount, players..., monsterCount, monsters...] */
  EnterField: 0x06,
  /** another player entered your AOI */
  SpawnPlayer: 0x07,
  /** a player left your AOI */
  RemovePlayer: 0x08,
  /** [charId, x, y, stance] */
  PlayerMoved: 0x09,
  /** [charId, name, text] */
  Chat: 0x0a,
  /** [oid, monsterId, x, y, hp, maxHp] */
  SpawnMonster: 0x0b,
  /** [oid, attackerId, damage, hpLeft, maxHp] */
  MonsterDamaged: 0x0c,
  /** [oid, killerId] */
  MonsterKilled: 0x0d,
  /** [level, exp, hp, maxHp, mp, maxMp] */
  StatUpdate: 0x0e,
  Ping: 0x18,
} as const;

export type RecvOpCode = (typeof RecvOp)[keyof typeof RecvOp];
export type SendOpCode = (typeof SendOp)[keyof typeof SendOp];
