🍁 階段一：角色控制器與單向平台實作 (Unity 2D)

要完美重現新楓之谷的手感，我們不能完全依賴現實世界的物理法則。我們需要的是「街機/動作遊戲」的物理手感。

1. Unity 物理環境與組件設置

在開始寫程式之前，設定好物件的參數是成功的一半。

1.1 玩家角色 (Player) 設定

建立一個 2D Sprite 作為玩家。

加入 Rigidbody2D (2D 剛體)：

Body Type: Dynamic

Collision Detection: Continuous (避免穿牆)

Interpolate: Interpolate (讓移動畫面更平滑)

Gravity Scale: 3 到 4 (非常重要！預設的 1 太飄了，楓之谷的重力較強，下落快)。

Constraints: 勾選 Freeze Rotation Z (角色才不會跌倒滾動)。

加入 BoxCollider2D 或是 CapsuleCollider2D，調整大小符合角色身體。在腳底設定一個較小的空物件作為 GroundCheck (地面檢測點)。

1.2 單向平台 (One-Way Platform) 設定

楓之谷中，大部分的地面都是可以從下方跳上去的單向平台。

建立地面的 Sprite 或 Tilemap。

加入 BoxCollider2D (或 TilemapCollider2D)，並勾選 Used By Effector。

加入 PlatformEffector2D 組件：

確保 Use One Way 被勾選。

這會讓角色可以從下方往上跳穿過平台，但站在上面時不會掉下去。

將平台的 Layer 設置為 Ground。

2. 核心邏輯解析

2.1 地面檢測 (Ground Check)

我們不能只靠碰撞事件來判斷是否在地面，因為楓之谷的跳躍判定很嚴格。我們會在角色腳底發射一個小圓形範圍 (Physics2D.OverlapCircle)，如果這個範圍碰到了 Ground 圖層，就代表角色著地，可以再次跳躍。

2.2 下跳機制 (Drop Down)

當玩家按下 下 + 跳躍 時，角色需要穿過當前站立的平台往下掉。
實作思路：當觸發下跳時，我們暫時忽略「玩家」與「當前平台」之間的碰撞，經過短暫時間 (例如 0.3 秒) 後再恢復碰撞，角色就會順利掉下去。

3. C# 完整腳本實作 (PlayerController.cs)

請在玩家物件上掛載這個腳本：

using System.Collections;
using UnityEngine;

[RequireComponent(typeof(Rigidbody2D))]
public class PlayerController : MonoBehaviour
{
    [Header("移動與跳躍參數")]
    public float moveSpeed = 5f;        // 移動速度
    public float jumpForce = 12f;       // 跳躍力道 (配合較高的 Gravity Scale)
    
    [Header("地面檢測")]
    public Transform groundCheck;       // 腳底的空物件位置
    public float groundCheckRadius = 0.1f;
    public LayerMask groundLayer;       // 設定為 Ground 圖層

    private Rigidbody2D rb;
    private float horizontalInput;
    private bool isGrounded;
    private GameObject currentOneWayPlatform; // 記錄當前踩著的單向平台

    void Start()
    {
        rb = GetComponent<Rigidbody2D>();
    }

    void Update()
    {
        // 1. 取得玩家輸入 (左右鍵)
        horizontalInput = Input.GetAxisRaw("Horizontal"); // 使用 GetAxisRaw 達到起步/煞車零延遲的俐落感

        // 2. 檢測是否在地面上
        CheckGrounded();

        // 3. 跳躍邏輯 (包含下跳)
        if (Input.GetButtonDown("Jump"))
        {
            // 如果按住「下」，且踩在單向平台上 -> 執行下跳
            if (Input.GetAxisRaw("Vertical") < 0 && currentOneWayPlatform != null)
            {
                StartCoroutine(FallThroughPlatform());
            }
            // 否則，如果人在地上 -> 執行一般跳躍
            else if (isGrounded)
            {
                Jump();
            }
        }
    }

