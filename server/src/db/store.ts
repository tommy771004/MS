import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DbShape } from './models.ts';

/**
 * Tiny JSON-file persistence standing in for RustMS's Postgres/Diesel layer.
 * Loads once, writes through on mutation. Good enough to demonstrate
 * account/character persistence across sessions without a DB dependency.
 */
const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const EMPTY: DbShape = { accounts: [], characters: [], seq: { account: 0, character: 0 } };

export class Store {
  data: DbShape;

  constructor(private readonly file = DB_FILE) {
    this.data = this.load();
  }

  private load(): DbShape {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      const parsed = JSON.parse(raw) as DbShape;
      return { ...EMPTY, ...parsed, seq: { ...EMPTY.seq, ...parsed.seq } };
    } catch {
      return structuredClone(EMPTY);
    }
  }

  save(): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }

  nextAccountId(): number {
    return ++this.data.seq.account;
  }

  nextCharacterId(): number {
    return ++this.data.seq.character;
  }
}
