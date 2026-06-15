🍁 階段三：傷害跳字系統 (Object Pool) 與怪物巡邏 AI

在這個階段，我們將實現 RPG 最核心的打擊回饋：「傷害跳字」，並讓木樁怪物動起來，對玩家造成威脅。

第一部分：傷害數字跳字與物件池技術 (Damage Text)

為什麼不用 Instantiate 和 Destroy？
楓之谷中，一個技能可能打出好幾排數字。如果每次攻擊都動態生成 (Instantiate) 數字，播完動畫又銷毀 (Destroy)，會引發大量的垃圾回收 (Garbage Collection, GC)，導致遊戲瞬間卡頓。
解決方案是「物件池 (Object Pool)」：我們預先生成 50 個數字隱藏在場景中，需要時拿出來用，用完後隱藏放回池子裡重複使用。

1. 建立文字預製體 (Prefab)

在 Unity 中，確保你已匯入 TextMeshPro (TMP)。

建立一個空的 GameObject，命名為 DamageTextPrefab。

在底下新增一個 TextMeshPro - Text，設定為 World Space（非 UI Canvas），調整大小、字型（建議找個像素字型），並加上黑色描邊 (Outline) 增加可讀性。

2. 傷害文字控制腳本 (DamageText.cs)

掛載在 DamageTextPrefab 上。此腳本控制數字往上飄、淡出，並根據是否「爆擊」改變顏色與大小。

using UnityEngine;
using TMPro;

public class DamageText : MonoBehaviour
{
    public TextMeshPro textMesh;
    public float floatSpeed = 2f;      // 向上飄移的速度
    public float lifetime = 1f;        // 存活時間
    private float timer = 0f;

    private Color normalColor = Color.white;
    private Color critColor = Color.yellow; // 爆擊為黃色

    // 初始化文字並設定效果
    public void Setup(int damage, bool isCrit)
    {
        timer = 0f;
        textMesh.text = damage.ToString();
        textMesh.alpha = 1f;

        if (isCrit)
        {
            textMesh.color = critColor;
            textMesh.fontSize = 8f; // 爆擊數字變大
            // 爆擊時可以在文字後面加個 '!' 或是使用不同的字體材質
        }
        else
        {
            textMesh.color = normalColor;
            textMesh.fontSize = 5f;
        }
    }

    void Update()
    {
        timer += Time.deltaTime;

        // 1. 往上飄移
        transform.position += Vector3.up * floatSpeed * Time.deltaTime;

        // 2. 後半段時間開始淡出 (Alpha 漸隱)
        float halfLife = lifetime / 2f;
        if (timer > halfLife)
        {
            float alpha = 1f - ((timer - halfLife) / halfLife);
            textMesh.alpha = alpha;
        }

        // 3. 時間到，回歸物件池
        if (timer >= lifetime)
        {
            DamageTextManager.Instance.ReturnToPool(this.gameObject);
        }
    }
}


3. 物件池管理器 (DamageTextManager.cs)

這是一個單例 (Singleton) 腳本，掛載在場景中的空物件上，用來管理所有的傷害數字。

using System.Collections.Generic;
using UnityEngine;

public class DamageTextManager : MonoBehaviour
{
    public static DamageTextManager Instance;

    public GameObject damageTextPrefab;
    public int poolSize = 30; // 預先生成的數量

    private Queue<GameObject> textPool = new Queue<GameObject>();

    void Awake()
    {
        Instance = this;
        // 初始化物件池
        for (int i = 0; i < poolSize; i++)
        {
            GameObject obj = Instantiate(damageTextPrefab, transform);
            obj.SetActive(false);
            textPool.Enqueue(obj);
        }
    }

    // 從池子中拿出文字
    public void ShowDamageText(int damage, bool isCrit, Vector3 position)
    {
        GameObject textObj;

        if (textPool.Count > 0)
        {
            textObj = textPool.Dequeue();
        }
        else
        {
            // 如果池子空了（同畫面傷害太多），就擴增池子
            textObj = Instantiate(damageTextPrefab, transform);
        }

        textObj.transform.position = position;
        textObj.SetActive(true);

        // 設定數值與特效
        textObj.GetComponent<DamageText>().Setup(damage, isCrit);
    }

    // 放回池子
    public void ReturnToPool(GameObject textObj)
    {
        textObj.SetActive(false);
        textPool.Enqueue(textObj);
    }
}


