import type { Account } from './models.ts';
import type { Store } from './store.ts';
import { hashPassword, verifyPassword } from '../crypt/password.ts';

export type LoginResult =
  | { ok: true; account: Account; created: boolean }
  | { ok: false; reason: 'bad_password' };

/**
 * Account repository (RustMS `db::accounts`). For this educational server,
 * logging in with an unknown username auto-creates the account (so testers
 * don't need a separate registration step).
 */
export class AccountRepo {
  constructor(private readonly store: Store) {}

  findByUsername(username: string): Account | undefined {
    return this.store.data.accounts.find((a) => a.username === username);
  }

  /** Auto-creating login: create if new, else verify the password. */
  login(username: string, password: string): LoginResult {
    const existing = this.findByUsername(username);
    if (!existing) {
      const account: Account = {
        id: this.store.nextAccountId(),
        username,
        passwordHash: hashPassword(password),
        createdAt: Date.now(),
      };
      this.store.data.accounts.push(account);
      this.store.save();
      return { ok: true, account, created: true };
    }
    if (!verifyPassword(password, existing.passwordHash)) {
      return { ok: false, reason: 'bad_password' };
    }
    return { ok: true, account: existing, created: false };
  }
}
