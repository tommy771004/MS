🍁 階段二：紙娃娃系統與基礎戰鬥互動 (Hitbox)

在這一個階段，我們將探討如何把角色「拆解」成多個部位以實作裝備更換，以及如何加入攻擊動作與打擊判定。

第一部分：紙娃娃系統 (Avatar System) 概念與架構

新楓之谷的角色並不是一張完整的圖，而是由幾十張小圖層疊加而成的。當你更換武器時，只有「武器」這個圖層的圖片被替換掉，身體其他部位不受影響。

1. 渲染圖層排序 (Sorting Order)

在 Unity 中，實作紙娃娃的核心在於 SpriteRenderer 的 Sorting Order (排序圖層)。數字越大的圖層會覆蓋在數字越小的圖層之上。

建議的基礎層級順序（由後到前）：

披風 (Cape) - Order: -5

身體 (Body) - Order: 0

褲子 (Pants) - Order: 5

上衣/套裝 (Shirt/Overall) - Order: 6

頭部 (Head) - Order: 10

臉部表情 (Face) - Order: 11

頭髮 (Hair) - Order: 12

手臂與手套 (Arm & Glove) - Order: 15

武器 (Weapon) - Order: 20

2. Unity 物件層級 (Hierarchy) 設定

在你的 Player 物件底下，建立多個空的子物件，並為它們都加上 SpriteRenderer 組件。

▼ Player (掛載 Rigidbody2D, BoxCollider2D, PlayerController)
    ▼ AvatarRoot (掛載 Animator，控制底下所有部位的動畫)
        - Body (SpriteRenderer)
        - Head (SpriteRenderer)
        - Face (SpriteRenderer)
        - Hair (SpriteRenderer)
        - Shirt (SpriteRenderer)
        - Pants (SpriteRenderer)
        - Weapon (SpriteRenderer)


動畫製作技巧：在 Unity 中錄製動畫時，你要在 AvatarRoot 上開啟 Animation 視窗，並同時對底下所有的部位進行位移或切換圖片的 Keyframe 紀錄。當你裝備新武器時，只要寫腳本將 Weapon 物件的 Sprite 替換掉，動畫就會自動帶著新武器揮動！

第二部分：基礎戰鬥互動 (Combat Box)

楓之谷的攻擊特色是：攻擊時通常無法移動（硬直），且判定範圍（Hitbox）是根據武器種類或技能而定。

我們不使用實體的 Collider 來做攻擊判定（容易發生物理推擠），而是使用程式碼 Physics2D.OverlapBox 在「揮刀的瞬間」掃描前方的區域。

1. 設置攻擊判定點 (Attack Point)

在 Player 底下建立一個空物件，命名為 AttackPoint，將它移到角色前方約半個身位的位置。

2. 建立木樁怪物腳本 (DummyEnemy.cs)

先寫一個簡單的怪物腳本，掛載在一個帶有 BoxCollider2D (圖層設為 Enemy) 的物件上。

using UnityEngine;

public class DummyEnemy : MonoBehaviour
{
    public int maxHealth = 100;
    private int currentHealth;

    // 受擊特效相關
    private SpriteRenderer spriteRenderer;
    private Color originalColor;

    void Start()
    {
        currentHealth = maxHealth;
        spriteRenderer = GetComponent<SpriteRenderer>();
        if (spriteRenderer != null)
            originalColor = spriteRenderer.color;
    }

    // 接收傷害的方法
    public void TakeDamage(int damage)
    {
        currentHealth -= damage;
        Debug.Log($"怪物受到 {damage} 點傷害！剩餘血量: {currentHealth}");

        // 簡單的受擊變紅特效
        if (spriteRenderer != null)
        {
            spriteRenderer.color = Color.red;
            Invoke("ResetColor", 0.15f); // 0.15秒後恢復原色
        }

        if (currentHealth <= 0)
        {
            Die();
        }
    }

    private void ResetColor()
    {
        spriteRenderer.color = originalColor;
    }

    private void Die()
    {
        Debug.Log("怪物死亡！");
        // 這裡可以加入掉落物或死亡動畫
        Destroy(gameObject);
    }
}


3. 升級角色控制器：加入攻擊邏輯 (PlayerCombat.cs)

為了保持程式碼乾淨，我們將戰鬥邏輯獨立寫成一個 PlayerCombat 腳本，掛載在與 PlayerController 同一個物件上。

(注意：你需要去 Unity 的 Layer 中新增一個 Enemy 圖層，並設定給怪物)

using System.Collections;
using UnityEngine;