整合：現在只要在怪物的 TakeDamage 方法裡加入 DamageTextManager.Instance.ShowDamageText(damage, false, transform.position + Vector3.up); 就能看到跳字了！

第二部分：怪物 AI 與玩家受擊 (Touch Damage & Knockback)

楓之谷的怪物有幾個特性：

會在平台上左右巡邏。

走到懸崖邊緣或撞到牆壁會轉向。

玩家碰到怪物會受傷，並產生「往後上方彈飛 (Knockback)」加上「短暫無敵閃爍 (I-frames)」的效果。

1. 怪物巡邏 AI (MonsterAI.cs)

將這個腳本掛載到帶有 Rigidbody2D 和 BoxCollider2D 的怪物上。
需要在怪物前方建立兩個空物件作為探測點：

GroundDetect: 放在怪物身前稍微靠下的位置（探測懸崖）。

WallDetect: 放在怪物身前中間的位置（探測牆壁）。

using UnityEngine;

[RequireComponent(typeof(Rigidbody2D))]
public class MonsterAI : MonoBehaviour
{
    public float moveSpeed = 2f;
    public int touchDamage = 10;
    
    public Transform groundDetect; // 懸崖探測點
    public Transform wallDetect;   // 牆壁探測點
    public LayerMask groundLayer;  // 地面圖層

    private Rigidbody2D rb;
    private bool movingRight = true;

    void Start()
    {
        rb = GetComponent<Rigidbody2D>();
    }

    void Update()
    {
        // 往前移動
        rb.velocity = new Vector2((movingRight ? moveSpeed : -moveSpeed), rb.velocity.y);

        // 偵測前方有沒有路 (懸崖)
        RaycastHit2D groundInfo = Physics2D.Raycast(groundDetect.position, Vector2.down, 0.5f, groundLayer);
        // 偵測前方有沒有牆壁
        RaycastHit2D wallInfo = Physics2D.Raycast(wallDetect.position, (movingRight ? Vector2.right : Vector2.left), 0.2f, groundLayer);

        // 如果前方沒路了，或是撞到牆壁，就轉向
        if (groundInfo.collider == false || wallInfo.collider == true)
        {
            Flip();
        }
    }

    private void Flip()
    {
        movingRight = !movingRight;
        // 翻轉 Sprite
        Vector3 scaler = transform.localScale;
        scaler.x *= -1;
        transform.localScale = scaler;
    }

    // 處理玩家碰到怪物的碰撞傷害
    private void OnCollisionStay2D(Collision2D collision)
    {
        if (collision.gameObject.CompareTag("Player"))
        {
            PlayerHealth playerHealth = collision.gameObject.GetComponent<PlayerHealth>();
            if (playerHealth != null)
            {
                // 計算擊退方向 (怪物中心點指向玩家中心點)
                Vector2 knockbackDir = (collision.transform.position - transform.position).normalized;
                playerHealth.TakeDamage(touchDamage, knockbackDir);
            }
        }
    }
}


2. 玩家受擊與無敵時間 (PlayerHealth.cs)

掛載在玩家 (Player) 物件上。這會和我們階段一寫的 PlayerController 連動，受擊時會鎖定玩家的操作。

using System.Collections;
using UnityEngine;

[RequireComponent(typeof(PlayerController))]
public class PlayerHealth : MonoBehaviour
{
    public int maxHealth = 100;
    private int currentHealth;

    [Header("受擊設定")]
    public float invincibilityDuration = 1.5f; // 無敵時間
    public Vector2 knockbackForce = new Vector2(5f, 5f); // 擊退力道 (X與Y)
    
    private bool isInvincible = false;
    
    private Rigidbody2D rb;
    private SpriteRenderer[] sprites; // 因為紙娃娃有多個部位，需要抓取所有 SpriteRenderer
    private PlayerController playerController;

    void Start()
    {
        currentHealth = maxHealth;
        rb = GetComponent<Rigidbody2D>();
        playerController = GetComponent<PlayerController>();
        // 抓取底下所有的 SpriteRenderer (包含武器、衣服等)
        sprites = GetComponentsInChildren<SpriteRenderer>(); 
    }

