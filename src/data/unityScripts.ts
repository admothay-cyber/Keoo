export interface UnityScriptFile {
  filename: string;
  category: 'Mobile & Controls' | 'Core & Data' | 'Combat & Weapons' | 'Enemies & Spawning' | 'Town & Economy' | 'UI & Feedback';
  description: string;
  unityMenuPath?: string;
  code: string;
}

export const UNITY_SCRIPTS: UnityScriptFile[] = [
  {
    filename: 'MobileScreenConfig.cs',
    category: 'Mobile & Controls',
    description: 'Forces Landscape Fullscreen mode, hides OS status & navigation bars, and disables sleep timeout during gameplay.',
    code: `using UnityEngine;

namespace ARPG.Mobile
{
    /// <summary>
    /// Ensures the game runs in Landscape Fullscreen and hides mobile OS navigation/status bars.
    /// Attach this script to an initial GameManager or Bootstrapper GameObject in the first scene.
    /// </summary>
    public class MobileScreenConfig : MonoBehaviour
    {
        [Header("Orientation Settings")]
        [SerializeField] private bool allowAutoRotationLandscape = true;
        [SerializeField] private bool preventScreenSleep = true;

        private void Awake()
        {
            // 1. Force Landscape Fullscreen
            Screen.orientation = ScreenOrientation.LandscapeLeft;

            if (allowAutoRotationLandscape)
            {
                Screen.autorotateToLandscapeLeft = true;
                Screen.autorotateToLandscapeRight = true;
                Screen.autorotateToPortrait = false;
                Screen.autorotateToPortraitUpsideDown = false;
                Screen.orientation = ScreenOrientation.AutoRotation;
            }

            // 2. Hide OS Navigation Bar and Status Bar (Android Immersive Mode)
            Screen.fullScreen = true;

            // 3. Keep screen alive while gaming
            if (preventScreenSleep)
            {
                Screen.sleepTimeout = SleepTimeout.NeverSleep;
            }

            // Persistent across scene loads
            DontDestroyOnLoad(gameObject);
        }
    }
}
`,
  },

  {
    filename: 'VirtualJoystick.cs',
    category: 'Mobile & Controls',
    description: 'Virtual Joystick UI component placed at the bottom-left corner for 8-directional / analog touch movement.',
    code: `using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using ARPG.Core;

namespace ARPG.Mobile
{
    /// <summary>
    /// Virtual Joystick for mobile touch movement (Bottom-Left Corner).
    /// Implements Unity EventSystem handlers for smooth multi-touch dragging.
    /// </summary>
    public class VirtualJoystick : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler
    {
        public static VirtualJoystick Instance { get; private set; }

        [Header("UI Rect References")]
        [SerializeField] private RectTransform joystickBackground;
        [SerializeField] private RectTransform joystickHandle;

        [Header("Joystick Settings")]
        [SerializeField] private float handleRange = 75f;
        [SerializeField] private float deadZone = 0.1f;
        [SerializeField] private bool snapTo8Directions = false;

        private Vector2 inputVector = Vector2.zero;
        private Canvas parentCanvas;

        public Vector2 InputDirection => inputVector;

        private void Awake()
        {
            if (Instance == null) Instance = this;
            else Destroy(gameObject);

            parentCanvas = GetComponentInParent<Canvas>();
            if (joystickBackground == null) joystickBackground = GetComponent<RectTransform>();
        }

        public void OnPointerDown(PointerEventData eventData)
        {
            OnDrag(eventData);
        }

        public void OnDrag(PointerEventData eventData)
        {
            Vector2 position = RectTransformUtility.WorldToScreenPoint(parentCanvas.worldCamera, joystickBackground.position);
            Vector2 radius = joystickBackground.sizeDelta / 2f;

            inputVector = (eventData.position - position) / (radius * (parentCanvas != null ? parentCanvas.scaleFactor : 1f));
            inputVector = Vector2.ClampMagnitude(inputVector, 1f);

            // Deadzone check
            if (inputVector.magnitude < deadZone)
            {
                inputVector = Vector2.zero;
            }
            else if (snapTo8Directions)
            {
                inputVector = SnapTo8Dir(inputVector);
            }

            // Update handle knob UI position
            if (joystickHandle != null)
            {
                joystickHandle.anchoredPosition = inputVector * handleRange;
            }

            // Feed input into PlayerController
            if (PlayerController.Instance != null)
            {
                PlayerController.Instance.SetMobileMoveInput(inputVector);
            }
        }

        public void OnPointerUp(PointerEventData eventData)
        {
            inputVector = Vector2.zero;
            if (joystickHandle != null)
            {
                joystickHandle.anchoredPosition = Vector2.zero;
            }

            if (PlayerController.Instance != null)
            {
                PlayerController.Instance.SetMobileMoveInput(Vector2.zero);
            }
        }

        private Vector2 SnapTo8Dir(Vector2 dir)
        {
            float angle = Mathf.Atan2(dir.y, dir.x) * Mathf.Rad2Deg;
            float snappedAngle = Mathf.Round(angle / 45f) * 45f;
            float rad = snappedAngle * Mathf.Deg2Rad;
            return new Vector2(Mathf.Cos(rad), Mathf.Sin(rad)).normalized;
        }
    }
}
`,
  },

  {
    filename: 'TouchActionButton.cs',
    category: 'Mobile & Controls',
    description: 'Touch Action Button component placed at bottom-right for Main Attack, Skill 1, Skill 2, and Potions with cooldown radial fill.',
    code: `using System.Collections;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using TMPro;
using ARPG.Combat;
using ARPG.Core;

namespace ARPG.Mobile
{
    public enum ActionButtonType
    {
        BasicAttack,
        Skill1,
        Skill2,
        HealthPotion,
        InteractNPC
    }

    /// <summary>
    /// Mobile Touch Button with press animation, cooldown radial mask, and continuous hold support for basic attack.
    /// </summary>
    public class TouchActionButton : MonoBehaviour, IPointerDownHandler, IPointerUpHandler
    {
        [Header("Button Purpose")]
        [SerializeField] private ActionButtonType buttonType;

        [Header("Visual References")]
        [SerializeField] private Image buttonIcon;
        [SerializeField] private Image cooldownRadialMask; // Image Type = Filled (Radial 360)
        [SerializeField] private TextMeshProUGUI cooldownText;

        [Header("Settings")]
        [SerializeField] private float pressedScale = 0.9f;

        private bool isHeldDown = false;
        private Vector3 originalScale;
        private SkillSystem skillSystem;

        private void Awake()
        {
            originalScale = transform.localScale;
        }

        private void Start()
        {
            skillSystem = FindFirstObjectByType<SkillSystem>();
            if (skillSystem != null)
            {
                if (buttonType == ActionButtonType.Skill1)
                    skillSystem.OnSkill1CooldownChanged += UpdateCooldownVisual;
                else if (buttonType == ActionButtonType.Skill2)
                    skillSystem.OnSkill2CooldownChanged += UpdateCooldownVisual;
            }

            if (cooldownRadialMask != null) cooldownRadialMask.fillAmount = 0f;
            if (cooldownText != null) cooldownText.text = "";
        }

        public void OnPointerDown(PointerEventData eventData)
        {
            isHeldDown = true;
            transform.localScale = originalScale * pressedScale;

            ExecuteAction();
        }

        public void OnPointerUp(PointerEventData eventData)
        {
            isHeldDown = false;
            transform.localScale = originalScale;
        }

        private void Update()
        {
            // Continuous basic attack while holding down attack button
            if (isHeldDown && buttonType == ActionButtonType.BasicAttack)
            {
                if (skillSystem != null)
                {
                    skillSystem.TriggerBasicAttack();
                }
            }
        }

        private void ExecuteAction()
        {
            if (skillSystem == null) skillSystem = FindFirstObjectByType<SkillSystem>();

            switch (buttonType)
            {
                case ActionButtonType.BasicAttack:
                    skillSystem?.TriggerBasicAttack();
                    break;
                case ActionButtonType.Skill1:
                    skillSystem?.TriggerSkill1();
                    break;
                case ActionButtonType.Skill2:
                    skillSystem?.TriggerSkill2();
                    break;
                case ActionButtonType.HealthPotion:
                    PlayerController.Instance?.UseHealthPotion();
                    break;
                case ActionButtonType.InteractNPC:
                    // Send interaction signal to closest NPC
                    break;
            }
        }

        private void UpdateCooldownVisual(float currentCd, float maxCd)
        {
            if (cooldownRadialMask != null)
            {
                cooldownRadialMask.fillAmount = maxCd > 0 ? currentCd / maxCd : 0f;
            }

            if (cooldownText != null)
            {
                cooldownText.text = currentCd > 0.05f ? currentCd.ToString("F1") : "";
            }
        }
    }
}
`,
  },

  {
    filename: 'ClassDataSO.cs',
    category: 'Core & Data',
    description: 'ScriptableObject holding all archetype data (Fighter, Tank, Assassin, Marksman, Mage), stats, weapon configuration, and skill definitions.',
    unityMenuPath: 'Assets > Create > ARPG > Class Preset',
    code: `using UnityEngine;

namespace ARPG.Core
{
    public enum ClassType
    {
        Fighter,
        Tank,
        Assassin,
        Marksman,
        Mage
    }

    public enum AttackType
    {
        MeleeSlash,
        MeleeHeavyStab,
        RangedProjectile,
        MagicAoe
    }

    [System.Serializable]
    public class SkillData
    {
        public string skillName;
        [TextArea(2, 4)] public string description;
        public KeyCode defaultKey;
        public float cooldown = 4f;
        public float baseDamageMultiplier = 1.5f;
        public float manaOrEnergyCost = 0f;
        public Sprite icon;
        public GameObject effectOrProjectilePrefab;
    }

    [CreateAssetMenu(fileName = "NewClassPreset", menuName = "ARPG/Class Preset", order = 1)]
    public class ClassDataSO : ScriptableObject
    {
        [Header("Class Identity")]
        public ClassType classType;
        public string className;
        public Color classThemeColor = Color.white;
        [TextArea(2, 4)] public string loreDescription;

        [Header("Base Attributes")]
        public float maxHealth = 150f;
        public float moveSpeed = 6f;
        public float baseAttackDamage = 25f;
        [Range(0f, 1f)] public float critChance = 0.15f;
        public float critMultiplier = 2.0f;
        public float attacksPerSecond = 1.5f;

        [Header("Weapon Setup")]
        public string weaponName = "Default Weapon";
        public Sprite weaponSprite;
        public AttackType basicAttackType = AttackType.MeleeSlash;
        public GameObject basicAttackPrefab; // Melee hitbox or bullet/fireball prefab
        public float attackRange = 1.5f;
        public float projectileSpeed = 12f;

        [Header("Active Class Skills")]
        public SkillData skill1; // e.g. Whirlwind, Holy Shield, Shadow Dash, Arrow Barrage, Pyroclasm
        public SkillData skill2; // e.g. Battle Cry, Taunting Quake, Blade Spiral, Rain of Arrows, Frost Nova
    }
}
`,
  },

  {
    filename: 'PlayerController.cs',
    category: 'Core & Data',
    description: '8-Directional Top-Down movement (supports Virtual Joystick & WASD), auto-targeting/aiming, health, stats, and pickup interactions.',
    code: `using System;
using UnityEngine;
using ARPG.Combat;

namespace ARPG.Core
{
    [RequireComponent(typeof(Rigidbody2D), typeof(Collider2D))]
    public class PlayerController : MonoBehaviour
    {
        public static PlayerController Instance { get; private set; }

        [Header("Class Data & Stats")]
        [SerializeField] private ClassDataSO currentClassData;
        public ClassDataSO CurrentClassData => currentClassData;

        [Header("Movement & Input")]
        private Rigidbody2D rb;
        private Vector2 moveInput;
        private Vector2 mobileMoveInput;
        private Vector2 lookDirection = Vector2.right;

        [Header("Runtime State")]
        public float currentHealth;
        public float maxHealth;
        public float currentSpeed;
        public float bonusAttackDamage = 0f; // Upgraded via Town Shop
        public int goldCoins = 0;
        public int healthPotions = 2;
        public float potionHealAmount = 50f;

        [Header("References")]
        [SerializeField] private WeaponPivot weaponPivot;
        [SerializeField] private SkillSystem skillSystem;
        [SerializeField] private SpriteRenderer playerSpriteRenderer;

        // Events for UI subscription
        public event Action<float, float> OnHealthChanged;
        public event Action<int> OnGoldChanged;
        public event Action<int> OnPotionsChanged;
        public event Action OnPlayerDied;

        private void Awake()
        {
            if (Instance == null) Instance = this;
            else Destroy(gameObject);

            rb = GetComponent<Rigidbody2D>();
            rb.gravityScale = 0f;
            rb.freezeRotation = true;
        }

        private void Start()
        {
            if (currentClassData != null)
            {
                InitializeClass(currentClassData);
            }
        }

        public void InitializeClass(ClassDataSO newClass)
        {
            currentClassData = newClass;
            maxHealth = currentClassData.maxHealth;
            currentHealth = maxHealth;
            currentSpeed = currentClassData.moveSpeed;

            if (playerSpriteRenderer != null)
            {
                playerSpriteRenderer.color = currentClassData.classThemeColor;
            }

            if (weaponPivot != null)
            {
                weaponPivot.ConfigureWeapon(currentClassData);
            }

            if (skillSystem != null)
            {
                skillSystem.ConfigureSkills(currentClassData);
            }

            OnHealthChanged?.Invoke(currentHealth, maxHealth);
            OnGoldChanged?.Invoke(goldCoins);
            OnPotionsChanged?.Invoke(healthPotions);
        }

        public void SetMobileMoveInput(Vector2 mobileInput)
        {
            mobileMoveInput = mobileInput;
        }

        private void Update()
        {
            // 1. Gather Input: Combine Keyboard WASD with Mobile Virtual Joystick
            float moveX = Input.GetAxisRaw("Horizontal");
            float moveY = Input.GetAxisRaw("Vertical");
            Vector2 keyboardInput = new Vector2(moveX, moveY);

            if (mobileMoveInput.sqrMagnitude > 0.01f)
            {
                moveInput = mobileMoveInput;
            }
            else
            {
                moveInput = keyboardInput.normalized;
            }

            // 2. Aiming: Mouse Position on PC, or Movement Direction / Nearest Enemy on Mobile
            Vector2 aimTargetDir = Vector2.zero;

            #if UNITY_ANDROID || UNITY_IOS
            // Mobile: Aim towards nearest enemy or movement direction
            EnemyAI nearest = FindClosestEnemy(8f);
            if (nearest != null)
            {
                aimTargetDir = (nearest.transform.position - transform.position).normalized;
            }
            else if (moveInput.sqrMagnitude > 0.01f)
            {
                aimTargetDir = moveInput.normalized;
            }
            #else
            // Desktop: Mouse aim
            Vector3 mouseScreenPos = Input.mousePosition;
            mouseScreenPos.z = 10f;
            Vector3 mouseWorldPos = Camera.main.ScreenToWorldPoint(mouseScreenPos);
            aimTargetDir = (mouseWorldPos - transform.position).normalized;
            #endif

            if (aimTargetDir.sqrMagnitude > 0.01f)
            {
                lookDirection = aimTargetDir;
            }

            // Flip player sprite horizontally
            if (playerSpriteRenderer != null && Mathf.Abs(lookDirection.x) > 0.05f)
            {
                playerSpriteRenderer.flipX = lookDirection.x < 0;
            }

            // Aim Weapon Pivot
            if (weaponPivot != null)
            {
                weaponPivot.AimTowards(lookDirection);
            }

            // Quick Potion Keyboard Key
            if (Input.GetKeyDown(KeyCode.Q))
            {
                UseHealthPotion();
            }
        }

        private void FixedUpdate()
        {
            rb.linearVelocity = moveInput * currentSpeed;
        }

        private EnemyAI FindClosestEnemy(float searchRadius)
        {
            Collider2D[] hits = Physics2D.OverlapCircleAll(transform.position, searchRadius, LayerMask.GetMask("Enemy"));
            EnemyAI best = null;
            float closestDist = float.MaxValue;

            foreach (var hit in hits)
            {
                EnemyAI enemy = hit.GetComponent<EnemyAI>();
                if (enemy != null)
                {
                    float d = Vector2.Distance(transform.position, hit.transform.position);
                    if (d < closestDist)
                    {
                        closestDist = d;
                        best = enemy;
                    }
                }
            }
            return best;
        }

        public void TakeDamage(float damage, Vector2 knockbackDir = default, float knockbackForce = 0f)
        {
            currentHealth = Mathf.Max(0f, currentHealth - damage);
            OnHealthChanged?.Invoke(currentHealth, maxHealth);

            if (knockbackForce > 0f)
            {
                rb.AddForce(knockbackDir * knockbackForce, ForceMode2D.Impulse);
            }

            if (currentHealth <= 0f)
            {
                Die();
            }
        }

        public void Heal(float amount)
        {
            currentHealth = Mathf.Min(maxHealth, currentHealth + amount);
            OnHealthChanged?.Invoke(currentHealth, maxHealth);
        }

        public void UseHealthPotion()
        {
            if (healthPotions > 0 && currentHealth < maxHealth)
            {
                healthPotions--;
                Heal(potionHealAmount);
                OnPotionsChanged?.Invoke(healthPotions);
            }
        }

        public void AddGold(int amount)
        {
            goldCoins += amount;
            OnGoldChanged?.Invoke(goldCoins);
        }

        public bool SpendGold(int amount)
        {
            if (goldCoins >= amount)
            {
                goldCoins -= amount;
                OnGoldChanged?.Invoke(goldCoins);
                return true;
            }
            return false;
        }

        public float GetTotalAttackDamage()
        {
            float baseAtk = currentClassData != null ? currentClassData.baseAttackDamage : 20f;
            return baseAtk + bonusAttackDamage;
        }

        public Vector2 GetLookDirection() => lookDirection;

        private void Die()
        {
            rb.linearVelocity = Vector2.zero;
            OnPlayerDied?.Invoke();
            Debug.Log("Player Defeated!");
        }
    }
}
`,
  },

  {
    filename: 'WeaponPivot.cs',
    category: 'Combat & Weapons',
    description: 'Floating weapon that orbits around the player pointing at the aim direction. Flips sprite vertically when aiming left to prevent inverted weapons, and handles attack recoil/thrust animations.',
    code: `using System.Collections;
using UnityEngine;
using ARPG.Core;

namespace ARPG.Combat
{
    public class WeaponPivot : MonoBehaviour
    {
        [Header("Orbit Settings")]
        [SerializeField] private float orbitDistance = 0.8f;
        [SerializeField] private Transform weaponVisualTransform;
        [SerializeField] private SpriteRenderer weaponSpriteRenderer;

        [Header("Animation")]
        private bool isAttacking = false;
        private Vector3 initialLocalPos;

        private void Awake()
        {
            if (weaponVisualTransform != null)
            {
                initialLocalPos = weaponVisualTransform.localPosition;
            }
        }

        public void ConfigureWeapon(ClassDataSO classData)
        {
            if (weaponSpriteRenderer != null && classData.weaponSprite != null)
            {
                weaponSpriteRenderer.sprite = classData.weaponSprite;
                weaponSpriteRenderer.color = classData.classThemeColor;
            }
        }

        public void AimTowards(Vector2 aimDirection)
        {
            if (aimDirection.sqrMagnitude < 0.001f) return;

            // 1. Calculate angle in degrees
            float angle = Mathf.Atan2(aimDirection.y, aimDirection.x) * Mathf.Rad2Deg;
            transform.rotation = Quaternion.Euler(0f, 0f, angle);

            // 2. Position pivot slightly offset from player center
            transform.localPosition = (Vector3)(aimDirection.normalized * 0.15f);

            // 3. Flip weapon sprite along Y axis when aiming left so it stays upright
            if (weaponVisualTransform != null)
            {
                bool isAimingLeft = Mathf.Abs(angle) > 90f;
                weaponVisualTransform.localScale = new Vector3(
                    1f,
                    isAimingLeft ? -1f : 1f,
                    1f
                );
            }
        }

        public void TriggerThrustOrSwing()
        {
            if (!isAttacking && gameObject.activeInHierarchy)
            {
                StartCoroutine(ThrustAnimationRoutine());
            }
        }

        private IEnumerator ThrustAnimationRoutine()
        {
            isAttacking = true;
            float duration = 0.12f;
            float elapsed = 0f;

            Vector3 startPos = initialLocalPos;
            Vector3 peakPos = initialLocalPos + new Vector3(0.35f, 0f, 0f);

            // Thrust forward
            while (elapsed < duration * 0.5f)
            {
                elapsed += Time.deltaTime;
                weaponVisualTransform.localPosition = Vector3.Lerp(startPos, peakPos, elapsed / (duration * 0.5f));
                yield return null;
            }

            // Return to rest
            elapsed = 0f;
            while (elapsed < duration * 0.5f)
            {
                elapsed += Time.deltaTime;
                weaponVisualTransform.localPosition = Vector3.Lerp(peakPos, startPos, elapsed / (duration * 0.5f));
                yield return null;
            }

            weaponVisualTransform.localPosition = initialLocalPos;
            isAttacking = false;
        }

        public Transform GetFirePoint()
        {
            return weaponVisualTransform != null ? weaponVisualTransform : transform;
        }
    }
}
`,
  },

  {
    filename: 'SkillSystem.cs',
    category: 'Combat & Weapons',
    description: 'Handles Basic Attacks and the 2 active class skills with cooldown tracking, UI event delegates, and executes Fighter, Tank, Assassin, Marksman, and Mage archetypes.',
    code: `using System;
using System.Collections;
using UnityEngine;
using ARPG.Core;

namespace ARPG.Combat
{
    public class SkillSystem : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private PlayerController player;
        [SerializeField] private WeaponPivot weaponPivot;

        [Header("Cooldown Trackers")]
        private float lastBasicAttackTime = -10f;
        public float Skill1CooldownRemaining { get; private set; }
        public float Skill2CooldownRemaining { get; private set; }

        public event Action<float, float> OnSkill1CooldownChanged; // current, max
        public event Action<float, float> OnSkill2CooldownChanged;

        private ClassDataSO classData;

        public void ConfigureSkills(ClassDataSO data)
        {
            classData = data;
            Skill1CooldownRemaining = 0f;
            Skill2CooldownRemaining = 0f;
        }

        private void Update()
        {
            if (classData == null || player == null) return;

            // Update Cooldowns
            if (Skill1CooldownRemaining > 0f)
            {
                Skill1CooldownRemaining -= Time.deltaTime;
                OnSkill1CooldownChanged?.Invoke(Mathf.Max(0f, Skill1CooldownRemaining), classData.skill1.cooldown);
            }

            if (Skill2CooldownRemaining > 0f)
            {
                Skill2CooldownRemaining -= Time.deltaTime;
                OnSkill2CooldownChanged?.Invoke(Mathf.Max(0f, Skill2CooldownRemaining), classData.skill2.cooldown);
            }

            // Desktop Keyboard Shortcuts
            if (Input.GetMouseButton(0) || Input.GetKey(KeyCode.Space))
            {
                TriggerBasicAttack();
            }

            if (Input.GetMouseButtonDown(1) || Input.GetKeyDown(KeyCode.E))
            {
                TriggerSkill1();
            }

            if (Input.GetKeyDown(KeyCode.LeftShift) || Input.GetKeyDown(KeyCode.R))
            {
                TriggerSkill2();
            }
        }

        // Public methods called by both Desktop keys and Mobile Touch Buttons
        public void TriggerBasicAttack()
        {
            if (classData == null || player == null) return;

            float attackInterval = 1f / Mathf.Max(0.1f, classData.attacksPerSecond);
            if (Time.time - lastBasicAttackTime < attackInterval) return;

            lastBasicAttackTime = Time.time;
            weaponPivot.TriggerThrustOrSwing();

            Vector2 aimDir = player.GetLookDirection();

            float totalDmg = player.GetTotalAttackDamage();
            bool isCrit = UnityEngine.Random.value < classData.critChance;
            if (isCrit) totalDmg *= classData.critMultiplier;

            switch (classData.basicAttackType)
            {
                case AttackType.MeleeSlash:
                case AttackType.MeleeHeavyStab:
                    ExecuteMeleeSlash(aimDir, totalDmg, isCrit);
                    break;

                case AttackType.RangedProjectile:
                    SpawnProjectile(aimDir, totalDmg, isCrit, classData.projectileSpeed, 1, false);
                    break;

                case AttackType.MagicAoe:
                    SpawnProjectile(aimDir, totalDmg, isCrit, classData.projectileSpeed * 0.85f, 1, true);
                    break;
            }
        }

        public void TriggerSkill1()
        {
            if (classData == null || player == null || Skill1CooldownRemaining > 0f) return;
            Skill1CooldownRemaining = classData.skill1.cooldown;

            Vector2 aimDir = player.GetLookDirection();

            switch (classData.classType)
            {
                case ClassType.Fighter:
                    ExecuteWhirlwind();
                    break;
                case ClassType.Tank:
                    StartCoroutine(HolyAegisRoutine());
                    break;
                case ClassType.Assassin:
                    StartCoroutine(ShadowDashRoutine(aimDir));
                    break;
                case ClassType.Marksman:
                    ExecuteArrowBarrage(aimDir);
                    break;
                case ClassType.Mage:
                    SpawnProjectile(aimDir, player.GetTotalAttackDamage() * 2.5f, true, 9f, 999, true, 2.5f);
                    break;
            }
        }

        public void TriggerSkill2()
        {
            if (classData == null || player == null || Skill2CooldownRemaining > 0f) return;
            Skill2CooldownRemaining = classData.skill2.cooldown;

            switch (classData.classType)
            {
                case ClassType.Fighter:
                    StartCoroutine(BattleCryRoutine());
                    break;
                case ClassType.Tank:
                    ExecuteTauntSlam();
                    break;
                case ClassType.Assassin:
                    ExecuteBladeSpiral();
                    break;
                case ClassType.Marksman:
                    ExecuteRainOfArrows(transform.position + (Vector3)(player.GetLookDirection() * 3f));
                    break;
                case ClassType.Mage:
                    ExecuteFrostNova();
                    break;
            }
        }

        // ================= SPECIFIC SKILL IMPLEMENTATIONS =================

        private void ExecuteMeleeSlash(Vector2 aimDir, float damage, bool isCrit)
        {
            if (classData.basicAttackPrefab != null)
            {
                float angle = Mathf.Atan2(aimDir.y, aimDir.x) * Mathf.Rad2Deg;
                GameObject slash = Instantiate(classData.basicAttackPrefab, transform.position + (Vector3)(aimDir * 0.7f), Quaternion.Euler(0, 0, angle));
                DamageHitbox hitbox = slash.GetComponent<DamageHitbox>();
                if (hitbox != null)
                {
                    hitbox.Setup(damage, isCrit, aimDir, 5f);
                }
            }
        }

        private void SpawnProjectile(Vector2 aimDir, float damage, bool isCrit, float speed, int pierce, bool isAoe, float aoeRadius = 1.2f)
        {
            if (classData.basicAttackPrefab == null) return;
            float angle = Mathf.Atan2(aimDir.y, aimDir.x) * Mathf.Rad2Deg;
            Transform firePoint = weaponPivot.GetFirePoint();

            GameObject projObj = Instantiate(classData.basicAttackPrefab, firePoint.position, Quaternion.Euler(0, 0, angle));
            Projectile proj = projObj.GetComponent<Projectile>();
            if (proj != null)
            {
                proj.Initialize(aimDir, speed, damage, isCrit, pierce, isAoe, aoeRadius);
            }
        }

        private void ExecuteWhirlwind()
        {
            Collider2D[] hits = Physics2D.OverlapCircleAll(transform.position, 2.5f, LayerMask.GetMask("Enemy"));
            float damage = player.GetTotalAttackDamage() * 1.8f;
            foreach (var hit in hits)
            {
                EnemyAI enemy = hit.GetComponent<EnemyAI>();
                if (enemy != null)
                {
                    Vector2 dir = (hit.transform.position - transform.position).normalized;
                    enemy.TakeDamage(damage, true, dir, 8f);
                }
            }
        }

        private IEnumerator HolyAegisRoutine()
        {
            float duration = 4.0f;
            float elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                yield return null;
            }
        }

        private IEnumerator ShadowDashRoutine(Vector2 aimDir)
        {
            float dashDist = 4.0f;
            Vector2 start = transform.position;
            Vector2 target = start + aimDir * dashDist;

            RaycastHit2D[] hits = Physics2D.CircleCastAll(start, 0.5f, aimDir, dashDist, LayerMask.GetMask("Enemy"));
            float damage = player.GetTotalAttackDamage() * 2.2f;

            foreach (var hit in hits)
            {
                EnemyAI enemy = hit.collider.GetComponent<EnemyAI>();
                if (enemy != null)
                {
                    enemy.TakeDamage(damage, true, aimDir, 6f);
                }
            }

            transform.position = target;
            yield return null;
        }

        private void ExecuteArrowBarrage(Vector2 centerDir)
        {
            int arrowCount = 5;
            float spreadAngle = 35f;
            float startAngle = -spreadAngle * 0.5f;
            float step = spreadAngle / (arrowCount - 1);

            for (int i = 0; i < arrowCount; i++)
            {
                float currentOffset = startAngle + (i * step);
                Vector2 dir = Quaternion.Euler(0, 0, currentOffset) * centerDir;
                SpawnProjectile(dir, player.GetTotalAttackDamage() * 0.8f, false, classData.projectileSpeed * 1.2f, 2, false);
            }
        }

        private IEnumerator BattleCryRoutine()
        {
            player.bonusAttackDamage += 20f;
            player.currentSpeed *= 1.4f;
            yield return new WaitForSeconds(5.0f);
            player.bonusAttackDamage -= 20f;
            player.currentSpeed /= 1.4f;
        }

        private void ExecuteTauntSlam()
        {
            Collider2D[] hits = Physics2D.OverlapCircleAll(transform.position, 4.5f, LayerMask.GetMask("Enemy"));
            foreach (var hit in hits)
            {
                EnemyAI enemy = hit.GetComponent<EnemyAI>();
                if (enemy != null)
                {
                    Vector2 pullDir = (transform.position - hit.transform.position).normalized;
                    enemy.TakeDamage(player.GetTotalAttackDamage() * 1.2f, false, -pullDir, 10f);
                }
            }
        }

        private void ExecuteBladeSpiral()
        {
            int bladeCount = 8;
            for (int i = 0; i < bladeCount; i++)
            {
                float angle = i * (360f / bladeCount);
                Vector2 dir = Quaternion.Euler(0, 0, angle) * Vector2.right;
                SpawnProjectile(dir, player.GetTotalAttackDamage() * 1.0f, true, 10f, 3, false);
            }
        }

        private void ExecuteRainOfArrows(Vector3 targetCenter)
        {
            Collider2D[] hits = Physics2D.OverlapCircleAll(targetCenter, 3.0f, LayerMask.GetMask("Enemy"));
            foreach (var hit in hits)
            {
                EnemyAI enemy = hit.GetComponent<EnemyAI>();
                if (enemy != null)
                {
                    enemy.TakeDamage(player.GetTotalAttackDamage() * 2.0f, true, Vector2.down, 2f);
                }
            }
        }

        private void ExecuteFrostNova()
        {
            Collider2D[] hits = Physics2D.OverlapCircleAll(transform.position, 3.5f, LayerMask.GetMask("Enemy"));
            foreach (var hit in hits)
            {
                EnemyAI enemy = hit.GetComponent<EnemyAI>();
                if (enemy != null)
                {
                    enemy.TakeDamage(player.GetTotalAttackDamage() * 1.4f, false, (hit.transform.position - transform.position).normalized, 4f);
                    enemy.ApplySlow(0.4f, 3f);
                }
            }
        }
    }
}
`,
  },

  {
    filename: 'Projectile.cs',
    category: 'Combat & Weapons',
    description: 'Handles travel physics, pierce counts, collision with enemies, AOE blast triggers, and damage application.',
    code: `using UnityEngine;

namespace ARPG.Combat
{
    [RequireComponent(typeof(Collider2D))]
    public class Projectile : MonoBehaviour
    {
        [Header("Stats")]
        private Vector2 travelDirection;
        private float moveSpeed;
        private float damageAmount;
        private bool isCriticalHit;
        private int remainingPierce = 1;
        private bool isAreaOfEffect = false;
        private float aoeRadius = 1.2f;

        [Header("Lifetime")]
        [SerializeField] private float maxLifetime = 3.0f;
        [SerializeField] private GameObject hitVfxPrefab;

        public void Initialize(Vector2 direction, float speed, float damage, bool isCrit, int pierce = 1, bool aoe = false, float blastRadius = 1.2f)
        {
            travelDirection = direction.normalized;
            moveSpeed = speed;
            damageAmount = damage;
            isCriticalHit = isCrit;
            remainingPierce = pierce;
            isAreaOfEffect = aoe;
            aoeRadius = blastRadius;

            Destroy(gameObject, maxLifetime);
        }

        private void Update()
        {
            transform.position += (Vector3)(travelDirection * moveSpeed * Time.deltaTime);
        }

        private void OnTriggerEnter2D(Collider2D collision)
        {
            if (collision.CompareTag("Enemy"))
            {
                if (isAreaOfEffect)
                {
                    DetonateAoe();
                }
                else
                {
                    EnemyAI enemy = collision.GetComponent<EnemyAI>();
                    if (enemy != null)
                    {
                        enemy.TakeDamage(damageAmount, isCriticalHit, travelDirection, 3f);
                    }

                    remainingPierce--;
                    if (remainingPierce <= 0)
                    {
                        SpawnHitVfx();
                        Destroy(gameObject);
                    }
                }
            }
            else if (collision.CompareTag("Obstacle"))
            {
                if (isAreaOfEffect) DetonateAoe();
                else
                {
                    SpawnHitVfx();
                    Destroy(gameObject);
                }
            }
        }

        private void DetonateAoe()
        {
            Collider2D[] affected = Physics2D.OverlapCircleAll(transform.position, aoeRadius, LayerMask.GetMask("Enemy"));
            foreach (var col in affected)
            {
                EnemyAI enemy = col.GetComponent<EnemyAI>();
                if (enemy != null)
                {
                    Vector2 knockback = (col.transform.position - transform.position).normalized;
                    enemy.TakeDamage(damageAmount, isCriticalHit, knockback, 6f);
                }
            }

            SpawnHitVfx();
            Destroy(gameObject);
        }

        private void SpawnHitVfx()
        {
            if (hitVfxPrefab != null)
            {
                Instantiate(hitVfxPrefab, transform.position, Quaternion.identity);
            }
        }
    }
}
`,
  },

  {
    filename: 'DamageHitbox.cs',
    category: 'Combat & Weapons',
    description: 'Trigger collider for melee swings, cleaves, and ground slams. Deals damage to enemies once per swing and applies directional knockback.',
    code: `using System.Collections.Generic;
using UnityEngine;

namespace ARPG.Combat
{
    [RequireComponent(typeof(Collider2D))]
    public class DamageHitbox : MonoBehaviour
    {
        private float damage;
        private bool isCrit;
        private Vector2 knockbackDirection;
        private float knockbackForce;
        [SerializeField] private float lifetime = 0.15f;

        private readonly HashSet<EnemyAI> alreadyHit = new HashSet<EnemyAI>();

        public void Setup(float dmg, bool crit, Vector2 knockbackDir, float force)
        {
            damage = dmg;
            isCrit = crit;
            knockbackDirection = knockbackDir;
            knockbackForce = force;

            Destroy(gameObject, lifetime);
        }

        private void OnTriggerEnter2D(Collider2D collision)
        {
            if (collision.CompareTag("Enemy"))
            {
                EnemyAI enemy = collision.GetComponent<EnemyAI>();
                if (enemy != null && !alreadyHit.Contains(enemy))
                {
                    alreadyHit.Add(enemy);
                    // Quy tắc sát người: Nếu khoảng cách tới Player < 1.2f thì trừ 50% sát thương
                    float distToPlayer = ARPG.Core.PlayerController.Instance != null 
                        ? Vector2.Distance(enemy.transform.position, ARPG.Core.PlayerController.Instance.transform.position) 
                        : 5f;
                    float finalDmg = distToPlayer <= 1.2f ? damage * 0.5f : damage;
                    enemy.TakeDamage(finalDmg, isCrit, knockbackDirection, knockbackForce);
                }
            }
        }
    }
}
`,
  },

  {
    filename: 'EnemyAI.cs',
    category: 'Enemies & Spawning',
    description: 'Chases player with Rigidbody2D, takes damage with white flash and knockback, drops GoldGemPrefab on death, and notifies QuestManager.',
    code: `using System.Collections;
using UnityEngine;
using ARPG.Core;
using ARPG.Economy;

namespace ARPG.Combat
{
    [RequireComponent(typeof(Rigidbody2D), typeof(Collider2D))]
    public class EnemyAI : MonoBehaviour
    {
        [Header("Enemy Stats")]
        [SerializeField] private float maxHealth = 50f;
        [SerializeField] private float moveSpeed = 3.2f;
        [SerializeField] private float contactDamage = 10f;
        [SerializeField] private float attackCooldown = 1.0f;
        [SerializeField] private int goldDropAmount = 15;

        [Header("Loot Drop")]
        [SerializeField] private GameObject goldGemPrefab;

        private float currentHealth;
        private float currentSpeed;
        private float lastAttackTime = -10f;
        private Rigidbody2D rb;
        private SpriteRenderer spriteRenderer;
        private Color defaultColor;
        private Transform targetPlayer;

        private void Awake()
        {
            rb = GetComponent<Rigidbody2D>();
            rb.gravityScale = 0f;
            rb.freezeRotation = true;

            spriteRenderer = GetComponent<SpriteRenderer>();
            if (spriteRenderer != null)
            {
                defaultColor = spriteRenderer.color;
            }
        }

        private void Start()
        {
            currentHealth = maxHealth;
            currentSpeed = moveSpeed;

            if (PlayerController.Instance != null)
            {
                targetPlayer = PlayerController.Instance.transform;
            }
        }

        private void FixedUpdate()
        {
            if (targetPlayer == null) return;

            Vector2 toPlayer = (targetPlayer.position - transform.position);
            if (toPlayer.sqrMagnitude > 0.05f)
            {
                rb.linearVelocity = toPlayer.normalized * currentSpeed;
            }
            else
            {
                rb.linearVelocity = Vector2.zero;
            }
        }

        private void OnCollisionStay2D(Collision2D collision)
        {
            if (collision.gameObject.CompareTag("Player"))
            {
                if (Time.time - lastAttackTime >= attackCooldown)
                {
                    lastAttackTime = Time.time;
                    PlayerController player = collision.gameObject.GetComponent<PlayerController>();
                    if (player != null)
                    {
                        Vector2 knockback = (collision.transform.position - transform.position).normalized;
                        player.TakeDamage(contactDamage, knockback, 4f);
                    }
                }
            }
        }

        public void TakeDamage(float damage, bool isCrit, Vector2 knockbackDir, float knockbackForce)
        {
            currentHealth -= damage;

            if (gameObject.activeInHierarchy)
            {
                StartCoroutine(DamageFlashRoutine());
            }

            rb.AddForce(knockbackDir * knockbackForce, ForceMode2D.Impulse);

            if (currentHealth <= 0f)
            {
                Die();
            }
        }

        public void ApplySlow(float slowPercent, float duration)
        {
            if (gameObject.activeInHierarchy)
            {
                StartCoroutine(SlowRoutine(slowPercent, duration));
            }
        }

        private IEnumerator SlowRoutine(float slowPercent, float duration)
        {
            currentSpeed = moveSpeed * (1f - slowPercent);
            yield return new WaitForSeconds(duration);
            currentSpeed = moveSpeed;
        }

        private IEnumerator DamageFlashRoutine()
        {
            if (spriteRenderer != null)
            {
                spriteRenderer.color = Color.white;
                yield return new WaitForSeconds(0.08f);
                spriteRenderer.color = defaultColor;
            }
        }

        private void Die()
        {
            if (goldGemPrefab != null)
            {
                GameObject gem = Instantiate(goldGemPrefab, transform.position, Quaternion.identity);
                GoldGemPickup pickup = gem.GetComponent<GoldGemPickup>();
                if (pickup != null)
                {
                    pickup.SetGoldValue(goldDropAmount);
                }
            }

            if (QuestManager.Instance != null)
            {
                QuestManager.Instance.OnMonsterKilled();
            }

            Destroy(gameObject);
        }
    }
}
`,
  },

  {
    filename: 'WaveSpawner.cs',
    category: 'Enemies & Spawning',
    description: 'Dungeon wave spawner that progressively spawns circles of enemies in rounds outside camera bounds and announces wave clears.',
    code: `using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace ARPG.Combat
{
    public class WaveSpawner : MonoBehaviour
    {
        [Header("Spawn Configuration")]
        [SerializeField] private GameObject[] enemyPrefabs;
        [SerializeField] private float spawnRadius = 10f;
        [SerializeField] private float timeBetweenWaves = 3f;

        [Header("Wave Progress")]
        public int currentWave = 0;
        private int enemiesRemainingToSpawn = 0;
        private readonly List<GameObject> activeEnemies = new List<GameObject>();
        private bool isSpawningWave = false;

        private void Start()
        {
            StartCoroutine(WaveRoutine());
        }

        private IEnumerator WaveRoutine()
        {
            yield return new WaitForSeconds(1.5f);

            while (true)
            {
                currentWave++;
                Debug.Log($"Starting Wave {currentWave}!");

                int enemyCount = 4 + (currentWave * 3);
                enemiesRemainingToSpawn = enemyCount;
                isSpawningWave = true;

                while (enemiesRemainingToSpawn > 0)
                {
                    SpawnSingleEnemy();
                    enemiesRemainingToSpawn--;
                    yield return new WaitForSeconds(0.6f);
                }

                isSpawningWave = false;

                while (activeEnemies.Count > 0)
                {
                    activeEnemies.RemoveAll(e => e == null);
                    yield return new WaitForSeconds(0.5f);
                }

                Debug.Log($"Wave {currentWave} Cleared!");
                yield return new WaitForSeconds(timeBetweenWaves);
            }
        }

        private void SpawnSingleEnemy()
        {
            if (enemyPrefabs == null || enemyPrefabs.Length == 0) return;

            Transform player = ARPG.Core.PlayerController.Instance != null ? ARPG.Core.PlayerController.Instance.transform : transform;
            Vector2 randomCircle = Random.insideUnitCircle.normalized * spawnRadius;
            Vector3 spawnPos = player.position + (Vector3)randomCircle;

            GameObject prefabToSpawn = enemyPrefabs[Random.Range(0, enemyPrefabs.Length)];
            GameObject enemy = Instantiate(prefabToSpawn, spawnPos, Quaternion.identity);
            activeEnemies.Add(enemy);
        }
    }
}
`,
  },

  {
    filename: 'GoldGemPickup.cs',
    category: 'Town & Economy',
    description: 'Yellow diamond gold gem that bobs smoothly, activates magnet suction toward the player within pickup radius, and awards gold coins.',
    code: `using UnityEngine;
using ARPG.Core;

namespace ARPG.Economy
{
    [RequireComponent(typeof(Collider2D))]
    public class GoldGemPickup : MonoBehaviour
    {
        [Header("Values")]
        [SerializeField] private int goldValue = 10;
        [SerializeField] private float magnetRadius = 3.5f;
        [SerializeField] private float flySpeed = 8f;

        private Transform playerTransform;
        private bool isMagnetized = false;

        public void SetGoldValue(int val)
        {
            goldValue = val;
        }

        private void Start()
        {
            if (PlayerController.Instance != null)
            {
                playerTransform = PlayerController.Instance.transform;
            }
        }

        private void Update()
        {
            if (playerTransform == null) return;

            float dist = Vector2.Distance(transform.position, playerTransform.position);
            if (dist < magnetRadius)
            {
                isMagnetized = true;
            }

            if (isMagnetized)
            {
                transform.position = Vector2.MoveTowards(
                    transform.position,
                    playerTransform.position,
                    flySpeed * Time.deltaTime
                );
            }
        }

        private void OnTriggerEnter2D(Collider2D collision)
        {
            if (collision.CompareTag("Player"))
            {
                PlayerController player = collision.GetComponent<PlayerController>();
                if (player != null)
                {
                    player.AddGold(goldValue);
                    Destroy(gameObject);
                }
            }
        }
    }
}
`,
  },

  {
    filename: 'QuestManager.cs',
    category: 'Town & Economy',
    description: 'Singleton quest tracker for "Kill 10 Monsters" repeatable bounty with reward distribution and UI event callbacks.',
    code: `using System;
using UnityEngine;
using ARPG.Core;

namespace ARPG.Economy
{
    public class QuestManager : MonoBehaviour
    {
        public static QuestManager Instance { get; private set; }

        [Header("Quest Settings")]
        public string questTitle = "Monster Exterminator";
        public string questDescription = "Defeat 10 dungeon creatures";
        public int targetKillCount = 10;
        public int rewardGold = 100;

        [Header("Progress")]
        public int currentKills = 0;
        public bool isQuestActive = true;
        public bool isQuestCompleted = false;

        public event Action<int, int> OnQuestProgressChanged;
        public event Action OnQuestCompleted;

        private void Awake()
        {
            if (Instance == null) Instance = this;
            else Destroy(gameObject);
        }

        public void OnMonsterKilled()
        {
            if (!isQuestActive || isQuestCompleted) return;

            currentKills++;
            OnQuestProgressChanged?.Invoke(currentKills, targetKillCount);

            if (currentKills >= targetKillCount)
            {
                isQuestCompleted = true;
                OnQuestCompleted?.Invoke();
                Debug.Log($"Quest '{questTitle}' is ready to turn in!");
            }
        }

        public bool TurnInQuest()
        {
            if (isQuestCompleted && PlayerController.Instance != null)
            {
                PlayerController.Instance.AddGold(rewardGold);
                currentKills = 0;
                isQuestCompleted = false;
                OnQuestProgressChanged?.Invoke(currentKills, targetKillCount);
                return true;
            }
            return false;
        }
    }
}
`,
  },

  {
    filename: 'QuestNPC.cs',
    category: 'Town & Economy',
    description: 'Town Quest Board / Guild Master NPC. Triggers interaction popup when player is near (supports Mobile Touch Interact button or Key F).',
    code: `using UnityEngine;
using ARPG.Economy;

namespace ARPG.Town
{
    public class QuestNPC : MonoBehaviour
    {
        [Header("Interaction Prompt")]
        [SerializeField] private GameObject interactPromptUI;
        private bool isPlayerInRange = false;

        private void OnTriggerEnter2D(Collider2D collision)
        {
            if (collision.CompareTag("Player"))
            {
                isPlayerInRange = true;
                if (interactPromptUI != null) interactPromptUI.SetActive(true);
            }
        }

        private void OnTriggerExit2D(Collider2D collision)
        {
            if (collision.CompareTag("Player"))
            {
                isPlayerInRange = false;
                if (interactPromptUI != null) interactPromptUI.SetActive(false);
            }
        }

        private void Update()
        {
            if (isPlayerInRange && Input.GetKeyDown(KeyCode.F))
            {
                Interact();
            }
        }

        public void Interact()
        {
            if (QuestManager.Instance == null) return;

            if (QuestManager.Instance.isQuestCompleted)
            {
                QuestManager.Instance.TurnInQuest();
                Debug.Log("Quest Turned In! Reward Gold Collected!");
            }
            else
            {
                Debug.Log($"Current Progress: {QuestManager.Instance.currentKills}/{QuestManager.Instance.targetKillCount} defeated.");
            }
        }
    }
}
`,
  },

  {
    filename: 'ShopNPC.cs',
    category: 'Town & Economy',
    description: 'Blacksmith / Alchemist Shopkeeper NPC. Spends player gold to upgrade Weapon Damage (+ATK) or purchase Health Potions.',
    code: `using UnityEngine;
using ARPG.Core;

namespace ARPG.Town
{
    public class ShopNPC : MonoBehaviour
    {
        [Header("Prices & Scaling")]
        public int weaponUpgradeCost = 50;
        public float attackDamageIncrease = 6f;
        public int potionCost = 25;

        [Header("UI & Interaction")]
        [SerializeField] private GameObject shopModalUI;
        private bool isPlayerInRange = false;

        private void OnTriggerEnter2D(Collider2D collision)
        {
            if (collision.CompareTag("Player"))
            {
                isPlayerInRange = true;
            }
        }

        private void OnTriggerExit2D(Collider2D collision)
        {
            if (collision.CompareTag("Player"))
            {
                isPlayerInRange = false;
                if (shopModalUI != null) shopModalUI.SetActive(false);
            }
        }

        private void Update()
        {
            if (isPlayerInRange && Input.GetKeyDown(KeyCode.F))
            {
                ToggleShopUI();
            }
        }

        public void ToggleShopUI()
        {
            if (shopModalUI != null)
            {
                shopModalUI.SetActive(!shopModalUI.activeSelf);
            }
        }

        public void BuyWeaponUpgrade()
        {
            if (PlayerController.Instance == null) return;

            if (PlayerController.Instance.SpendGold(weaponUpgradeCost))
            {
                PlayerController.Instance.bonusAttackDamage += attackDamageIncrease;
                weaponUpgradeCost = Mathf.RoundToInt(weaponUpgradeCost * 1.5f);
                Debug.Log($"Upgraded weapon damage! New bonus: +{PlayerController.Instance.bonusAttackDamage}");
            }
            else
            {
                Debug.Log("Not enough gold to forge weapon upgrade!");
            }
        }

        public void BuyHealthPotion()
        {
            if (PlayerController.Instance == null) return;

            if (PlayerController.Instance.SpendGold(potionCost))
            {
                PlayerController.Instance.healthPotions++;
                Debug.Log($"Purchased 1 Health Potion! Total: {PlayerController.Instance.healthPotions}");
            }
            else
            {
                Debug.Log("Not enough gold for Health Potion!");
            }
        }
    }
}
`,
  },

  {
    filename: 'UIManager.cs',
    category: 'UI & Feedback',
    description: 'Top-down ARPG HUD controller: Player HP bar fill, radial cooldown overlays for Skill 1 & 2, Gold counter, Active Quest tracker, and Potion count.',
    code: `using UnityEngine;
using UnityEngine.UI;
using TMPro;
using ARPG.Core;
using ARPG.Combat;
using ARPG.Economy;

namespace ARPG.UI
{
    public class UIManager : MonoBehaviour
    {
        [Header("Health Bar")]
        [SerializeField] private Slider healthSlider;
        [SerializeField] private TextMeshProUGUI healthText;

        [Header("Skill Cooldown Overlays")]
        [SerializeField] private Image skill1CooldownMask; // Image type = Filled
        [SerializeField] private TextMeshProUGUI skill1CooldownText;
        [SerializeField] private Image skill2CooldownMask; // Image type = Filled
        [SerializeField] private TextMeshProUGUI skill2CooldownText;

        [Header("Gold & Inventory")]
        [SerializeField] private TextMeshProUGUI goldText;
        [SerializeField] private TextMeshProUGUI potionCountText;

        [Header("Quest HUD")]
        [SerializeField] private TextMeshProUGUI questTitleText;
        [SerializeField] private TextMeshProUGUI questProgressText;

        private void Start()
        {
            if (PlayerController.Instance != null)
            {
                PlayerController.Instance.OnHealthChanged += UpdateHealthUI;
                PlayerController.Instance.OnGoldChanged += UpdateGoldUI;
                PlayerController.Instance.OnPotionsChanged += UpdatePotionsUI;
            }

            SkillSystem skillSystem = FindFirstObjectByType<SkillSystem>();
            if (skillSystem != null)
            {
                skillSystem.OnSkill1CooldownChanged += UpdateSkill1UI;
                skillSystem.OnSkill2CooldownChanged += UpdateSkill2UI;
            }

            if (QuestManager.Instance != null)
            {
                QuestManager.Instance.OnQuestProgressChanged += UpdateQuestUI;
                if (questTitleText != null) questTitleText.text = QuestManager.Instance.questTitle;
                UpdateQuestUI(QuestManager.Instance.currentKills, QuestManager.Instance.targetKillCount);
            }
        }

        private void UpdateHealthUI(float current, float max)
        {
            if (healthSlider != null) healthSlider.value = current / max;
            if (healthText != null) healthText.text = $"{Mathf.CeilToInt(current)} / {Mathf.CeilToInt(max)}";
        }

        private void UpdateGoldUI(int gold)
        {
            if (goldText != null) goldText.text = $"{gold}";
        }

        private void UpdatePotionsUI(int count)
        {
            if (potionCountText != null) potionCountText.text = $"{count}";
        }

        private void UpdateSkill1UI(float remaining, float max)
        {
            if (skill1CooldownMask != null)
            {
                skill1CooldownMask.fillAmount = max > 0 ? remaining / max : 0f;
            }
            if (skill1CooldownText != null)
            {
                skill1CooldownText.text = remaining > 0.05f ? remaining.ToString("F1") : "";
            }
        }

        private void UpdateSkill2UI(float remaining, float max)
        {
            if (skill2CooldownMask != null)
            {
                skill2CooldownMask.fillAmount = max > 0 ? remaining / max : 0f;
            }
            if (skill2CooldownText != null)
            {
                skill2CooldownText.text = remaining > 0.05f ? remaining.ToString("F1") : "";
            }
        }

        private void UpdateQuestUI(int current, int target)
        {
            if (questProgressText != null)
            {
                questProgressText.text = $"{current} / {target} Kills";
                questProgressText.color = current >= target ? Color.green : Color.white;
            }
        }
    }
}
`,
  },
];
