import { Store } from './db/store.ts';
import { AccountRepo } from './db/accounts.ts';
import { CharacterRepo } from './db/characters.ts';
import { GameWorld } from './world/GameWorld.ts';
import { Server } from './net/Server.ts';
import { SERVER } from './config.ts';

/**
 * Entry point — the authoritative login + world server (RustMS `rust-ms-login`).
 * Wires the JSON-backed repositories into the game world and starts listening.
 */
async function main(): Promise<void> {
  const store = new Store();
  const accounts = new AccountRepo(store);
  const characters = new CharacterRepo(store);
  const world = new GameWorld(characters);

  const server = new Server({ world, accounts, characters });
  await server.listen();
  console.log(`🍁 楓之谷 server listening on ${SERVER.host}:${SERVER.port} (world "${SERVER.worldName}")`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