    public void TakeDamage(int damage, Vector2 knockbackDir)
    {
        if (isInvincible) return; // 如果在無敵狀態則免疫傷害

        currentHealth -= damage;
        Debug.Log($"玩家受到 {damage} 點傷害！剩餘 HP: {currentHealth}");

        if (currentHealth <= 0)
        {
            Die();
            return;
        }

        // 觸發擊退與無敵
        StartCoroutine(HurtRoutine(knockbackDir));
    }

    private IEnumerator HurtRoutine(Vector2 knockbackDir)
    {
        isInvincible = true;

        // 1. 鎖定玩家移動
        playerController.SetMovementLock(true);

        // 2. 清除當前速度，並施加擊退力 (Knockback)
        rb.velocity = Vector2.zero;
        // 決定擊退是向左還是向右，Y軸固定給予向上的力
        float knockbackX = (knockbackDir.x > 0) ? knockbackForce.x : -knockbackForce.x;
        rb.AddForce(new Vector2(knockbackX, knockbackForce.y), ForceMode2D.Impulse);

        // 3. 播放受擊動畫與閃爍特效
        // anim.SetTrigger("Hurt"); // 如果有受擊動畫的話
        StartCoroutine(FlickerRoutine());

        // 受擊硬直時間 (通常比無敵時間短，例如 0.5 秒後就可以在空中控制移動)
        yield return new WaitForSeconds(0.5f);
        playerController.SetMovementLock(false);

        // 繼續等待剩下的無敵時間
        yield return new WaitForSeconds(invincibilityDuration - 0.5f);
        isInvincible = false;
    }

    // 處理紙娃娃無敵閃爍的協程
    private IEnumerator FlickerRoutine()
    {
        float timer = 0f;
        bool isVisible = true;

        while (isInvincible)
        {
            timer += Time.deltaTime;
            if (timer >= 0.1f) // 每 0.1 秒閃爍一次
            {
                isVisible = !isVisible;
                foreach (SpriteRenderer sr in sprites)
                {
                    // 調整透明度達到閃爍效果
                    Color c = sr.color;
                    c.a = isVisible ? 1f : 0.3f; 
                    sr.color = c;
                }
                timer = 0f;
            }
            yield return null;
        }

        // 確保最後恢復完全不透明
        foreach (SpriteRenderer sr in sprites)
        {
            Color c = sr.color;
            c.a = 1f;
            sr.color = c;
        }
    }

    private void Die()
    {
        Debug.Log("玩家死亡 (墓碑掉落)");
        // 鎖定控制、播放死亡動畫、彈出復活 UI 等
        playerController.SetMovementLock(true);
        // 可以掛載飄靈魂或掉墓碑的特效
    }
}


第三部分：設計重點解析

碰撞偵測使用 OnCollisionStay2D：如果使用 Enter，玩家若一直貼著怪物不放，無敵時間結束後就不會再受傷了。使用 Stay 配合 isInvincible 判斷，能完美重現「無敵時間一結束，如果還碰到怪物就會立刻被彈飛」的楓之谷機制。

紙娃娃群體閃爍：由於我們的角色是多個圖層組成（頭、手、身體、武器），所以在 FlickerRoutine 中，我們使用 GetComponentsInChildren<SpriteRenderer>() 一次取得所有部位，讓全身同步閃爍。

射線檢測 (Raycast) 的威力：怪物在邊緣轉向不依賴碰撞體，而是像盲人拿拐杖一樣往地下戳一根射線 (Raycast)。這是 2D 平台遊戲中最穩健、效能最好的巡邏判定作法。

🍁 階段四：屬性與傷害計算公式 (Stat Manager)

新楓之谷最具特色的設計之一就是極大化與極小化傷害的落差。法師、戰士、弓箭手等不同職業，都有各自對應的「主屬性」、「副屬性」、「武器係數」以及「熟練度 (Mastery)」。

1. 經典傷害計算公式解析

在經典的楓之谷數值架構中：

最大魔法/物理傷害 (Max Damage)：


$$MaxDamage = \frac{(PrimaryStat \times 4 + SecondaryStat) \times WeaponAttack \times WeaponMultiplier}{100}$$

最小魔法/物理傷害 (Min Damage)：


$$MinDamage = \frac{(PrimaryStat \times 4 \times Mastery + SecondaryStat) \times WeaponAttack \times WeaponMultiplier}{100}$$

其中：

PrimaryStat (主屬性)：戰士為 STR，弓箭手為 DEX，刺客為 LUK，法師為 INT。

