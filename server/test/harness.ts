import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Store } from '../src/db/store.ts';
import { AccountRepo } from '../src/db/accounts.ts';
import { CharacterRepo } from '../src/db/characters.ts';
import { GameWorld } from '../src/world/GameWorld.ts';
import { Server } from '../src/net/Server.ts';
import { SERVER, COMBAT } from '../src/config.ts';
import { RecvOp, SendOp } from '../src/packet/opcodes.ts';

import { shandaEncrypt, shandaDecrypt } from '../src/crypt/shanda.ts';
import { aesTransform } from '../src/crypt/aes.ts';
import { MapleCipher } from '../src/crypt/MapleCipher.ts';
import { randomIv, packetLength } from '../src/crypt/iv.ts';

import { TestClient, readCharacter, readPlayer, readMonster } from './TestClient.ts';

const TEST_PORT = 8585;
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

let passed = 0;
function check(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  passed++;
  console.log(`  ✓ ${msg}`);
}
function eq<T>(actual: T, expected: T, msg: string): void {
  check(actual === expected, `${msg} (got ${String(actual)}, want ${String(expected)})`);
}

// ---- 1. Crypto unit tests (no network) -------------------------------------

function testCrypto(): void {
  console.log('\n[1] crypt round-trips');

  for (const len of [0, 1, 7, 16, 31, 100, 255, 1024]) {
    const buf = Buffer.from(Array.from({ length: len }, () => (Math.random() * 256) | 0));
    const round = shandaDecrypt(shandaEncrypt(buf));
    check(round.equals(buf), `shanda round-trips ${len}B`);
  }

  const iv = randomIv();
  const data = Buffer.from('the quick brown fox jumps');
  check(aesTransform(aesTransform(data, iv), iv).equals(data), 'AES-OFB is symmetric');

  // Two mirrored ciphers stay in sync across many packets (IV rolling).
  const sIv = randomIv();
  const cIv = randomIv();
  const server = new MapleCipher(sIv, cIv);
  const client = new MapleCipher(cIv, sIv);
  for (let i = 0; i < 50; i++) {
    const p = Buffer.from(`packet #${i} :: ${'x'.repeat(i)}`);
    const framed = server.encrypt(p);
    const len = packetLength(framed.subarray(0, 4));
    eq(len, p.length, `framed length header correct (#${i})`);
    const got = client.decrypt(framed.subarray(4, 4 + len));
    check(got.equals(p), `server→client packet #${i} decrypts`);
  }
}

// ---- 2. Integration: full login → play flow --------------------------------

