🍁 階段六：商城與背包系統 (Inventory & Shop)

在 MMORPG 中，道具系統的設計核心在於「資料定義 (Data Definition)」與「實體狀態 (Instance State)」的分離。

資料定義：這把劍叫什麼名字？攻擊力多少？圖示長怎樣？（這些是固定的，全伺服器共用）。

實體狀態：玩家 A 背包裡的第 3 格有 50 顆紅色藥水。（這些是變動的，專屬於該玩家）。

1. 道具的資料結構 (ScriptableObject)

在 Unity 中，我們使用 ScriptableObject 來儲存不變的道具資料。這就像是資料庫的一筆紀錄，非常節省記憶體。

using UnityEngine;

// 楓之谷經典的五大分類
public enum ItemCategory { Equip, Use, Setup, Etc, Cash }

[CreateAssetMenu(fileName = "NewItem", menuName = "MapleStory/Item")]
public class ItemData : ScriptableObject
{
    [Header("基本資訊")]
    public int itemID;          // 物品唯一編號 (例如：2000000 代表紅色藥水)
    public string itemName;     // 物品名稱
    [TextArea]
    public string description;  // 物品描述
    public Sprite icon;         // 物品圖示
    public ItemCategory category; // 物品分類

    [Header("堆疊與交易")]
    public bool isStackable;    // 是否可堆疊 (裝備通常為 false，消耗品為 true)
    public int maxStack = 9999; // 最大堆疊數量
    public int buyPrice;        // NPC 購買價格
    public int sellPrice;       // 賣給 NPC 的價格

    [Header("裝備專屬屬性 (若非裝備則不填)")]
    public int addStr;
    public int addDex;
    public int weaponAttack;

    [Header("消耗品專屬屬性 (若非消耗品則不填)")]
    public int healHP;
    public int healMP;
}


2. 背包格子的資料結構 (ItemSlot)

這個結構用來記錄「玩家背包裡的具體狀況」。我們不需要複製整個 ItemData，只需要儲存對它的參考 (Reference) 以及目前的數量 (Amount)。

[System.Serializable]
public class ItemSlot
{
    public ItemData item; // 指向道具資料庫的藍圖
    public int amount;    // 當前數量

    // 檢查這個格子是不是空的
    public bool IsEmpty => item == null || amount <= 0;

    public void AddAmount(int value)
    {
        amount += value;
    }

    public void Clear()
    {
        item = null;
        amount = 0;
    }
}


3. 背包管理器 (InventoryManager)

負責處理拾取道具、分類存放、消耗道具等邏輯。

using System.Collections.Generic;
using UnityEngine;

public class InventoryManager : MonoBehaviour
{
    public int maxSlotsPerTab = 96; // 每一頁最大 96 格
    public int currentMesos = 0;    // 玩家身上的楓幣

    // 依照楓之谷的設計，分為五個背包分頁
    public ItemSlot[] equipTab;
    public ItemSlot[] useTab;
    public ItemSlot[] setupTab;
    public ItemSlot[] etcTab;
    public ItemSlot[] cashTab;

    void Awake()
    {
        // 初始化背包陣列
        equipTab = new ItemSlot[maxSlotsPerTab];
        useTab = new ItemSlot[maxSlotsPerTab];
        // ... 其他分頁依此類推，並實例化 ItemSlot
    }

    // 將道具加入背包的核心邏輯
    public bool AddItem(ItemData itemToAdd, int amountToAdd)
    {
        ItemSlot[] targetTab = GetTabByCategory(itemToAdd.category);

        // 1. 如果道具可堆疊，先找有沒有已經存在的同一種道具，且還沒滿的
        if (itemToAdd.isStackable)
        {
            for (int i = 0; i < targetTab.Length; i++)
            {
                if (!targetTab[i].IsEmpty && targetTab[i].item.itemID == itemToAdd.itemID)
                {
                    int spaceLeft = itemToAdd.maxStack - targetTab[i].amount;
                    if (spaceLeft >= amountToAdd)
                    {
                        targetTab[i].AddAmount(amountToAdd);
                        return true; // 成功加入
                    }
                    else
                    {
                        // 填滿這個格子，剩下的繼續往下找
                        targetTab[i].amount = itemToAdd.maxStack;
                        amountToAdd -= spaceLeft;
                    }
                }
            }
        }

        // 2. 找一個空的格子放剩下的道具
        for (int i = 0; i < targetTab.Length; i++)
        {
            if (targetTab[i].IsEmpty)
            {
                targetTab[i].item = itemToAdd;
                targetTab[i].amount = amountToAdd;
                return true; // 成功加入
            }
        }

        // 3. 如果找不到空格，代表背包滿了
        Debug.LogWarning("背包已滿！");
        return false;
    }