SecondaryStat (副屬性)：戰士為 DEX，弓箭手為 STR，刺客為 DEX，法師為 LUK。

WeaponAttack (總攻擊力)：裝備、藥水、輔助技能所提供的總物理/魔法攻擊力。

WeaponMultiplier (武器乘數)：例如：單手劍為 1.20，雙手劍為 1.34，弓為 1.20，投擲武器為 1.75（不同武器有不同的揮舞與係數設定）。

Mastery (熟練度)：介於 0.10 到 0.90 之間（由技能決定，熟練度越高，最大與最小傷害的差距就越小，輸出就越穩定）。

2. 實作屬性管理器 (StatManager.cs)

掛載在玩家 (Player) 身上，負責記錄人物屬性並動態計算每次攻擊所產生的傷害數值。

using UnityEngine;

public class StatManager : MonoBehaviour
{
    public static StatManager Instance;

    [Header("角色基本屬性")]
    public int level = 1;
    public int str = 12;
    public int dex = 5;
    public int luk = 4;
    public int intel = 4;

    [Header("裝備與攻擊設定")]
    public int weaponAttack = 15;        // 武器攻擊力 + 裝備攻擊力
    public float weaponMultiplier = 1.34f; // 假設是雙手劍 1.34
    [Range(0.1f, 0.9f)]
    public float mastery = 0.6f;          // 熟練度：60%

    [Header("爆擊設定")]
    [Range(0f, 1f)]
    public float critRate = 0.3f;         // 爆擊率 30%
    public float critMultiplier = 1.5f;   // 爆擊傷害加成 150%

    void Awake()
    {
        if (Instance == null) Instance = this;
        else Destroy(gameObject);
    }

    // 計算單次隨機傷害與是否爆擊
    public (int damage, bool isCrit) CalculateDamage()
    {
        // 假設以戰士為例：主屬性 = STR, 副屬性 = DEX
        float primary = str;
        float secondary = dex;

        // 1. 計算最大傷害與最小傷害
        float maxDmg = (primary * 4f + secondary) * weaponAttack * weaponMultiplier / 100f;
        float minDmg = (primary * 4f * mastery + secondary) * weaponAttack * weaponMultiplier / 100f;

        // 2. 在最大與最小傷害之間取隨機整數
        int baseDamage = Mathf.RoundToInt(Random.Range(minDmg, maxDmg));

        // 3. 判定爆擊
        bool isCrit = Random.value < critRate;
        if (isCrit)
        {
            baseDamage = Mathf.RoundToInt(baseDamage * critMultiplier);
        }

        // 確保傷害最低為 1
        baseDamage = Mathf.Max(1, baseDamage);

        return (baseDamage, isCrit);
    }
}


3. 連動戰鬥與跳字系統

更新上一章節中，玩家觸發攻擊（如 PlayerAttack.cs）時的邏輯。當 Hitbox 偵測到怪物時，直接向 StatManager 索取計算好的傷害，並將數值丟給傷害跳字與怪物的受擊方法。

// 玩家攻擊腳本片段：
void PerformAttack()
{
    // 取得當前 Hitbox 範圍內的怪物
    Collider2D[] hitEnemies = Physics2D.OverlapBoxAll(attackPoint.position, attackRange, 0f, enemyLayer);

    foreach (Collider2D enemy in hitEnemies)
    {
        // 1. 計算該次攻擊的數值
        var (damage, isCrit) = StatManager.Instance.CalculateDamage();

        // 2. 顯示楓之谷風格跳字 (稍微在怪物上方產生)
        Vector3 textSpawnPos = enemy.transform.position + Vector3.up * 1.5f;
        DamageTextManager.Instance.ShowDamageText(damage, isCrit, textSpawnPos);

        // 3. 扣除怪物血量
        EnemyHealth enemyHealth = enemy.GetComponent<EnemyHealth>();
        if (enemyHealth != null)
        {
            enemyHealth.TakeDamage(damage);
        }
    }
}


🍁 階段五：瓦片地圖與視差滾動 (Tilemap & Parallax)

新楓之谷的經典地圖（如魔法森林、玩具城）具有極強的空間深度感。這要歸功於 2D Tilemap (瓦片地圖) 搭建的高度差平台，以及背景中多個圖層以不同速度移動所產生的 視差滾動效果 (Parallax Effect)。

1. 2D Tilemap 搭建（結構規範）