[RequireComponent(typeof(Animator))]
[RequireComponent(typeof(PlayerController))] // 依賴我們先前寫的控制器
public class PlayerCombat : MonoBehaviour
{
    [Header("攻擊設定")]
    public Transform attackPoint;      // 攻擊判定中心點
    public Vector2 attackRange = new Vector2(1.5f, 1f); // 判定框大小
    public LayerMask enemyLayers;      // 哪些圖層算作敵人 (設定為 Enemy)
    public int attackDamage = 15;      // 攻擊力
    public float attackCooldown = 0.6f; // 攻擊冷卻時間 (也等於硬直時間)

    private Animator anim;
    private PlayerController playerController;
    private float nextAttackTime = 0f;
    
    // 定義動畫狀態常數 (延續之前的設定，新增攻擊狀態)
    private const int STATE_ATTACK = 4;

    void Start()
    {
        anim = GetComponent<Animator>();
        playerController = GetComponent<PlayerController>();
    }

    void Update()
    {
        // 偵測攻擊輸入 (假設使用左 Ctrl 鍵作為攻擊，可在 Input Manager 設定 "Fire1")
        if (Time.time >= nextAttackTime)
        {
            if (Input.GetButtonDown("Fire1") && playerController.IsGrounded())
            {
                Attack();
                nextAttackTime = Time.time + attackCooldown;
            }
        }
    }

    void Attack()
    {
        // 1. 觸發攻擊動畫
        anim.SetInteger("AnimState", STATE_ATTACK);

        // 2. 暫停玩家移動 (製造硬直)
        StartCoroutine(AttackStun(attackCooldown));

        // 3. 偵測範圍內的敵人
        // OverlapBox 參數：中心點, 大小, 旋轉角度, 目標圖層
        Collider2D[] hitEnemies = Physics2D.OverlapBoxAll(attackPoint.position, attackRange, 0f, enemyLayers);

        // 4. 對所有打到的敵人造成傷害
        foreach (Collider2D enemy in hitEnemies)
        {
            // 嘗試取得敵人身上的腳本
            DummyEnemy dummy = enemy.GetComponent<DummyEnemy>();
            if (dummy != null)
            {
                dummy.TakeDamage(attackDamage);
            }
        }
    }

    // 處理攻擊硬直的協程
    private IEnumerator AttackStun(float duration)
    {
        // 呼叫 PlayerController 的公開方法來鎖定移動
        playerController.SetMovementLock(true);
        
        yield return new WaitForSeconds(duration); // 等待攻擊動畫播完
        
        // 解除鎖定
        playerController.SetMovementLock(false);
    }

    // 在 Scene 視窗中畫出判定框，方便調整 attackRange 的大小與位置
    private void OnDrawGizmosSelected()
    {
        if (attackPoint == null) return;
        
        Gizmos.color = Color.red;
        Gizmos.DrawWireCube(attackPoint.position, attackRange);
    }
}


4. 配合修改 PlayerController.cs

為了讓 PlayerCombat 能鎖定移動，我們需要在上一階段的 PlayerController 腳本中加入兩個小修改：

新增變數與公開方法：

private bool isMovementLocked = false;

// 讓外部 (PlayerCombat) 可以控制移動鎖定
public void SetMovementLock(bool state)
{
    isMovementLocked = state;
}

// 讓外部可以確認是否在地面上
public bool IsGrounded()
{
    return isGrounded;
}


修改 FixedUpdate 與 UpdateAnimationState：
在處理移動與動畫的地方，加入 isMovementLocked 的判斷。

void FixedUpdate()
{
    // 如果被鎖定 (例如正在攻擊)，則 X 軸速度歸零，但保持 Y 軸重力
    if (isMovementLocked || isProne)
    {
        rb.velocity = new Vector2(0, rb.velocity.y);
        return; // 直接跳出，不處理後續移動
    }
    // ... 原本的移動與翻轉邏輯 ...
}


小提醒：因為 PlayerCombat 會將 AnimState 設為 4，所以在 PlayerController 的 UpdateAnimationState 中，如果 isMovementLocked 為 true，就不要去覆寫 AnimState，讓攻擊動畫可以完整播完。

5. 設計重點解析

解耦設計：我們將 PlayerCombat (戰鬥) 和 PlayerController (移動) 分開寫。這在大型專案中很重要，未來你加入魔法攻擊、技能系統時，不會把移動腳本弄得一團亂。

OnDrawGizmosSelected：這是一個極度實用的 Unity 內建方法。選取 Player 時，你可以在 Scene 視窗看到一個紅色的框框。這個框框就是揮劍的判定範圍，你可以直接調整 attackRange 的 X 和 Y 值，完美對齊你的武器揮擊特效。

無實體碰撞：我們使用 Physics2D.OverlapBoxAll 取代了實體的 Collider。這樣做的好處是，玩家揮砍時不會因為物理引擎的碰撞而把怪物「推開」，能確保打擊感扎實且穩定。