    void FixedUpdate()
    {
        // 4. 物理移動處理 (放在 FixedUpdate 確保物理穩定)
        rb.velocity = new Vector2(horizontalInput * moveSpeed, rb.velocity.y);

        // 角色翻轉 (面向左或右)
        if (horizontalInput > 0)
            transform.localScale = new Vector3(1, 1, 1);
        else if (horizontalInput < 0)
            transform.localScale = new Vector3(-1, 1, 1);
    }

    private void CheckGrounded()
    {
        // 畫一個小圓圈檢測腳底是否碰到 groundLayer
        isGrounded = Physics2D.OverlapCircle(groundCheck.position, groundCheckRadius, groundLayer);
    }

    private void Jump()
    {
        // 直接設定垂直速度，確保每次跳躍高度一致，不受之前的 Y 軸力影響
        rb.velocity = new Vector2(rb.velocity.x, jumpForce);
    }

    // 處理單向平台下跳的協程
    private IEnumerator FallThroughPlatform()
    {
        Collider2D playerCollider = GetComponent<Collider2D>();
        Collider2D platformCollider = currentOneWayPlatform.GetComponent<Collider2D>();

        // 忽略玩家與平台的碰撞
        Physics2D.IgnoreCollision(playerCollider, platformCollider, true);

        // 等待 0.3 秒，讓角色有足夠時間穿過平台掉下去
        yield return new WaitForSeconds(0.3f);

        // 恢復碰撞
        Physics2D.IgnoreCollision(playerCollider, platformCollider, false);
    }

    // 當玩家踩到平台時，記錄該平台
    private void OnCollisionEnter2D(Collision2D collision)
    {
        if (collision.gameObject.CompareTag("OneWayPlatform"))
        {
            currentOneWayPlatform = collision.gameObject;
        }
    }

    // 當玩家離開平台時，清空記錄
    private void OnCollisionExit2D(Collision2D collision)
    {
        if (collision.gameObject.CompareTag("OneWayPlatform"))
        {
            currentOneWayPlatform = null;
        }
    }

    // 輔助功能：在編輯器中畫出 GroundCheck 範圍，方便調整
    private void OnDrawGizmosSelected()
    {
        if (groundCheck != null)
        {
            Gizmos.color = Color.red;
            Gizmos.DrawWireSphere(groundCheck.position, groundCheckRadius);
        }
    }
}


4. 關鍵細節總結與手感微調 (Tuning)

GetAxisRaw  vs GetAxis：
在 Update 中，我們使用 Input.GetAxisRaw("Horizontal")。這非常關鍵！楓之谷的移動是沒有「加速緩衝」的，按下去瞬間就達到最高速，放開瞬間就停止。GetAxisRaw 只會回傳 -1, 0, 1，能完美重現這種俐落感。

OneWayPlatform Tag：
記得去 Unity 的 Tags 列表新增一個名為 OneWayPlatform 的 Tag，並套用到你的單向平台物件上，這樣腳本裡面的 OnCollisionEnter2D 才能正確抓到要下跳的目標。

空氣阻力 (Air Control)：
楓之谷在空中的移動（左右方向）通常和在地面上一樣靈活。目前的程式碼 rb.velocity = new Vector2(horizontalInput * moveSpeed, rb.velocity.y); 已經實現了完全的空中控制。

🍁 階段一 (續)：角色動畫狀態機 (走路、跳躍、趴下)

在 2D 動作遊戲中，控制動畫最乾淨的做法是使用整數 (Integer) 或 列舉 (Enum) 來管理狀態，而不是使用一堆布林值 (Boolean) 互相干擾（例如避免同時出現 isWalking = true 且 isJumping = true 的矛盾情況）。

1. Unity Animator 參數設定

在你的 Player 物件上加入 Animator 組件。

建立一個新的 Animator Controller 並指派給 Player。

打開 Animator 視窗，在 Parameters (參數) 面板新增一個 Integer (整數) 參數，命名為 AnimState。
我們定義狀態如下：