    private ItemSlot[] GetTabByCategory(ItemCategory category)
    {
        switch (category)
        {
            case ItemCategory.Equip: return equipTab;
            case ItemCategory.Use: return useTab;
            case ItemCategory.Setup: return setupTab;
            case ItemCategory.Etc: return etcTab;
            case ItemCategory.Cash: return cashTab;
            default: return etcTab;
        }
    }
}


4. NPC 商城交易邏輯 (ShopManager)

商城的運作本質上就是「扣除楓幣」並呼叫 InventoryManager.AddItem，或是呼叫 InventoryManager.RemoveItem 並「增加楓幣」。

public class ShopManager : MonoBehaviour
{
    public InventoryManager playerInventory;

    // 玩家向 NPC 購買
    public void BuyItemFromNPC(ItemData item, int amount)
    {
        int totalCost = item.buyPrice * amount;

        if (playerInventory.currentMesos >= totalCost)
        {
            // 嘗試加入背包 (檢查是否滿了)
            if (playerInventory.AddItem(item, amount))
            {
                playerInventory.currentMesos -= totalCost;
                Debug.Log($"成功購買 {amount} 個 {item.itemName}，花費 {totalCost} 楓幣。");
                // TODO: 更新 UI
            }
            else
            {
                Debug.Log("購買失敗，背包空間不足。");
            }
        }
        else
        {
            Debug.Log("楓幣不足！");
        }
    }
}


🍁 階段七：基礎伺服器網路架構 (Client-Server Network)

MMORPG 的連線架構絕對不能使用 Peer-to-Peer (P2P)，必須採用 Dedicated Server (專用伺服器) 架構。

Client (客戶端)：負責顯示畫面、播放音樂、接收玩家鍵盤輸入。

Server (伺服器端)：負責管理地圖上所有物件的座標、計算傷害、判定血量。伺服器是「絕對權威」。

我們以 Unity 常用的網路框架 Mirror 來舉例。

1. 核心觀念：RPC (Remote Procedure Call)

[Command] (Cmd)：客戶端呼叫，伺服器執行。

例如：玩家按下 Ctrl，告訴伺服器「我要施放群體治癒」。

[ClientRpc] (Rpc)：伺服器呼叫，所有客戶端執行。

例如：伺服器同意施放後，告訴畫面上所有玩家「在某個座標播放群體治癒的特效」。

[SyncVar]：同步變數，當伺服器修改這個變數時，所有客戶端會自動更新。

例如：玩家的 HP 或 MP。

2. 網路玩家控制器與移動同步

在多人遊戲中，玩家只擁有「自己角色」的控制權 (isLocalPlayer)。

using UnityEngine;
using Mirror; // 引入 Mirror 網路庫

public class NetworkPlayerController : NetworkBehaviour
{
    public float moveSpeed = 5f;
    private Rigidbody2D rb;

    void Start()
    {
        rb = GetComponent<Rigidbody2D>();
    }

    void Update()
    {
        // 只有「本地玩家」(你自己的電腦) 才能抓取鍵盤輸入
        if (!isLocalPlayer) return;

        float moveX = Input.GetAxisRaw("Horizontal");
        rb.velocity = new Vector2(moveX * moveSpeed, rb.velocity.y);

        // 面向處理
        if (moveX != 0)
        {
            bool facingRight = moveX > 0;
            // 呼叫 Command，告訴伺服器我要轉向了
            CmdChangeFacing(facingRight); 
        }
    }

    // [Command]：這個方法由客戶端發起，但在伺服器上執行
    [Command]
    void CmdChangeFacing(bool facingRight)
    {
        // 伺服器收到請求後，再透過 Rpc 廣播給同地圖的所有人
        RpcUpdateFacing(facingRight);
    }

