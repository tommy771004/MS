import type { Connection } from '../Connection.ts';
import type { PacketReader } from '../../packet/PacketReader.ts';
import * as build from '../build/login.ts';

/** [username, password] → auto-create or verify, then report status. */
export function handleLogin(conn: Connection, reader: PacketReader): void {
  const username = reader.readString();
  const password = reader.readString();

  const result = conn.ctx.accounts.login(username, password);
  if (!result.ok) {
    conn.send(build.loginStatus(build.LoginStatus.BadPassword));
    return;
  }
  conn.account = result.account;
  conn.send(build.loginStatus(build.LoginStatus.Ok, result.account));
  console.log(`[conn ${conn.id}] login ok: ${username}${result.created ? ' (new account)' : ''}`);
}

/** Request the world/channel list. */
export function handleWorldList(conn: Connection): void {
  conn.send(build.worldList());
}

/** [worldId, channelId] → return this account's characters. */
export function handleSelectChannel(conn: Connection, reader: PacketReader): void {
  reader.readByte(); // worldId
  reader.readByte(); // channelId
  if (!conn.account) return;
  const chars = conn.ctx.characters.listByAccount(conn.account.id);
  conn.send(build.characterList(chars));
}
