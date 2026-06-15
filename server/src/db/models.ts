/** Persistent domain models (RustMS `db` crate: accounts, characters). */

export interface Account {
  id: number;
  username: string;
  /** scrypt "salt:hash". */
  passwordHash: string;
  createdAt: number;
}

export interface Character {
  id: number;
  accountId: number;
  name: string;
  level: number;
  exp: number;
  job: number;
  str: number;
  dex: number;
  int: number;
  luk: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  mesos: number;
  // Appearance
  gender: number;
  hair: number;
  skin: number;
  // Position
  mapId: number;
  x: number;
  y: number;
}

export interface DbShape {
  accounts: Account[];
  characters: Character[];
  /** Auto-increment counters. */
  seq: { account: number; character: number };
}
