
https://github.com/neeerp/RustMS

怪物與掉落 : https://a2983456456.github.io/artale-drop/

https://github.com/kms-docs/starter/tree/master/docs

https://orangemushroom.net/

https://github.com/KerenPetras/Hackthon-BunnyHop-Collab/tree/main/images

---

## 參考資源整理 (Curated references)

### 已整合進專案 (Already ported into this project)

- **[neeerp/RustMS](https://github.com/neeerp/RustMS)** — Rust 楓之谷伺服器模擬器（login server + 封包加密 + Diesel/Postgres）。
  我們把它的架構（`crypt` / `packet` / `net` / `db` crate）移植成 [`server/`](../server/) 內的
  無依賴 Node + TypeScript TCP 伺服器（見 [phase4-server.md](./phase4-server.md)）。

### [awesome-maplestory](https://github.com/MapleStoryUnity/awesome-maplestory)

全球開源社群維護的楓之谷開發資源總覽。對本專案最有參考價值的條目：

| 類別 | 專案 | 用途 / 對本專案的啟發 |
| --- | --- | --- |
| 伺服器模擬器 | **HeavenMS** (Java, v83) · **Maple.js** (Node) · **Valhalla** (Go, v28) | 封包流程、地圖/怪物邏輯、權威伺服器設計的參考來源（對應 [`server/`](../server/) 的設計）。 |
| 客戶端 | **HeavenClient** · **JourneyClient** | C++/原生客戶端如何渲染紙娃娃、地圖層級，可作為前端 [`src/`](../src/) 的進階參考。 |
| 封包分析 | **MapleShark** (SharpPcap sniffer) | 啟發了 [`server/src/net/packetLog.ts`](../server/src/net/packetLog.ts) 的封包檢視器（`MS_PACKET_LOG=1`）。 |
| WZ/NX 資料格式 | **NoLifeNx** · **node-wz** · **UnityWzLib** · **WzComparerR2** · **Harepacker-resurrected** | 真實客戶端美術/資料的 WZ/NX 解析。本專案刻意以程式生成佔位美術（避免版權素材），未來若要換成自製/免費素材可參考這些工具的資料結構。 |
| 協定文件 | KMS/GMS/JMS/CMS/TMS/MSTH 各版本 OpCode 文件 | 對照各地區版本封包 OpCode；本專案使用自訂的精簡 OpCode 表（[`server/src/packet/opcodes.ts`](../server/src/packet/opcodes.ts)）。 |

> ⚠️ 這些多為研究/教育用途的逆向工程專案；本專案僅參考其**架構與設計**，不使用任何官方受版權保護的素材或資料檔。