    // [ClientRpc]：伺服器發起，所有看到這個角色的客戶端都會執行
    [ClientRpc]
    void RpcUpdateFacing(bool facingRight)
    {
        // 實際翻轉角色的視覺圖形
        Vector3 scaler = transform.localScale;
        scaler.x = facingRight ? 1 : -1;
        transform.localScale = scaler;
    }
}


(註：位置座標的同步，通常直接掛載 NetworkTransform 組件即可，框架會自動處理位置與平滑插值)

3. 技能與戰鬥同步 (最關鍵的 MMORPG 邏輯)

假設玩家要施放一招範圍攻擊「劍氣縱橫」。正確的流程是：

Client 按下攻擊鍵 -> 播攻擊動畫 -> 傳 Command 給 Server。

Server 檢查該玩家 MP 夠不夠 -> 扣 MP -> 計算範圍內有哪些怪物 -> 計算傷害扣怪物血 -> 傳 Rpc 給全體。

Other Clients 收到 Rpc -> 播放該玩家的「劍氣縱橫」特效 -> 產生傷害跳字。

public class NetworkPlayerCombat : NetworkBehaviour
{
    // SyncVar：當 Server 改變這個值，所有 Client 都會自動收到更新
    [SyncVar(hook = nameof(OnHealthChanged))]
    public int currentHP = 100;
    
    [SyncVar]
    public int currentMP = 50;

    // 當 HP 變更時，觸發 UI 更新
    void OnHealthChanged(int oldHP, int newHP)
    {
        // 更新血條 UI (這是純客戶端視覺邏輯)
        UIManager.Instance.UpdateHPBar(newHP);
    }

    void Update()
    {
        if (!isLocalPlayer) return;

        // 客戶端按下攻擊鍵
        if (Input.GetKeyDown(KeyCode.LeftControl))
        {
            // 在自己的畫面上先播動畫，避免延遲感 (Client Prediction)
            GetComponent<Animator>().SetTrigger("Attack");
            
            // 告訴伺服器我要攻擊了
            CmdCastSkill(101); // 假設 101 是劍氣縱橫的技能 ID
        }
    }

    // 伺服器端處理攻擊邏輯
    [Command]
    void CmdCastSkill(int skillID)
    {
        int mpCost = 10;
        
        // 1. 伺服器驗證：MP 夠不夠？冷卻時間到了沒？
        if (currentMP < mpCost) return; 

        // 2. 扣除 MP (由於是 SyncVar，客戶端的 MP 會自動更新)
        currentMP -= mpCost;

        // 3. 伺服器端進行物理碰撞偵測 (Hitbox)
        Collider2D[] hitEnemies = Physics2D.OverlapCircleAll(transform.position, 2f); // 假設半徑 2
        foreach (var enemy in hitEnemies)
        {
            if (enemy.CompareTag("Monster"))
            {
                // 伺服器計算傷害
                int damage = Random.Range(10, 20); 
                enemy.GetComponent<NetworkMonster>().TakeDamage(damage);

                // 4. 告訴所有客戶端「這個怪物頭上要跳傷害數字」
                RpcShowDamageText(enemy.transform.position, damage);
            }
        }

        // 5. 告訴所有其他玩家，播放我的技能特效
        RpcPlaySkillEffect(skillID);
    }

    // 廣播給所有客戶端播放特效
    [ClientRpc]
    void RpcPlaySkillEffect(int skillID)
    {
        // 除了自己以外 (自己剛剛已經播過了)，其他人要看到我揮劍的特效
        if (!isLocalPlayer)
        {
            GetComponent<Animator>().SetTrigger("Attack");
        }
        // 實例化劍氣特效...
    }

    // 廣播給所有客戶端顯示傷害跳字
    [ClientRpc]
    void RpcShowDamageText(Vector3 pos, int damage)
    {
        DamageTextManager.Instance.ShowDamageText(damage, false, pos + Vector3.up);
    }
}


網路同步設計重點總結：

Never Trust the Client (永遠不要相信客戶端)：客戶端只負責「請求」，傷害計算與扣血一定要在 Server 執行。

Client Prediction (客戶端預測)：為了讓玩家覺得遊戲很順，按下按鍵時，自己畫面的特效和動畫可以先播，不用等伺服器同意（如程式碼中的 SetTrigger("Attack")），但實質的傷害與結果依然由伺服器派發。