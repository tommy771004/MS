import type { PlayerEntity, MonsterEntity } from './types.ts';
import type { Character } from '../db/models.ts';
import type { CharacterRepo } from '../db/characters.ts';
import { getMonsterData } from '../db/gameData.ts';
import { rollServerDamage, expToNext } from './damage.ts';
import { COMBAT } from '../config.ts';
import * as build from '../net/build/world.ts';

interface SpawnPoint {
  monsterId: number;
  x: number;
  y: number;
}

/**
 * One map's authoritative state and interest management (design.md §4). Every
 * player in the same map is in each other's AOI; the server validates all
 * movement, chat and combat, then broadcasts the results. The client never
 * decides damage — it only sends requests.
 */
export class GameMap {
  readonly players = new Map<number, PlayerEntity>();
  readonly monsters = new Map<number, MonsterEntity>();
  private nextOid = 1;

  constructor(
    readonly id: number,
    private readonly characters: CharacterRepo,
    private readonly spawns: SpawnPoint[],
  ) {
    for (const s of this.spawns) this.spawnMonster(s);
  }

  // ---- Membership ----------------------------------------------------------

  addPlayer(p: PlayerEntity): void {
    // Snapshot of the map for the newcomer...
    p.send(build.enterField(this.id, p.character, [...this.players.values()], [...this.monsters.values()]));
    // ...and tell everyone already here about the newcomer (AOI = same map).
    this.broadcast(build.spawnPlayer(p), p.character.id);
    this.players.set(p.character.id, p);
  }

  removePlayer(characterId: number): void {
    const p = this.players.get(characterId);
    if (!p) return;
    this.characters.save(p.character); // persist position/progress on leave
    this.players.delete(characterId);
    this.broadcast(build.removePlayer(characterId));
  }

  // ---- Movement / chat -----------------------------------------------------

  movePlayer(characterId: number, x: number, y: number, stance: number): void {
    const p = this.players.get(characterId);
    if (!p) return;
    p.x = x;
    p.y = y;
    p.stance = stance;
    p.character.x = x;
    p.character.y = y;
    this.broadcast(build.playerMoved(characterId, x, y, stance), characterId);
  }

  chat(characterId: number, text: string): void {
    const p = this.players.get(characterId);
    if (!p) return;
    const clean = text.slice(0, 80);
    this.broadcast(build.chat(characterId, p.character.name, clean)); // includes sender
  }

  // ---- Authoritative combat ------------------------------------------------

  attack(characterId: number, monsterOid: number, skillId: number, now: number): void {
    const p = this.players.get(characterId);
    if (!p) return;

    // 1. Cooldown gate — reject spam (a hacked client can't out-DPS this).
    if (now - p.lastAttackAt < COMBAT.attackCooldownMs) return;

    // 2. Target must exist and be alive.
    const mob = this.monsters.get(monsterOid);
    if (!mob || !mob.alive) return;

    // 3. Range check against the server's position, not the client's claim.
    const dist = Math.hypot(mob.x - p.x, mob.y - p.y);
    if (dist > COMBAT.attackRange) return;

    p.lastAttackAt = now;

    // 4. Server rolls the damage.
    const def = getMonsterData(mob.monsterId);
    const multiplier = skillId > 0 ? 1.8 : 1; // skills hit harder (data could refine this)
    const { amount } = rollServerDamage(p.character, def.pdef, multiplier);
    mob.hp = Math.max(0, mob.hp - amount);

    this.broadcast(build.monsterDamaged(mob.oid, characterId, amount, mob.hp, mob.maxHp));

    if (mob.hp <= 0) this.killMonster(mob, p);
  }

  private killMonster(mob: MonsterEntity, killer: PlayerEntity): void {
    mob.alive = false;
    this.broadcast(build.monsterKilled(mob.oid, killer.character.id));

    // Award EXP authoritatively and persist.
    const def = getMonsterData(mob.monsterId);
    this.awardExp(killer, def.exp);

    // Respawn later.
    setTimeout(() => this.respawnMonster(mob.oid), COMBAT.respawnMs);
  }

  private awardExp(p: PlayerEntity, exp: number): void {
    const c = p.character;
    c.exp += exp;
    let leveled = false;
    while (c.exp >= expToNext(c.level)) {
      c.exp -= expToNext(c.level);
      c.level++;
      c.str += 3;
      c.dex += 1;
      c.luk += 1;
      c.maxHp += 18;
      c.maxMp += 12;
      c.hp = c.maxHp;
      c.mp = c.maxMp;
      leveled = true;
    }
    this.characters.save(c);
    p.send(build.statUpdate(c));
    if (leveled) this.broadcast(build.chat(0, 'SYSTEM', `${c.name} reached level ${c.level}!`));
  }

  private respawnMonster(oid: number): void {
    const mob = this.monsters.get(oid);
    if (!mob) return;
    mob.hp = mob.maxHp;
    mob.x = mob.spawnX;
    mob.y = mob.spawnY;
    mob.alive = true;
    this.broadcast(build.spawnMonster(mob));
  }

  private spawnMonster(s: SpawnPoint): MonsterEntity {
    const def = getMonsterData(s.monsterId);
    const mob: MonsterEntity = {
      oid: this.nextOid++,
      monsterId: s.monsterId,
      x: s.x,
      y: s.y,
      hp: def.maxHP,
      maxHp: def.maxHP,
      spawnX: s.x,
      spawnY: s.y,
      alive: true,
    };
    this.monsters.set(mob.oid, mob);
    return mob;
  }

  // ---- Broadcast -----------------------------------------------------------

  broadcast(packet: Buffer, exceptCharacterId?: number): void {
    for (const [id, p] of this.players) {
      if (id === exceptCharacterId) continue;
      p.send(packet);
    }
  }
}
