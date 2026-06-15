import type { Character } from './models.ts';
import type { Store } from './store.ts';
import { SERVER } from '../config.ts';

export interface CreateCharacterInput {
  accountId: number;
  name: string;
  gender: number;
  hair: number;
  skin: number;
}

/**
 * Character repository (RustMS `db::characters`). Enforces case-sensitive name
 * uniqueness (like RustMS) and derives starting stats for a fresh character.
 */
export class CharacterRepo {
  constructor(private readonly store: Store) {}

  listByAccount(accountId: number): Character[] {
    return this.store.data.characters.filter((c) => c.accountId === accountId);
  }

  findById(id: number): Character | undefined {
    return this.store.data.characters.find((c) => c.id === id);
  }

  nameTaken(name: string): boolean {
    return this.store.data.characters.some((c) => c.name === name);
  }

  create(input: CreateCharacterInput): Character | null {
    if (this.nameTaken(input.name)) return null;
    const character: Character = {
      id: this.store.nextCharacterId(),
      accountId: input.accountId,
      name: input.name,
      level: 1,
      exp: 0,
      job: 0,
      str: 12,
      dex: 6,
      int: 4,
      luk: 5,
      hp: 100,
      maxHp: 100,
      mp: 50,
      maxMp: 50,
      mesos: 100,
      gender: input.gender,
      hair: input.hair,
      skin: input.skin,
      mapId: SERVER.startMapId,
      x: SERVER.startX,
      y: SERVER.startY,
    };
    this.store.data.characters.push(character);
    this.store.save();
    return character;
  }

  delete(id: number, accountId: number): boolean {
    const idx = this.store.data.characters.findIndex((c) => c.id === id && c.accountId === accountId);
    if (idx === -1) return false;
    this.store.data.characters.splice(idx, 1);
    this.store.save();
    return true;
  }

  /** Persist mutable runtime fields back to the store (position, exp, etc.). */
  save(character: Character): void {
    const idx = this.store.data.characters.findIndex((c) => c.id === character.id);
    if (idx !== -1) this.store.data.characters[idx] = character;
    this.store.save();
  }
}
