import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Loads the *same* game-data JSON the client uses (../../src/data), so monster
 * HP / defense / EXP are a single source of truth shared by client and the
 * authoritative server (design.md §6). RustMS keeps comparable assets under
 * `assets/game-data/`.
 */

export interface MonsterData {
  monsterId: number;
  name: string;
  maxHP: number;
  pdef: number;
  touchDamage: number;
  exp: number;
  bodyWidth: number;
  bodyHeight: number;
}

const CLIENT_DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../src/data');

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(CLIENT_DATA, file), 'utf8')) as T;
}

const monsters = readJson<MonsterData[]>('monsters.json');
const monsterById = new Map<number, MonsterData>(monsters.map((m) => [m.monsterId, m]));

export function getMonsterData(monsterId: number): MonsterData {
  const def = monsterById.get(monsterId);
  if (!def) throw new Error(`Unknown monsterId: ${monsterId}`);
  return def;
}

export function allMonsterData(): MonsterData[] {
  return monsters;
}