在 Unity 中，我們推薦使用以下的分層設計（Sorting Layers）來避免碰撞與視覺混亂：

排序圖層 (Sorting Layer)

目的

是否有碰撞體 (Collider)

Background (多層)

遠景（天空、雲朵、遠山、城堡外觀）

否

Midground_Back

玩家後方的裝飾（路燈、樹木、背景房屋）

否

Platforms (預設)

玩家踩踏的地面、斜坡、單向平台

是 (Tilemap Collider 2D)

Player / Monster

角色與怪物的動態紙娃娃渲染層

否（由 Rigidbody 處理）

Midground_Front

玩家前方的遮擋物（前排草叢、前景樹葉）

否

UI

血條、技能欄、聊天視窗

否

2. 視差滾動核心原理

當相機往右移動 10 個單位時：

最遠的背景（例如月亮、天空）應該跟著相機移動 10 個單位（相對於玩家等於完全不動，Speed = 1）。

中景的群山應該移動 5 個單位（產生稍微向後退的視覺效果，Speed = 0.5）。

前景與平台完全不移動（Speed = 0）。

3. 經典視差滾動腳本 (ParallaxBackground.cs)

將此腳本掛載在背景的每一個獨立圖層（如：背景天空、遠山、近處樹林）上。為了讓背景可以無限循環，我們還加入了無縫拼接自我重置 (Looping) 的邏輯。

using UnityEngine;

public class ParallaxBackground : MonoBehaviour
{
    [Header("相機參考")]
    public Transform cameraTransform;

    [Header("視差係數")]
    [Tooltip("0 代表跟隨玩家(最遠)，1 代表完全不跟隨(像前景一樣快)")]
    public Vector2 parallaxEffectMultiplier;

    private Vector3 lastCameraPosition;
    private float textureUnitSizeX;

    void Start()
    {
        if (cameraTransform == null)
        {
            cameraTransform = Camera.main.transform;
        }

        lastCameraPosition = cameraTransform.position;

        // 取得當前背景圖片的寬度，用於水平無縫拼接重置
        SpriteRenderer spriteRenderer = GetComponent<SpriteRenderer>();
        if (spriteRenderer != null)
        {
            Sprite sprite = spriteRenderer.sprite;
            Texture2D texture = sprite.texture;
            // 計算圖片在世界座標下的寬度 (像素寬度 / 每單位像素)
            textureUnitSizeX = texture.width / sprite.pixelsPerUnit;
        }
    }

    void LateUpdate()
    {
        // 1. 計算相機的移動差值 (Delta Position)
        Vector3 deltaMovement = cameraTransform.position - lastCameraPosition;

        // 2. 根據視差係數移動背景位置
        transform.position += new Vector3(
            deltaMovement.x * parallaxEffectMultiplier.x,
            deltaMovement.y * parallaxEffectMultiplier.y,
            0
        );

        lastCameraPosition = cameraTransform.position;

        // 3. 水平無縫循環 (當相機移動超過一張背景寬度時，自動將背景挪動到前方拼接)
        if (textureUnitSizeX > 0f)
        {
            float offsetPositionX = cameraTransform.position.x - transform.position.x;
            if (Mathf.Abs(offsetPositionX) >= textureUnitSizeX)
            {
                float offsetSign = Mathf.Sign(offsetPositionX);
                transform.position = new Vector3(
                    transform.position.x + (textureUnitSizeX * offsetSign),
                    transform.position.y,
                    transform.position.z
                );
            }
        }
    }
}


4. 視差滾動設定指南

背景素材結構：將背景圖繪製成可無縫拼接的圖片（即圖片的左邊界與右邊界可以完美接合）。

複製三張：在場景中將同一圖層的背景複製成三張，依序排開（例如 X=0, X=寬度, X=-寬度），並將它們放到同一個父物件下。將 ParallaxBackground.cs 掛載在此父物件上。

參數設定：

天空、雲朵 (最遠)：parallaxEffectMultiplier 設為 (0.9, 0.9)（幾乎跟著相機走）。

遠山：parallaxEffectMultiplier 設為 (0.6, 0.4)。

近處樹林/廢墟 (中景)：parallaxEffectMultiplier 設為 (0.3, 0.2)。

地面/平台：不掛載腳本。

透過這個設定，在相機左右移動與跳躍時，場景會呈現出極具深度與呼吸感的動態空間感，這就是新楓之谷地圖精緻好玩的秘密！