async function testIntegration(): Promise<void> {
  console.log('\n[2] integration (login → spawn → sync → combat)');

  const A = await TestClient.connect(TEST_PORT);
  check(true, 'client A connected + handshook');

  // Login (auto-creates account).
  A.sendOp(RecvOp.Login, (w) => w.writeString('heroA').writeString('secret'));
  const aLogin = await A.waitFor(SendOp.LoginStatus);
  eq(aLogin.readByte(), 0, 'A login status = OK');

  // World list.
  A.sendOp(RecvOp.WorldListRequest);
  const wl = await A.waitFor(SendOp.WorldList);
  wl.readByte();
  eq(wl.readString(), SERVER.worldName, 'world name matches');

  // Channel → character list (empty).
  A.sendOp(RecvOp.SelectChannel, (w) => w.writeByte(0).writeByte(0));
  const cl = await A.waitFor(SendOp.CharacterList);
  eq(cl.readByte(), 0, 'A starts with 0 characters');

  // Create + select character.
  A.sendOp(RecvOp.CreateCharacter, (w) => w.writeString('HeroA').writeByte(0).writeShort(30000).writeByte(0));
  const created = readCharacter(await A.waitFor(SendOp.CharacterCreated));
  eq(created.name, 'HeroA', 'character created');
  const aId = created.id;

  A.sendOp(RecvOp.SelectCharacter, (w) => w.writeInt(aId));
  const aEnterR = await A.waitFor(SendOp.EnterField);
  const aMapId = aEnterR.readInt();
  const aMe = readCharacter(aEnterR);
  const aOthers = aEnterR.readShort();
  for (let i = 0; i < aOthers; i++) readPlayer(aEnterR);
  const monsterCount = aEnterR.readShort();
  const monsters = Array.from({ length: monsterCount }, () => readMonster(aEnterR));
  eq(aMapId, SERVER.startMapId, 'A entered the start map');
  eq(aMe.id, aId, 'EnterField echoes my character');
  eq(aOthers, 0, 'no other players yet');
  check(monsterCount >= 1, `map has monsters (${monsterCount})`);

  // ---- Second player joins → AOI spawn + roster ----
  const B = await TestClient.connect(TEST_PORT);
  B.sendOp(RecvOp.Login, (w) => w.writeString('mageB').writeString('secret'));
  await B.waitFor(SendOp.LoginStatus);
  B.sendOp(RecvOp.SelectChannel, (w) => w.writeByte(0).writeByte(0));
  await B.waitFor(SendOp.CharacterList);
  B.sendOp(RecvOp.CreateCharacter, (w) => w.writeString('MageB').writeByte(1).writeShort(30030).writeByte(1));
  const bId = readCharacter(await B.waitFor(SendOp.CharacterCreated)).id;

  const aSeesB = A.waitFor(SendOp.SpawnPlayer);
  B.sendOp(RecvOp.SelectCharacter, (w) => w.writeInt(bId));
  const bEnterR = await B.waitFor(SendOp.EnterField);
  bEnterR.readInt(); // mapId
  readCharacter(bEnterR); // me (B)
  const bOthers = bEnterR.readShort();
  const bRoster = Array.from({ length: bOthers }, () => readPlayer(bEnterR));
  eq(bOthers, 1, "B's roster includes the existing player");
  eq(bRoster[0]?.id, aId, "B sees A in the map");

  const spawnOnA = readPlayer(await aSeesB);
  eq(spawnOnA.id, bId, 'A was notified that B spawned (AOI)');

  // ---- Movement sync ----
  const bSeesMove = B.waitFor(SendOp.PlayerMoved);
  A.sendOp(RecvOp.PlayerMove, (w) => w.writeShort(200).writeShort(560).writeByte(1));
  const movedR = await bSeesMove;
  eq(movedR.readInt(), aId, 'PlayerMoved is for A');
  eq(movedR.readShort(), 200, 'broadcast X matches');

  // ---- Chat broadcast ----
  const bSeesChat = B.waitFor(SendOp.Chat);
  A.sendOp(RecvOp.PlayerChat, (w) => w.writeString('hello world'));
  const chatR = await bSeesChat;
  eq(chatR.readInt(), aId, 'chat author is A');
  chatR.readString(); // name
  eq(chatR.readString(), 'hello world', 'chat text broadcast intact');

  // ---- Server-authoritative combat ----
  const target = monsters
    .map((m) => ({ m, d: Math.hypot(m.x - 200, m.y - 560) }))
    .sort((p, q) => p.d - q.d)[0].m;
  check(true, `attacking nearest monster oid ${target.oid} (id ${target.monsterId})`);

  let killed = false;
  let hits = 0;
  for (let i = 0; i < 25 && !killed; i++) {
    const dmgP = A.waitFor(SendOp.MonsterDamaged, 3000);
    A.sendOp(RecvOp.PlayerAttack, (w) => w.writeInt(target.oid).writeInt(0));
    const dmgR = await dmgP;
    const oid = dmgR.readInt();
    const attacker = dmgR.readInt();
    const dmg = dmgR.readInt();
    const hpLeft = dmgR.readInt();
    eq(oid, target.oid, `hit lands on target (hit ${i + 1})`);
    eq(attacker, aId, 'server credits A as attacker');
    check(dmg >= 1, `server-decided damage ${dmg} >= 1`);
    hits++;
    if (hpLeft <= 0) killed = true;
    else await sleep(COMBAT.attackCooldownMs + 40);
  }
  check(killed, `monster killed in ${hits} authoritative hits`);

  const killR = await A.waitFor(SendOp.MonsterKilled, 1500);
  eq(killR.readInt(), target.oid, 'MonsterKilled for the right oid');

  const statR = await A.waitFor(SendOp.StatUpdate, 1500);
  statR.readShort(); // level
  const exp = statR.readInt();
  check(exp > 0, `A gained EXP from the kill (exp=${exp})`);

  // ---- Cooldown enforcement (anti-cheat) ----
  // Fire two attacks back-to-back; the second must be rejected (no damage).
  const otherTarget = monsters.find((m) => m.oid !== target.oid);
  if (otherTarget) {
    // Get in range first.
    const moved2 = B.waitFor(SendOp.PlayerMoved);
    A.sendOp(RecvOp.PlayerMove, (w) => w.writeShort(otherTarget.x).writeShort(otherTarget.y).writeByte(1));
    await moved2;

    // Let the cooldown from the previous kill elapse so attack #1 is accepted.
    await sleep(COMBAT.attackCooldownMs + 60);

    const firstDmg = A.waitFor(SendOp.MonsterDamaged, 2000);
    A.sendOp(RecvOp.PlayerAttack, (w) => w.writeInt(otherTarget.oid).writeInt(0));
    A.sendOp(RecvOp.PlayerAttack, (w) => w.writeInt(otherTarget.oid).writeInt(0)); // spam, should be ignored
    await firstDmg;
    let secondArrived = false;
    try {
      await A.waitFor(SendOp.MonsterDamaged, 250);
      secondArrived = true;
    } catch {
      secondArrived = false;
    }
    check(!secondArrived, 'rapid second attack rejected by server cooldown');
  }

  A.close();
  B.close();
}

// ---- Runner ----------------------------------------------------------------

async function main(): Promise<void> {
  const tmpDb = path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../data/test-db-${Date.now()}.json`);
  const store = new Store(tmpDb);
  const characters = new CharacterRepo(store);
  const accounts = new AccountRepo(store);
  const world = new GameWorld(characters);
  const server = new Server({ world, accounts, characters });
  await server.listen(TEST_PORT);

  try {
    testCrypto();
    await testIntegration();
    console.log(`\n✅ ALL PASSED — ${passed} checks`);
  } catch (err) {
    console.error(`\n❌ ${(err as Error).message}`);
    process.exitCode = 1;
  } finally {
    await server.close();
    try {
      fs.rmSync(tmpDb, { force: true });
    } catch {
      /* ignore */
    }
    // Dangling respawn timers would keep the loop alive; exit explicitly.
    setTimeout(() => process.exit(process.exitCode ?? 0), 50);
  }
}

main();
