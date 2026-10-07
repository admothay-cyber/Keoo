export type ClassType = 'Fighter' | 'Tank' | 'Assassin' | 'Marksman' | 'Mage';

export type EyeStyle = 'dots' | 'horizontal_bar' | 'vertical_bar';

export type HairStyle = 'hair_black' | 'hair_silver' | 'hair_red' | 'hair_violet' | 'hair_green' | 'none' | 'hair1' | 'hair2' | 'hair3' | 'hair4' | 'hair5';

export type HairColor = 'black' | 'white' | 'crimson_dark' | 'wine_red' | 'orange' | 'lotus_pink' | 'blue' | 'platinum';

export type SkinColor = 'default' | 'porcelain' | 'peach' | 'honey' | 'tan' | 'bronze' | 'dark' | 'ash';

export type SkillNodeId =
  | 'Fighter_1'
  | 'Fighter_2'
  | 'Fighter_3'
  | 'Tank_1'
  | 'Tank_2'
  | 'Tank_3'
  | 'Mage_1'
  | 'Mage_2'
  | 'Mage_3'
  | 'Assassin_1'
  | 'Assassin_2'
  | 'Assassin_3'
  | 'Marksman_1'
  | 'Marksman_2'
  | 'Marksman_3';

export interface SkillSlotFusion {
  main: SkillNodeId | null; // Ô 1: Nhánh chính (kích hoạt trước)
  sub: SkillNodeId | null;  // Ô 2: Nhánh phụ (kích hoạt nối tiếp ngay sau)
}

export interface SkillSystemState {
  skillPoints: number;
  unlockedClasses: ClassType[]; // Các hệ phái đã lĩnh ngộ (cấp 1 học hệ đầu, cứ thêm 50 cấp học thêm 1 hệ, nội tại cộng dồn vĩnh viễn)
  classLevels?: Record<ClassType, number>; // Cấp độ Class (0 -> 10, hiển thị số La Mã I -> X)
  skillLevels: Record<SkillNodeId, number>; // Cấp độ từng chiêu từ 0 -> 10 (Cấp 1 -> Cấp 2 -> ... -> Cấp 10)
  passiveLevels: Record<ClassType, number>; // Cấp độ nâng chỉ số nội tại của từng hệ (0 -> 10)
  unlockedSubSlots?: Record<1 | 2 | 3, boolean>; // Mở khóa Ô 2 nhánh phụ: Phím 1 cần 10 điểm, Phím 2 cần 100 điểm, Phím 3 cần 1000 điểm
  equippedSlots: {
    1: SkillSlotFusion;
    2: SkillSlotFusion;
    3: SkillSlotFusion;
  };
}

export interface SkillDefinition {
  id: string;
  nodeId?: SkillNodeId;
  classId?: ClassType;
  slotIndex?: 1 | 2 | 3;
  name: string;
  key: string;
  description: string;
  cooldown: number; // in seconds
  manaCost: number;
  icon: string;
  color: string;
}

export interface ClassPreset {
  id: ClassType;
  name: string;
  title: string;
  tagline: string;
  description: string;
  color: string;
  secondaryColor: string;
  maxHp: number;
  maxMana: number;
  moveSpeed: number;
  baseDamage: number;
  critChance: number; // 0 to 1
  critMultiplier: number;
  attackSpeed: number; // attacks per second
  attackRange: number;
  armorPen?: number; // 0 to 1 (xuyên giáp)
  damageReduction?: number; // 0 to 1 (miễn thương)
  expBonus?: number; // 0 to 1 (thêm exp)
  manaRegenBonus?: number; // 0 to 1 (thêm hồi mana)
  passiveName?: string;
  passiveDescription?: string;
  weaponType: 'Greatsword' | 'Warhammer & Shield' | 'Dual Daggers' | 'Recurve Bow' | 'Archmage Staff';
  weaponColor: string;
  basicAttackDescription: string;
  skill1: SkillDefinition;
  skill2: SkillDefinition;
  skill3: SkillDefinition;
}

export interface PlayerAttributes {
  hpPoints: number;
  mpPoints: number;
  strPoints: number;
  dexPoints: number;
  intPoints: number;
  defPoints: number;
  crPoints: number; // CR (Tỉ lệ chí mạng) - Tối đa 100%
  cdPoints: number; // CD (Sát thương chí mạng) - Vô cực
  luckPoints: number; // Luck (Tỉ lệ rơi đồ) - Tối đa 100%
  atkSpeedPoints?: number; // Tốc độ đánh (ASPD)
  manaControlPoints?: number; // Mức độ kiểm soát mana (0 - 100 cấp)
}

export type EquipmentSlot =
  | 'helmet'
  | 'armor'
  | 'boots'
  | 'mainWeapon'
  | 'subWeapon'
  | 'necklace'
  | 'ring';

