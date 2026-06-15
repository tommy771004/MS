🍁 階段四：權威伺服器 (Authoritative Server)

本文件說明 [`server/`](../server/) 的設計。它把 [neeerp/RustMS](https://github.com/neeerp/RustMS)
（Rust 楓之谷伺服器模擬器）的架構，移植成一個**零外部依賴**的 Node.js + TypeScript TCP 伺服器，
實作 design.md §4 所列的多人連線需求。其他社群資源（HeavenMS、MapleShark…）整理於
[info.md](./info.md)。

> ⚠️ 僅供學術與個人研究。不使用任何官方受版權保護的素材或資料。

## 為什麼是 TCP + 自訂封包？

RustMS（與所有楓之谷模擬器）使用 **TCP**，並在 `localhost:8484` 監聽 login server；
每個封包都經過 AES + 自訂二次加密，並以 OpCode 區分類型。我們完整保留這個模型，因為：

1. 它能在 Node 內**完整自動化測試**（不需瀏覽器），用 TCP 測試客戶端就能跑端到端驗證。
2. 它忠實示範了 design.md §4 的「權威伺服器」「封包設計」「視野管理 (AOI)」。

瀏覽器端的 Phaser 客戶端無法直接開 TCP；要接上時，會在前面加一個 WebSocket↔TCP gateway
（見下方「與瀏覽器客戶端整合」）。

## 架構對照：RustMS crate → 本專案模組

| RustMS crate | 本專案 | 職責 |
| --- | --- | --- |
| `crypt` | [`server/src/crypt/`](../server/src/crypt/) | AES-OFB（[`aes.ts`](../server/src/crypt/aes.ts)）+ shanda 二次加密（[`shanda.ts`](../server/src/crypt/shanda.ts)）+ IV 演進與封包標頭（[`iv.ts`](../server/src/crypt/iv.ts)）+ 連線金鑰狀態（[`MapleCipher.ts`](../server/src/crypt/MapleCipher.ts)）+ 密碼雜湊（scrypt，取代 bcrypt）。 |
| `packet` | [`server/src/packet/`](../server/src/packet/) | 小端序讀寫（`PacketReader`/`PacketWriter`，含長度前綴字串）+ OpCode 表。 |
| `net` (`io` + `packet::handle`/`build`) | [`server/src/net/`](../server/src/net/) | TCP accept loop、連線/握手/封包分框、依 OpCode 分派的 handlers、封包 builders。 |
| `db` (accounts/characters) | [`server/src/db/`](../server/src/db/) | 帳號/角色 repository + JSON 檔持久化（取代 Postgres/Diesel）+ 與客戶端共用的遊戲資料載入。 |
| 權威世界狀態 | [`server/src/world/`](../server/src/world/) | `GameWorld` / `GameMap`：AOI 廣播、伺服器端傷害計算與驗證。 |
| `rust-ms-login` (binary) | [`server/src/index.ts`](../server/src/index.ts) | 進入點，於 8484 啟動 login + world server。 |
| `integration-harness` | [`server/test/`](../server/test/) | TCP 測試客戶端 + 端到端整合測試。 |

## 封包協定

**握手（伺服器→客戶端，未加密、2-byte 長度前綴）**：版本、patch 字串、`clientIv`、`serverIv`、locale。
之後雙方各自持有一組 send/recv IV。

**加密封包分框**：`[4-byte 標頭][加密 body]`。
- 標頭以 `length ^ IV ^ version` 編碼；長度可在**不需 IV** 的情況下還原（與真實協定相同）。
- `body = AES_OFB( shanda( packet ) )`；收端反向，每送/收一個封包後雙方以相同的 deterministic
  函式滾動 IV，因此整條連線保持同步。

**OpCode**（[`opcodes.ts`](../server/src/packet/opcodes.ts)）：`RecvOp`（客戶端→伺服器）/ `SendOp`（伺服器→客戶端）。

## design.md §4 對應實作

- **權威伺服器**：客戶端只送「請求」。傷害、命中、掉落、升級全在伺服器計算
  （[`GameMap.attack`](../server/src/world/GameMap.ts) → [`damage.ts`](../server/src/world/damage.ts)）。
- **封包設計 (OpCode)**：`[OP_ATTACK, monsterOid, skillId]` → 伺服器驗證冷卻/距離 →
  廣播 `[OP_MONSTER_DAMAGED, oid, damage, hpLeft]`。
- **視野管理 (AOI)**：以「同一地圖」為興趣範圍；只有同地圖玩家會收到彼此的
  spawn / move / chat / 戰鬥事件。
- **登入驗證 / 座標同步 / 聊天廣播 / 伺服器驗證怪物扣血**：四項 Phase 4 待辦全部完成。
- **反作弊**：伺服器強制攻擊冷卻與距離檢查，連續攻擊封包會被丟棄（整合測試有驗證）。

## 執行與測試

```bash
cd server
npm run start   # 在 127.0.0.1:8484 啟動伺服器
npm run test    # 整合測試（crypt round-trip → 登入 → spawn → 同步 → 戰鬥）
npm run typecheck
MS_PACKET_LOG=1 npm run start   # 開啟 MapleShark-lite 封包檢視器
```

> 需要 Node ≥ 22.7（使用 `--experimental-transform-types` 直接執行 TypeScript，零建置步驟）。

整合測試（[`server/test/harness.ts`](../server/test/harness.ts)）會啟動伺服器、連兩個 TCP 客戶端，
驗證：50 個封包的加解密同步、登入/建角/選角、AOI spawn 與名單、移動同步、聊天廣播、
伺服器權威戰鬥（傷害→擊殺→經驗）、以及冷卻反作弊——目前 **142 項檢查全數通過**。

## 與瀏覽器客戶端整合（後續）

目前伺服器與 [`src/`](../src/) 的單機客戶端尚未連線。要接上時：

1. 在伺服器前加一個 **WebSocket↔TCP gateway**（瀏覽器無法開原生 TCP）。
2. 在客戶端寫一個 `NetClient`，重用相同的 `crypt`/`packet` 邏輯，把
   [`GameScene.resolveMelee`](../src/scenes/GameScene.ts) 的本地判定換成送 `PlayerAttack`、
   改由 `MonsterDamaged` 事件驅動扣血——單機與連線即可共用同一套表現層。