0 = Idle (待機)

1 = Walk (走路)

2 = Jump/Fall (跳躍/下落空中狀態)

3 = Prone (趴下)

2. 動畫節點 (State) 與過渡 (Transitions) 設定

將你切好的 2D 動畫片段 (Animation Clips) 拖曳進 Animator 視窗，建立四個節點：Idle, Walk, Jump, Prone。
將 Idle 設為預設狀態 (Default State)。

接著，建立從 Any State 連接到這四個節點的 Transition (過渡線)：
(注意：點擊過渡線，在 Inspector 中取消勾選 Has Exit Time，並將 Transition Duration 設為 0，這樣動畫才會瞬間切換，符合像素遊戲的俐落感)

Any State -> Idle: 條件設定為 AnimState Equals 0

Any State -> Walk: 條件設定為 AnimState Equals 1

Any State -> Jump: 條件設定為 AnimState Equals 2

Any State -> Prone: 條件設定為 AnimState Equals 3

3. 碰撞體 (Hitbox) 動態調整準備

楓之谷中，趴下的主要功能是「躲避飛彈或上方攻擊」。因此，當進入趴下狀態時，角色的碰撞體高度必須縮小；站起來時再恢復。

請確保你的玩家物件使用的是 CapsuleCollider2D 或是 BoxCollider2D。在這個範例中，我們假設你使用的是 BoxCollider2D。

4. 升級版 C# 腳本 (PlayerController.cs)

我們將前一個腳本進行升級，加入動畫控制與趴下邏輯：

using System.Collections;
using UnityEngine;

[RequireComponent(typeof(Rigidbody2D))]
[RequireComponent(typeof(Animator))]
[RequireComponent(typeof(BoxCollider2D))] // 確保有碰撞體
public class PlayerController : MonoBehaviour
{
    [Header("移動與跳躍參數")]
    public float moveSpeed = 5f;
    public float jumpForce = 12f;
    
    [Header("地面檢測")]
    public Transform groundCheck;
    public float groundCheckRadius = 0.1f;
    public LayerMask groundLayer;

    [Header("碰撞體調整 (趴下機制)")]
    public Vector2 standColliderSize = new Vector2(0.8f, 1.5f); // 站立時的碰撞體大小
    public Vector2 standColliderOffset = new Vector2(0f, 0.75f); // 站立時的中心點
    public Vector2 proneColliderSize = new Vector2(0.8f, 0.6f);  // 趴下時的碰撞體大小
    public Vector2 proneColliderOffset = new Vector2(0f, 0.3f);  // 趴下時的中心點

    // 組件參考
    private Rigidbody2D rb;
    private Animator anim;
    private BoxCollider2D col;

    // 狀態變數
    private float horizontalInput;
    private float verticalInput;
    private bool isGrounded;
    private bool isProne;
    private GameObject currentOneWayPlatform;

    // 定義動畫狀態常數
    private const int STATE_IDLE = 0;
    private const int STATE_WALK = 1;
    private const int STATE_JUMP = 2;
    private const int STATE_PRONE = 3;

    void Start()
    {
        rb = GetComponent<Rigidbody2D>();
        anim = GetComponent<Animator>();
        col = GetComponent<BoxCollider2D>();
        
        // 初始化碰撞體大小
        SetColliderForStand();
    }

    void Update()
    {
        // 1. 取得輸入
        horizontalInput = Input.GetAxisRaw("Horizontal");
        verticalInput = Input.GetAxisRaw("Vertical");

        // 2. 檢測地面
        CheckGrounded();

        // 3. 判斷是否趴下 (在地面上且按下方向鍵)
        // 楓之谷設定：趴下時不能移動
        isProne = (isGrounded && verticalInput < 0);

        // 處理趴下的碰撞體變化
        if (isProne)
            SetColliderForProne();
        else
            SetColliderForStand();

        // 4. 跳躍與下跳邏輯
        if (Input.GetButtonDown("Jump"))
        {
            if (isProne && currentOneWayPlatform != null)
            {
                // 如果趴著(按住下) 且在單向平台上 -> 下跳
                StartCoroutine(FallThroughPlatform());
            }
            else if (isGrounded)
            {
                // 一般跳躍
                Jump();
            }
        }

        // 5. 更新動畫狀態機
        UpdateAnimationState();
    }

