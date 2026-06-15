# 🍁 楓之谷 Clone — Authoritative Game Server

A dependency-free **Node.js + TypeScript TCP server** for the MapleStory clone, porting
the architecture of [neeerp/RustMS](https://github.com/neeerp/RustMS) (a Rust MapleStory
server emulator) to implement Phase 4 of [`../design.md`](../design.md) §4 — the
authoritative multiplayer layer. Full design notes: [`../docs/phase4-server.md`](../docs/phase4-server.md).

> ⚠️ **Educational / research use only.** No external npm dependencies, no copyrighted
> MapleStory assets. Uses only Node built-ins (`node:net`, `node:crypto`, `node:fs`).

## Requirements

Node **≥ 22.7** — TypeScript runs directly via `--experimental-transform-types`, so there's
no build step.

## Scripts

```bash
npm run start        # start the login + world server on 127.0.0.1:8484
npm run test         # integration harness (boots server + 2 TCP clients, 142 checks)
npm run typecheck    # tsc --noEmit (needs the root project's TypeScript install)

MS_PACKET_LOG=1 npm run start   # MapleShark-lite: log every decoded packet
```

## What it does (mirrors RustMS crates)

| Module | RustMS crate | Responsibility |
| --- | --- | --- |
| [`src/crypt/`](src/crypt/) | `crypt` | AES-OFB + shanda secondary cipher + IV-evolving header + scrypt passwords |
| [`src/packet/`](src/packet/) | `packet` | little-endian read/write (+ length-headered strings), OpCodes |
| [`src/net/`](src/net/) | `net` | TCP loop, handshake, packet framing, opcode router, handlers, builders |
| [`src/db/`](src/db/) | `db` | account + character repos, JSON persistence, shared game-data loader |
| [`src/world/`](src/world/) | — | `GameWorld`/`GameMap`: AOI broadcast + authoritative combat |
| [`src/index.ts`](src/index.ts) | `rust-ms-login` | entry point |
| [`test/`](test/) | `integration-harness` | end-to-end TCP test client + harness |

## Protocol in one breath

1. Server sends an unencrypted, length-prefixed **handshake** (version, two IV nonces).
2. Every later packet is `[4-byte header][ AES_OFB( shanda( body ) ) ]`; the header encodes
   the length (IV-independently), and both peers roll their IVs deterministically per packet.
3. Packets are tagged by **OpCode** ([`src/packet/opcodes.ts`](src/packet/opcodes.ts)).

## Authoritative flow (design.md §4)

`client → [PlayerAttack, monsterOid, skillId]` → server validates **cooldown + range**,
**rolls the damage itself**, then broadcasts `[MonsterDamaged, oid, dmg, hpLeft]` to everyone
in the map (AOI). The client never decides damage — a hacked client can't inflate it.

## Verification

`npm run test` boots the server, connects two TCP clients, and asserts crypto round-trips,
login/character flow, AOI spawn + roster, movement sync, chat broadcast, server-authoritative
combat (damage → kill → EXP), and cooldown-based anti-cheat — **142 checks, all passing**.