export interface EquipmentItem {
  id: string;
  name: string;
  slot: EquipmentSlot;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  icon: string;
  description: string;
  hpBonus?: number;
  mpBonus?: number;
  atkBonus?: number;
  defBonus?: number;
  speedBonus?: number;
  critBonus?: number; // CR bonus
  critDmgBonus?: number; // CD bonus
  luckBonus?: number; // Luck bonus
}

export type EquippedItems = Record<EquipmentSlot, EquipmentItem | null>;

export interface PlayerStats {
  classType: ClassType;
  level: number;
  reincarnations?: number; // Số lần chuyển sinh: 0 = gốc, 1 = chuyển sinh lần 1, 2 = chuyển sinh lần 2 (lần 3)
  currentExp?: number;
  maxExp?: number;
  statExp?: number; // Điểm kinh nghiệm tiềm năng dùng đổi chỉ số (chỉ thấy khi mở bảng trạng thái)
  attributes?: PlayerAttributes;
  equipped?: EquippedItems;
  defense?: number; // Giáp phòng thủ cơ bản
  shieldHp?: number; // Lớp giáp ảo màu trắng trên thanh máu
  currentHp: number;
  maxHp: number;
  currentMana: number;
  maxMana: number;
  manaControlLevel?: number;
  baseDamage: number;
  bonusDamage: number; // from shop upgrades
  moveSpeed: number;
  critChanceBonus?: number; // Tỉ lệ chí mạng tăng khi lên cấp
  critMultiplierBonus?: number; // Sát thương chí mạng tăng khi lên cấp
  speedGrowthBonus?: number; // Tốc chạy tăng khi lên cấp
  gold: number;
  redCurrency?: number; // Red currency (no text label)
  potions: number;
  potionHealAmount: number;
  potionCooldown: number;
  lastPotionTime: number;
  killCount: number;
}

export interface Enemy {
  id: string;
  type: 'chaser' | 'scout' | 'brute' | 'spitter' | 'dummy' | 'bot';
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  color: string;
  goldDrop: number;
  hurtFlashTime: number;
  shootCooldown?: number;
  lastShootTime?: number;
  isDummy?: boolean;
  isBot?: boolean;
  botClass?: ClassType;
  facingRight?: boolean;
  attackTimer?: number;
  respawnTimer?: number;
  totalDamageTaken?: number;
  dps?: number;
  recentDamageHistory?: Array<{ time: number; damage: number }>;
  lastDamageTakenTime?: number;
  wobbleTimer?: number;
  wobbleIntensity?: number;
  hasMarkingShuriken?: boolean;
  markTimer?: number;
  markAccumulatedDamage?: number;
  assassinPassiveMarks?: number;
}

export interface Projectile {
  id: string;
  source: 'player' | 'enemy';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  isCrit: boolean;
  color: string;
  trailColor: string;
  pierce: number;
  maxLifetime: number;
  age: number;
  isAoe?: boolean;
  aoeRadius?: number;
  freezeDuration?: number;
  gravity?: number;
  drag?: number;
  projectileType?: 'light_orb' | 'stone' | string;
}

export interface MeleeSlash {
  id: string;
  x: number;
  y: number;
  angle: number;
  arc: number; // arc in radians
  radius: number;
  damage: number;
  isCrit: boolean;
  color: string;
  duration: number;
  elapsed: number;
  hitEnemyIds: Set<string>;
  direction?: 'up' | 'down';
}

export interface GoldGem {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  bounceHeight: number;
  bounceSpeed: number;
  createdTime: number;
  currencyType?: 'gold' | 'red' | 'exp';
}

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  size: number;
  vy: number;
  opacity: number;
  duration: number;
  elapsed: number;
  italic?: boolean;
  seq?: number;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  gravity?: number;
  drag?: number;
  layer?: 'ground' | 'above';
}

export interface QuestState {
  active: boolean;
  targetCount: number;
  currentCount: number;
  completed: boolean;
  rewardGold: number;
  title: string;
  description: string;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  costMultiplier: number;
  currentLevel: number;
  maxLevel?: number;
  effectType: 'damage' | 'potion' | 'speed' | 'maxHp';
}

export interface CharacterCustomization {
  name: string;
  classType: ClassType;
  hairStyle: HairStyle;
  eyeStyle: EyeStyle;
  skinColor: SkinColor | string;
  eyeColor?: string;
  hairColor: HairColor | string;
}

export interface RemotePlayer {
  id: string;
  name: string;
  classType: ClassType;
  x: number;
  y: number;
  facingRight: boolean;
  angle: number;
  hp: number;
  maxHp: number;
  level: number;
  hairStyle: HairStyle;
  eyeStyle: EyeStyle;
  skinColor: SkinColor | string;
  eyeColor?: string;
  hairColor: HairColor | string;
  hasSword: boolean;
  isDashing: boolean;
  isAttacking: boolean;
}