    void FixedUpdate()
    {
        // 物理移動處理
        if (isProne)
        {
            // 趴下時禁止左右移動，但保留 Y 軸掉落速度
            rb.velocity = new Vector2(0, rb.velocity.y);
        }
        else
        {
            // 正常移動
            rb.velocity = new Vector2(horizontalInput * moveSpeed, rb.velocity.y);
        }

        // 角色翻轉
        if (horizontalInput > 0 && !isProne)
            transform.localScale = new Vector3(1, 1, 1);
        else if (horizontalInput < 0 && !isProne)
            transform.localScale = new Vector3(-1, 1, 1);
    }

    private void UpdateAnimationState()
    {
        int currentState;

        if (!isGrounded)
        {
            currentState = STATE_JUMP; // 只要不在地上，就是空中/跳躍狀態
        }
        else if (isProne)
        {
            currentState = STATE_PRONE; // 在地上且按住下
        }
        else if (Mathf.Abs(horizontalInput) > 0.1f)
        {
            currentState = STATE_WALK; // 在地上且有左右移動
        }
        else
        {
            currentState = STATE_IDLE; // 其他情況為待機
        }

        // 傳遞給 Animator
        anim.SetInteger("AnimState", currentState);
    }

    private void CheckGrounded()
    {
        isGrounded = Physics2D.OverlapCircle(groundCheck.position, groundCheckRadius, groundLayer);
    }

    private void Jump()
    {
        rb.velocity = new Vector2(rb.velocity.x, jumpForce);
    }

    private IEnumerator FallThroughPlatform()
    {
        Collider2D playerCollider = GetComponent<Collider2D>();
        Collider2D platformCollider = currentOneWayPlatform.GetComponent<Collider2D>();

        Physics2D.IgnoreCollision(playerCollider, platformCollider, true);
        yield return new WaitForSeconds(0.3f);
        Physics2D.IgnoreCollision(playerCollider, platformCollider, false);
    }

    private void OnCollisionEnter2D(Collision2D collision)
    {
        if (collision.gameObject.CompareTag("OneWayPlatform"))
            currentOneWayPlatform = collision.gameObject;
    }

    private void OnCollisionExit2D(Collision2D collision)
    {
        if (collision.gameObject.CompareTag("OneWayPlatform"))
            currentOneWayPlatform = null;
    }

    // --- 碰撞體大小動態調整方法 ---
    private void SetColliderForStand()
    {
        if (col.size != standColliderSize)
        {
            col.size = standColliderSize;
            col.offset = standColliderOffset;
        }
    }

    private void SetColliderForProne()
    {
        if (col.size != proneColliderSize)
        {
            col.size = proneColliderSize;
            col.offset = proneColliderOffset;
        }
    }
}


5. 設計重點解析

優先級邏輯 (UpdateAnimationState)：
這個方法的 if-else 順序非常重要。我們最先判斷 !isGrounded，因為只要角色跳起或掉落，不論玩家是否按住方向鍵，都強制播放 Jump 動畫。接著判斷 isProne，最後才是 Walk 和 Idle。這完美重現了楓之谷的動畫優先級。

禁止移動 (FixedUpdate)：
當 isProne 為 true 時，我們將 X 軸速度強制設為 0 (rb.velocity = new Vector2(0, rb.velocity.y);)，這樣玩家就無法像蟲一樣在地上匍匐前進。

碰撞體變形 (SetColliderFor...)：
在實際開發中，你需要根據你的角色圖片大小，微調腳本中 standColliderSize (站立尺寸) 與 proneColliderSize (趴下尺寸) 的數值，確保趴下時判定框有確實降到半身的高度。