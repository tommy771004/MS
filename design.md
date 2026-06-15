🍁 專案：新楓之谷 (MapleStory) 風格 2D 橫向卷軸 RPG 開發指南

免責聲明：本文件僅供學術與個人程式開發研究使用。請勿使用官方受版權保護的素材（圖像、音樂）進行任何商業行為或公開發佈。建議開發時使用自製或免費的佔位素材（Placeholder）。

1. 遊戲引擎與技術棧選擇 (Tech Stack)

對於 2D 像素風橫向卷軸遊戲，選擇合適的引擎可以節省大量處理物理和渲染的時間。


推薦選項 B：Godot (GDScript / C#)

優點：輕量、開源免費，對 2D 支援極佳，節點系統（Node）非常適合處理複雜的 UI 和角色狀態。

伺服器端 (Backend)：Node.js (TypeScript) 或 C# (.NET Core)。資料庫建議使用 MySQL 或 PostgreSQL 來儲存玩家資料。

2. 核心架構設計：客戶端 (Client-Side)

2.1 角色控制器 (Player Controller)

楓之谷的操作手感非常獨特，主要由以下機制構成：

重力與跳躍：非真實物理，而是帶有固定空氣阻力的拋物線。需要實作跳躍高度控制（按住跳躍鍵跳得更高）。

平台判定 (Platforming)：

單向平台 (One-Way Platforms)：角色可以從下方跳上平台，按下 下 + 跳躍 可以穿過平台落下。

實作方式：使用射線檢測（Raycasting）判斷角色腳底是否接觸平台，並根據玩家輸入動態切換碰撞體的 Layer。

狀態機 (Finite State Machine, FSM)：角色必須嚴格遵守狀態機。

Idle (待機) -> Walk (行走) -> Jump (跳躍) -> Prone (趴下) -> Attack (攻擊) -> Climb (攀爬梯子/繩索)。

重點：攻擊時通常會鎖定水平移動（硬直）。

2.2 視覺渲染與地圖 (Rendering & Map)

多層視差滾動 (Parallax Scrolling)：背景分為多層（如：天空、遠山、近樹），移動時給予不同的移動權重，產生深度感。

紙娃娃系統 (Avatar System)：

角色不是單一圖片，而是由 頭部、身體、手臂、武器、帽子 等多個 Sprite 疊加而成。

實作方式：骨骼綁定或定義各部位的錨點（Anchor Point/Sockets）。當角色進入「攻擊」幀時，武器的 Sprite 會跟隨手臂的錨點移動並旋轉。

瓦片地圖 (Tilemap)：使用自動對齊的 Tilemap 構建地形。

2.3 傷害顯示與 UI (Damage Numbers & UI)

傷害跳字：打擊怪物時噴出的數字。為了效能，務必使用物件池 (Object Pooling) 技術，而不是頻繁的 Instantiate 和 Destroy。

UI 佈局：底部狀態欄（HP/MP/經驗值）、快捷鍵欄位（Quick Slot）、小地圖（Mini-map）。

3. RPG 核心系統 (Core RPG Systems)

3.1 屬性與公式 (Stats & Formulas)

設計一個集中的 StatManager。

基礎屬性 (Base Stats)：STR (力量), DEX (敏捷), INT (智力), LUK (幸運)。

衍生屬性：

最大 HP / 最大 MP。

物理攻擊力 (Weapon Attack) / 魔法攻擊力 (Magic Attack)。

命中率 (Accuracy) / 迴避率 (Avoidability)。

傷害公式 (概念範例)：
Max Damage = (Main Stat * Factor + Secondary Stat) * Weapon Attack / 100
實際傷害會在 Min Damage 到 Max Damage 之間取亂數，再扣除怪物的防禦力。

3.2 物品與背包系統 (Inventory)

分類：裝備 (Equip)、消耗 (Use)、其他 (Etc)、裝飾 (Setup)、任務 (Quest)。

資料結構：

{
  "itemId": 1002000,
  "type": "EQUIP",
  "name": "新手劍",
  "reqLevel": 1,
  "stats": { "incPAD": 15, "incSTR": 2 }
}


3.3 技能系統 (Skill System)

技能具有多樣性：

主動技能 (Active)：如「魔力爪」、「劍氣縱橫」。需要處理特效播放、範圍判定（Hitbox）與冷卻時間（Cooldown）。

被動技能 (Passive)：直接修改 StatManager 的數值（如增加最大 HP）。

增益狀態 (Buffs)：持續一定時間的狀態，需實作計時器並在 UI 上顯示 Buff 圖示。

4. 網路與伺服器架構 (Networking - MMORPG 必備)

若你要做成多人連線，這是最困難的部分。

權威伺服器 (Authoritative Server)：

絕對原則：客戶端（玩家的遊戲程式）永遠不可信任。

所有移動、攻擊、物品掉落、傷害計算都必須由「伺服器」驗證或計算。客戶端只負責「發送請求」和「播放動畫」。

封包設計 (Packet Design)：

使用 OpCode (操作碼) 來區分封包類型。

範例：客戶端發送 [OP_ATTACK, MonsterID, SkillID] -> 伺服器驗證冷卻、MP、距離 -> 伺服器廣播 [OP_DAMAGE, MonsterID, DamageValue] -> 所有客戶端看到怪物扣血。

視野管理 (Interest Management / AOI)：

伺服器不需要把全伺服器玩家的動作發給你，只需要發送與你「同一個地圖」且「在螢幕範圍內」的玩家資料。

5. 開發階段藍圖 (Roadmap)

如果你是一個人進行這項研究，建議按照以下順序開發：

階段一：單機基礎原型 (Phase 1: Single-Player Prototype)

[ ] 設置遊戲引擎與專案結構。

[ ] 實作重力、跳躍、左右移動。

[ ] 實作單向平台（跳上與躍下）。

[ ] 建立基本的角色動畫狀態機（站立、走、跳）。

階段二：戰鬥與互動 (Phase 2: Combat & Interaction)

[ ] 建立一隻只會左右走動的 Dummy 怪物。

[ ] 實作普通攻擊的 Hitbox 判定。

[ ] 實作怪物受擊閃爍與扣血。

[ ] 實作傷害數字彈出動畫（使用物件池）。

[ ] 實作怪物死亡與掉落道具（硬幣/虛擬物品）。

階段三：RPG 系統深化 (Phase 3: Deepening RPG Mechanics)

[ ] 建立屬性面板（HP/MP/經驗值）。

[ ] 實作升級機制。

[ ] 建立背包 UI 與物品資料庫（JSON 格式）。

[ ] 實作「喝水」（消耗品回復 HP/MP）。

階段四：連線多人化 (Phase 4: Multiplayer - 進階)

(建議先用 Node.js 寫一個簡單的 Socket 伺服器)

[ ] 玩家登入驗證。

[ ] 玩家座標同步（看到其他玩家走動）。

[ ] 聊天室系統（全地圖廣播）。

[ ] 伺服器端驗證怪物扣血。

6. 個人研究小撇步

資料解耦：千萬不要把怪物的 HP 或道具的攻擊力寫死在腳本裡。全部抽離成 JSON 或 CSV 檔案，遊戲啟動時再讀取，這符合大型遊戲的 Data-Driven 開發模式。

碰撞優化：2D 遊戲中，不要對每一個像素做碰撞。使用簡單的 BoxCollider2D 或 CapsuleCollider2D 處理物理，打擊判定則透過程式計算距離或發射 BoxCast。

善用開源資源：尋找開源的 MapleStory 模擬器（如 OdinMS 系列、MoopleDEV 等的源碼）純粹作為架構參考，了解他們是如何設計封包和處理地圖邏輯的，這對後端開發會有極大的啟發。