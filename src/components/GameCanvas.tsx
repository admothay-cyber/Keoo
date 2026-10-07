import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  ClassPreset,
  ClassType,
  Enemy,
  FloatingText,
  GoldGem,
  MeleeSlash,
  Particle,
  PlayerStats,
  Projectile,
  PlayerAttributes,
  EquipmentSlot,
  EquipmentItem,
  EquippedItems,
  HairStyle,
  HairColor,
  SkinColor,
  EyeStyle,
  SkillNodeId,
  SkillSystemState,
  CharacterCustomization,
  RemotePlayer,
} from '../types/game';
import { ALL_CLASS_TYPES, CLASS_PRESETS, getSkillDefinitionByNodeId } from '../data/classPresets';
import { DEFAULT_EQUIPMENT } from '../data/equipmentData';
import { getTintedHairImage, getTintedSkinImage } from '../utils/hairColorizer';
import {
  clampPlayerPosition,
  DEFAULT_FOREST_BOUNDS,
  drawMistLayer,
} from '../utils/forestManager';
import { sounds } from '../audio/soundEffects';
import { Swords, Shield, Sparkles, Scissors, BookOpen, Backpack, Target, CloudRain, Moon, Sun, Layers, Award, Settings } from 'lucide-react';
import { StatusHud } from './StatusHud';
import { StatsModal } from './StatsModal';
import { EquipmentModal } from './EquipmentModal';
import { ClassSelectModal } from './ClassSelectModal';
import { CharacterCreationModal } from './CharacterCreationModal';
import { LearnSkillsModal } from './LearnSkillsModal';
import { SettingsModal } from './SettingsModal';
import { MiniMap } from './MiniMap';

interface GameCanvasProps {
  activeClass: ClassType;
  onClassChange: (c: ClassType) => void;
  initialCustomization?: CharacterCustomization;
  onCustomizationChange?: (nextCustom: CharacterCustomization) => void;
  roomInfo?: {
    mode: 'solo' | 'multiplayer';
    roomCode: string;
    maxPlayers: number;
    playerId: string;
  };
  remotePlayers?: RemotePlayer[];
  onSendPlayerState?: (state: Partial<RemotePlayer>) => void;
  onLeaveRoom?: () => void;
}

interface SpawnBlock {
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  gatherDelay: number;
  size: number;
  color: string;
  flickerSpeed: number;
  flickerOffset: number;
}

// 1 & 2. Mảng hằng số 30 điểm tọa độ đích (Target offsets) cố định của hình dáng nhân vật Chibi (Đầu & Tóc, Thân, 2 Tay, 2 Chân)
const MAX_SPAWN_PARTICLES = 30;
const CHARACTER_SILHOUETTE_POINTS: ReadonlyArray<{ x: number; y: number; size: number }> = [
  // 1. Vòm tóc & Đỉnh đầu (4 hạt to rõ phủ kín mái tóc)
  { x: -12, y: -42, size: 18.5 },
  { x: -4,  y: -44, size: 19.5 },
  { x: 4,   y: -44, size: 19.5 },
  { x: 11,  y: -41, size: 18.0 },
  // 2. Khuôn mặt & Đầu giữa (10 hạt to rõ phủ kín khối đầu Chibi)
  { x: -15, y: -33, size: 19.0 },
  { x: -7,  y: -33, size: 21.0 },
  { x: 2,   y: -33, size: 21.0 },
  { x: 10,  y: -33, size: 19.5 },
  { x: 16,  y: -31, size: 17.5 },
  { x: -14, y: -23, size: 18.5 },
  { x: -6,  y: -23, size: 21.0 },
  { x: 3,   y: -23, size: 21.0 },
  { x: 11,  y: -23, size: 18.5 },
  { x: -2,  y: -16, size: 18.5 },
  // 3. Thân áo (6 hạt to rõ phủ kín ngực & bụng)
  { x: -8,  y: -10, size: 19.0 },
  { x: 0,   y: -10, size: 19.8 },
  { x: 8,   y: -10, size: 19.0 },
  { x: -8,  y: -2,  size: 18.6 },
  { x: 0,   y: -2,  size: 19.4 },
  { x: 8,   y: -2,  size: 18.6 },
  // 4. Hai cánh tay hai bên (6 hạt to rõ phủ kín vai & bàn tay)
  { x: -17, y: -11, size: 16.5 },
  { x: -19, y: -4,  size: 16.0 },
  { x: -17, y: 2,   size: 15.5 },
  { x: 16,  y: -10, size: 16.5 },
  { x: 18,  y: -3,  size: 16.0 },
  { x: 16,  y: 3,   size: 15.5 },
  // 5. Hai chân dưới (4 hạt to rõ phủ kín đùi & bàn chân)
  { x: -6,  y: 6,   size: 16.5 },
  { x: -6,  y: 14,  size: 15.8 },
  { x: 6,   y: 6,   size: 16.5 },
  { x: 6,   y: 13,  size: 15.8 },
];

const SPAWN_PARTICLE_COLORS = ['#ffffff', '#00ffff', '#38bdf8', '#e0f2fe'] as const;

// Khởi tạo sẵn bộ đệm hạt (Pre-allocated Spawn Particle Pool) từ lúc nạp module, tránh Math.hypot hay cấp phát Object mới khi vào trận
const PREALLOCATED_SPAWN_BLOCKS: SpawnBlock[] = CHARACTER_SILHOUETTE_POINTS.map((pt, i) => {
  const angle = (i / MAX_SPAWN_PARTICLES) * Math.PI * 2 + ((i % 3) - 1) * 0.06;
  const outsideDist = 1180 + (i % 5) * 35;
  return {
    startX: Math.cos(angle) * outsideDist,
    startY: Math.sin(angle) * outsideDist,
    offsetX: pt.x,
    offsetY: pt.y,
    gatherDelay: (i % 6) * 0.014,
    size: pt.size,
    color: SPAWN_PARTICLE_COLORS[i % SPAWN_PARTICLE_COLORS.length],
    flickerSpeed: 18 + (i % 7) * 2.5,
    flickerOffset: (i * 0.62) % (Math.PI * 2),
  };
});

const LevelUpCardOverlay: React.FC<{
  notification: {
    id: number;
    oldLevel: number;
    newLevel: number;
    statPointsGained: number;
    skillPointsGained: number;
  } | null;
}> = ({ notification }) => {
  const [currentNotif, setCurrentNotif] = useState(notification);
  const [cardIn, setCardIn] = useState(false);
  const [isRolling, setIsRolling] = useState(false);

  useEffect(() => {
    if (notification) {
      setCurrentNotif(notification);
      setCardIn(false);
      setIsRolling(false);

      // 1. Thẻ trượt mượt mà từ dưới màn hình lên sau 50ms
      const slideInTimer = setTimeout(() => {
        setCardIn(true);
      }, 50);

      // 2. Giữ số cũ (ví dụ số 1) trong khung 0.55 giây (550ms), sau đó mới cuộn lên số mới (ví dụ số 2)
      const rollTimer = setTimeout(() => {
        setIsRolling(true);
      }, 550);

      // 3. Thẻ trượt xuống biến mất sau 3.5 giây
      const slideOutTimer = setTimeout(() => {
        setCardIn(false);
      }, 3500);

      // 4. Dọn dẹp state thông báo sau 3.9 giây
      const cleanupTimer = setTimeout(() => {
        setCurrentNotif(null);
        setIsRolling(false);
      }, 3900);

      return () => {
        clearTimeout(slideInTimer);
        clearTimeout(rollTimer);
        clearTimeout(slideOutTimer);
        clearTimeout(cleanupTimer);
      };
    }
  }, [notification]);

  if (!currentNotif) return null;

  // Dãy số từ cấp cũ đến cấp mới
  const oldLvl = currentNotif.oldLevel;
  const newLvl = currentNotif.newLevel;
  const levelList: number[] = [];
  if (newLvl > oldLvl) {
    const diff = newLvl - oldLvl;
    if (diff <= 10) {
      for (let l = oldLvl; l <= newLvl; l++) {
        levelList.push(l);
      }
    } else {
      levelList.push(oldLvl, newLvl);
    }
  } else {
    levelList.push(oldLvl);
  }

  const stepCount = Math.max(0, levelList.length - 1);
  const ITEM_HEIGHT = 40; // Chuẩn 40px height per number slot
  const totalOffsetPx = -stepCount * ITEM_HEIGHT;

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] pointer-events-none select-none transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        cardIn ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0'
      }`}
    >
      <div className="relative px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-950/95 via-slate-900/98 to-amber-950/95 border-2 border-amber-400 shadow-[0_0_35px_rgba(245,158,11,0.65)] flex items-center gap-4 text-white backdrop-blur-md">
        {/* Glow corner dots */}
        <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-amber-300 rounded-full blur-[2px]" />
        <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-amber-300 rounded-full blur-[2px]" />

        {/* Date-picker / Roller Slot Wheel Window */}
        <div className="flex flex-col items-center">
          <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-0.5">CẤP</span>
          <div className="relative w-16 h-[40px] overflow-hidden bg-slate-950/95 border-2 border-amber-400/90 rounded-xl shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]">
            {/* Roller Wheel Container - absolute positioning to align each 40px item precisely in the 40px frame */}
            <div
              className="absolute top-0 left-0 w-full flex flex-col items-center transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{
                transform: `translateY(${isRolling ? totalOffsetPx : 0}px)`,
              }}
            >
              {levelList.map((lvlNum, idx) => (
                <div
                  key={idx}
                  className="h-[40px] w-full flex items-center justify-center text-center text-amber-300 font-black text-2xl font-mono leading-none shrink-0 drop-shadow-[0_2px_4px_rgba(245,158,11,0.5)]"
                >
                  {lvlNum}
                </div>
              ))}
            </div>
            {/* Top and Bottom 3D Cylinder shading overlays */}
            <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-b from-slate-950 via-slate-950/70 to-transparent pointer-events-none z-10" />
            <div className="absolute inset-x-0 bottom-0 h-2 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent pointer-events-none z-10" />
          </div>
        </div>

        {/* Level Up Info Card Text */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-amber-300 font-black text-base tracking-wider uppercase drop-shadow-[0_2px_6px_rgba(245,158,11,0.6)]">
              ★ LEVEL UP! ★
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-sm">
              +{currentNotif.statPointsGained} Stats
            </span>
            <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-sm">
              +{currentNotif.skillPointsGained} Kỹ Năng
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const GameCanvas: React.FC<GameCanvasProps> = ({
  activeClass,
  onClassChange,
  initialCustomization,
  onCustomizationChange,
  roomInfo,
  remotePlayers,
  onSendPlayerState,
  onLeaveRoom,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [currentZone, setCurrentZone] = useState<'town' | 'dungeon'>('town');

  // Virtual Joystick State (Split-Screen Control)
  const joystickBaseRef = useRef<HTMLDivElement | null>(null);
  const joystickVectorRef = useRef({ x: 0, y: 0 });
  const [joystickKnob, setJoystickKnob] = useState({ x: 0, y: 0 });
  const [isJoystickActive, setIsJoystickActive] = useState(false);
  const touchIdRef = useRef<number | null>(null);
  const joystickCenterRef = useRef<{ x: number; y: number } | null>(null);
  const [joystickOrigin, setJoystickOrigin] = useState<{ x: number; y: number } | null>(null);

  // Player State
  const playerRef = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 18,
    angle: 0,
    aimX: 0,
    aimY: 0,
    isDashing: false,
    dashTimer: 0,
    dashVx: 0,
    dashVy: 0,
    dashShadowTimer: 0,
    shieldActive: false,
    shieldTimer: 0,
    battleCryActive: false,
    battleCryTimer: 0,
    fighterBuffActive: false,
    fighterBuffTimer: 0,
    fighterEnhanceActive: false,
    fighterEnhanceTimer: 0,
    fighterGuaranteedChargeTimer: 0,
    tankShieldHp: 0,
    tankShieldTimer: 0,
    mageBuffActive: false,
    mageBuffTimer: 0,
    mageManaTickTimer: 0,
    assassinBuffActive: false,
    assassinBuffTimer: 0,
    marksmanBuffActive: false,
    marksmanBuffTimer: 0,
    marksmanStoneStacks: 0,
    facingRight: true,
  });

  interface Afterimage {
    id: string;
    x: number;
    y: number;
    angle: number;
    facingRight: boolean;
    activeClass: ClassType;
    alpha: number;
    maxAlpha: number;
    duration: number;
    color: string;
  }
  const afterimagesRef = useRef<Afterimage[]>([]);
  const exploredTilesRef = useRef<Set<string>>(new Set());
  const lastNetworkSyncTimeRef = useRef<number>(0);

  // Player Stats Attributes & Equipment State
  const [attributes, setAttributes] = useState<PlayerAttributes>({
    hpPoints: 0,
    mpPoints: 0,
    strPoints: 0,
    dexPoints: 0,
    intPoints: 0,
    defPoints: 0,
    crPoints: 0,
    cdPoints: 0,
    luckPoints: 0,
    manaControlPoints: 0,
  });
  const [equipped, setEquipped] = useState<EquippedItems>(DEFAULT_EQUIPMENT);

  // Modals state
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isEquipOpen, setIsEquipOpen] = useState(false);
  const [isClassSelectOpen, setIsClassSelectOpen] = useState(false);
  const [isCharacterCustomOpen, setIsCharacterCustomOpen] = useState(false);
  const [isBootloading, setIsBootloading] = useState(false);
  const [isLearnSkillsOpen, setIsLearnSkillsOpen] = useState(false);
  const [skillModalTab, setSkillModalTab] = useState<'skills' | 'fusion' | 'unlock'>('skills');
  const [isSkillFusionOpen, setIsSkillFusionOpen] = useState(false);
  const [isUnlockClassOpen, setIsUnlockClassOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSkillTreeOpen, setIsSkillTreeOpen] = useState(false);
  const [isInitialWhiteFade, setIsInitialWhiteFade] = useState(true);
  const [levelUpNotification, setLevelUpNotification] = useState<{
    id: number;
    oldLevel: number;
    newLevel: number;
    statPointsGained: number;
    skillPointsGained: number;
  } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialWhiteFade(false);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Hệ thống Kỹ Năng & Lĩnh Ngộ Hệ Phái:
  // - Khởi đầu chưa có kỹ năng nào (tất cả cấp 0, các ô gắn chiêu đều trống)
  // - Có sẵn 1 Điểm Kỹ Năng khởi điểm để người chơi tự chọn học kỹ năng đầu tiên
  // - Lĩnh ngộ hệ tiếp theo mỗi 50 cấp (không mất kinh nghiệm), nội tại các hệ đã học tự động cộng thẳng vĩnh viễn
  const createInitialSkillSystem = useCallback(
    (startingClass: ClassType): SkillSystemState => ({
      skillPoints: 5,
      unlockedClasses: [startingClass],
      classLevels: {
        Fighter: startingClass === 'Fighter' ? 1 : 0,
        Tank: startingClass === 'Tank' ? 1 : 0,
        Mage: startingClass === 'Mage' ? 1 : 0,
        Assassin: startingClass === 'Assassin' ? 1 : 0,
        Marksman: startingClass === 'Marksman' ? 1 : 0,
      },
      skillLevels: {
        Fighter_1: 0,
        Fighter_2: 0,
        Fighter_3: 0,
        Tank_1: 0,
        Tank_2: 0,
        Tank_3: 0,
        Mage_1: 0,
        Mage_2: 0,
        Mage_3: 0,
        Assassin_1: 0,
        Assassin_2: 0,
        Assassin_3: 0,
        Marksman_1: 0,
        Marksman_2: 0,
        Marksman_3: 0,
      },
      passiveLevels: {
        Fighter: 0,
        Tank: 0,
        Mage: 0,
        Assassin: 0,
        Marksman: 0,
      },
      unlockedSubSlots: {
        1: false,
        2: false,
        3: false,
      },
      equippedSlots: {
        1: { main: null, sub: null },
        2: { main: null, sub: null },
        3: { main: null, sub: null },
      },
    }),
    []
  );

  const [skillSystem, setSkillSystem] = useState<SkillSystemState>(() => createInitialSkillSystem(activeClass));
  const skillSystemRef = useRef<SkillSystemState>(skillSystem);
  skillSystemRef.current = skillSystem;
  const [playerName, setPlayerName] = useState(initialCustomization?.name || 'Dũng Sĩ');
  const [eyeStyle, setEyeStyle] = useState<EyeStyle>(initialCustomization?.eyeStyle || 'dots');
  const [hairStyle, setHairStyle] = useState<HairStyle>(initialCustomization?.hairStyle || 'hair_black');
  const hairStyleRef = useRef<HairStyle>('hair_black');
  hairStyleRef.current = hairStyle;
  const [hairColor, setHairColor] = useState<HairColor>(
    initialCustomization?.hairColor && initialCustomization.hairColor !== 'original'
      ? (initialCustomization.hairColor as HairColor)
      : 'black'
  );
  const hairColorRef = useRef<HairColor>('black');
  hairColorRef.current = hairColor;
  const [skinColor, setSkinColor] = useState<SkinColor>(
    initialCustomization?.skinColor && initialCustomization.skinColor !== 'original'
      ? (initialCustomization.skinColor as SkinColor)
      : 'default'
  );
  const skinColorRef = useRef<SkinColor>('default');
  skinColorRef.current = skinColor;

  const [stats, setStats] = useState<PlayerStats>({
    classType: activeClass,
    level: 1,
    reincarnations: 0,
    currentExp: 0,
    maxExp: 100,
    statExp: 0, // Điểm thuộc tính Stats (mỗi lần lên cấp mới nhận +20 điểm)
    attributes: {
      hpPoints: 0,
      mpPoints: 0,
      strPoints: 0,
      dexPoints: 0,
      intPoints: 0,
      defPoints: 0,
      crPoints: 0,
      cdPoints: 0,
      luckPoints: 0,
      manaControlPoints: 0,
    },
    equipped: DEFAULT_EQUIPMENT,
    defense: activeClass === 'Tank' ? 12 : 10,
    currentHp: CLASS_PRESETS[activeClass].maxHp,
    maxHp: CLASS_PRESETS[activeClass].maxHp,
    currentMana: CLASS_PRESETS[activeClass].maxMana || 50,
    maxMana: CLASS_PRESETS[activeClass].maxMana || 50,
    manaControlLevel: 0,
    critChanceBonus: 0,
    critMultiplierBonus: 0,
    speedGrowthBonus: 0,
    baseDamage: CLASS_PRESETS[activeClass].baseDamage,
    bonusDamage: 0,
    moveSpeed: CLASS_PRESETS[activeClass].moveSpeed,
    gold: 60,
    redCurrency: 15,
    potions: 3,
    potionHealAmount: 60,
    potionCooldown: 3.0,
    lastPotionTime: 0,
    killCount: 0,
  });

  // Refs đồng bộ state để vòng lặp requestAnimationFrame không bao giờ bị khởi tạo lại khi state thay đổi (tránh hiện tượng khựng / slowmotion)
  const statsRef = useRef<PlayerStats>(stats);
  statsRef.current = stats;
  const attributesRef = useRef<PlayerAttributes>(attributes);
  attributesRef.current = attributes;
  const equippedRef = useRef<EquippedItems>(equipped);
  equippedRef.current = equipped;
  const currentZoneRef = useRef<'town' | 'dungeon'>(currentZone);
  currentZoneRef.current = currentZone;

  // Handle Stat Points Upgrade: mỗi lần lên cấp mới nhận 20 điểm (1 điểm = 1 lần nâng cấp thuộc tính)
  // Hỗ trợ cộng +1 điểm (bấm / bấm giữ liên tục) hoặc 'all' (cộng toàn bộ điểm khả dụng vào thuộc tính đó)
  const handleUpgradeAttribute = useCallback((attrKey: keyof PlayerAttributes, mode: 'one' | 'all' = 'one') => {
    setStats((prev) => {
      const currentStatExp = prev.statExp ?? 0;
      const maxAffordable = Math.floor(currentStatExp);
      if (maxAffordable <= 0) return prev;

      const curAttrs: PlayerAttributes = prev.attributes || {
        hpPoints: 0,
        mpPoints: 0,
        strPoints: 0,
        dexPoints: 0,
        intPoints: 0,
        defPoints: 0,
        crPoints: 0,
        cdPoints: 0,
        luckPoints: 0,
        atkSpeedPoints: 0,
        manaControlPoints: 0,
      };

      // Tính số điểm tối đa còn có thể cộng vào thuộc tính này dựa theo giới hạn (Cap)
      let capRemaining = maxAffordable;

      if (attrKey === 'crPoints') {
        const eqCrit =
          (prev.equipped?.mainWeapon?.critBonus || 0) +
          (prev.equipped?.ring?.critBonus || 0) +
          (prev.equipped?.necklace?.critBonus || 0) +
          (prev.equipped?.subWeapon?.critBonus || 0);
        const preset = CLASS_PRESETS[prev.classType];
        const currentCrit =
          preset.critChance +
          (prev.critChanceBonus || 0) +
          (curAttrs.dexPoints || 0) * 0.01 +
          (curAttrs.crPoints || 0) * 0.01 +
          eqCrit;
        const neededFor100 = Math.max(0, Math.round((1.0 - currentCrit) * 100));
        capRemaining = Math.min(capRemaining, neededFor100);
      } else if (attrKey === 'luckPoints') {
        const eqLuck = (prev.equipped?.necklace?.luckBonus || 0) + (prev.equipped?.ring?.luckBonus || 0);
        const currentLuck = 0.05 + (curAttrs.luckPoints || 0) * 0.01 + eqLuck;
        const neededFor100 = Math.max(0, Math.round((1.0 - currentLuck) * 100));
        capRemaining = Math.min(capRemaining, neededFor100);
      } else if (attrKey === 'manaControlPoints') {
        const neededFor100 = Math.max(0, 100 - (curAttrs.manaControlPoints || 0));
        capRemaining = Math.min(capRemaining, neededFor100);
      }

      if (capRemaining <= 0) return prev;

      const pointsToAdd = mode === 'all' ? capRemaining : 1;
      const nextStatExp = currentStatExp - pointsToAdd;

      const hpBoost = attrKey === 'hpPoints' ? 15 * pointsToAdd : 0;
      const mpBoost = attrKey === 'mpPoints' ? 10 * pointsToAdd : 0;
      const dmgBoost = attrKey === 'strPoints' ? 3 * pointsToAdd : 0;
      const spdBoost = attrKey === 'dexPoints' ? 4 * pointsToAdd : 0;
      const defBoost = attrKey === 'defPoints' ? 2 * pointsToAdd : 0;
      const nextMcLevel =
        attrKey === 'manaControlPoints'
          ? (curAttrs.manaControlPoints || 0) + pointsToAdd
          : prev.manaControlLevel || 0;

      const nextAttrs: PlayerAttributes = {
        ...curAttrs,
        [attrKey]: ((curAttrs as any)?.[attrKey] || 0) + pointsToAdd,
      };

      setAttributes(nextAttrs);

      return {
        ...prev,
        statExp: nextStatExp,
        attributes: nextAttrs,
        manaControlLevel: nextMcLevel,
        maxHp: prev.maxHp + hpBoost,
        currentHp: prev.currentHp + hpBoost,
        maxMana: prev.maxMana + mpBoost,
        currentMana: prev.currentMana + mpBoost,
        baseDamage: prev.baseDamage + dmgBoost,
        moveSpeed: prev.moveSpeed + spdBoost,
        defense: (prev.defense || 0) + defBoost,
      };
    });
  }, []);

  // Handle Reincarnation
  const handleReincarnate = useCallback(() => {
    setStats((prev) => {
      if (prev.level < 999) return prev; // Chỉ được chuyển sinh khi đạt cấp 999

      const nextReincarnations = (prev.reincarnations || 0) + 1;

      // Kích hoạt âm thanh và hiệu ứng
      sounds.playLevelUp?.();

      // Spawn chữ nổi thông báo chuyển sinh thành công
      spawnFloatingText(
        playerRef.current.x,
        playerRef.current.y - 45,
        `★ CHUYỂN SINH THÀNH CÔNG! LẦN ${nextReincarnations} ★`,
        '#22d3ee',
        20
      );

      // Reset level về 1, tăng số lần chuyển sinh, giữ nguyên toàn bộ các thuộc tính và chỉ số (HP, MP, Công, Giáp, v.v.)
      return {
        ...prev,
        level: 1,
        reincarnations: nextReincarnations,
        currentExp: 0,
        maxExp: 100, // Quay lại mốc EXP ban đầu của level 1
        currentHp: prev.maxHp, // Hồi đầy máu
        currentMana: prev.maxMana, // Hồi đầy mana
      };
    });
  }, []);

  // Handle Equipment change
  const handleEquipItem = useCallback((slot: EquipmentSlot, item: EquipmentItem | null) => {
    setEquipped((prev) => {
      const oldItem = prev[slot];
      const next = { ...prev, [slot]: item };

      const hpDiff = (item?.hpBonus || 0) - (oldItem?.hpBonus || 0);
      const mpDiff = (item?.mpBonus || 0) - (oldItem?.mpBonus || 0);
      const atkDiff = (item?.atkBonus || 0) - (oldItem?.atkBonus || 0);
      const defDiff = (item?.defBonus || 0) - (oldItem?.defBonus || 0);
      const spdDiff = (item?.speedBonus || 0) - (oldItem?.speedBonus || 0);

      setStats((s) => ({
        ...s,
        maxHp: Math.max(50, s.maxHp + hpDiff),
        currentHp: Math.max(1, Math.min(s.maxHp + hpDiff, s.currentHp + hpDiff)),
        maxMana: Math.max(50, s.maxMana + mpDiff),
        currentMana: Math.max(1, Math.min(s.maxMana + mpDiff, s.currentMana + mpDiff)),
        baseDamage: Math.max(5, s.baseDamage + atkDiff),
        moveSpeed: Math.max(100, s.moveSpeed + spdDiff),
        defense: Math.max(0, (s.defense || 0) + defDiff),
        equipped: next,
      }));

      return next;
    });
  }, []);

  // Cooldowns
  const [skill1CdRemaining, setSkill1CdRemaining] = useState(0);
  const [skill2CdRemaining, setSkill2CdRemaining] = useState(0);
  const [skill3CdRemaining, setSkill3CdRemaining] = useState(0);
  const lastAttackTimeRef = useRef(0);
  const skill1CdRef = useRef(0);
  const skill2CdRef = useRef(0);
  const skill3CdRef = useRef(0);

  // Helper khởi tạo danh sách Bot Chiến Đấu
  const createInitialCombatBots = useCallback((): Enemy[] => [], []);

  // Game World Entities
  const enemiesRef = useRef<Enemy[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const slashesRef = useRef<MeleeSlash[]>([]);
  const goldGemsRef = useRef<GoldGem[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const cameraRef = useRef({ x: 0, y: 0 });
  const shakeRef = useRef(0);
  const waveRef = useRef(1);
  const [currentWaveDisplay, setCurrentWaveDisplay] = useState(1);
  const dungeonSpawnTimerRef = useRef(0);
  const manaRegenTimerRef = useRef(0);
  const passiveManaTimerRef = useRef(0);
  const cdUiSyncTimerRef = useRef(0);

  // 1. Chunk-Based On-Demand Rendering cho Bản đồ Thế Giới Rộng Lớn (Render trong khu vực người chơi, các khu vực khác tải theo yêu cầu)
  const CHUNK_SIZE = 520;
  const NUM_CHUNKS_PER_AXIS = 7; // 7x7 = 49 Chunks (Thế giới mở rộng lớn 3640px x 3640px)
  const MAP_BOUND = (NUM_CHUNKS_PER_AXIS * CHUNK_SIZE) / 2; // 1820px
  const mapChunksRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const lastChunkCleanupTimeRef = useRef<number>(0);
  const gameStartTimeRef = useRef<number>(performance.now());
  const cachedMapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isMapCachedRef = useRef(false);

  // 2. Particle Object Pooling (Tối đa 30 hạt, tái sử dụng không tạo rác GC)
  const MAX_PARTICLES = 30;
  const particlePoolRef = useRef<Particle[]>(
    Array.from({ length: 30 }, (_, i) => ({
      id: `pt_${i}`,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      color: '#ffffff',
      size: 2,
      alpha: 0,
      life: 1,
      maxLife: 1,
      layer: 'above',
    }))
  );

  // 2.2. Floating Damage Text Object Pooling (Tối đa 32 chữ nhảy sát thương trong cùng thời điểm)
  const MAX_FLOATING_TEXTS = 32;
  const floatingTextsPoolRef = useRef<FloatingText[]>(
    Array.from({ length: 32 }, (_, i) => ({
      id: `ft_${i}`,
      text: '',
      x: 0,
      y: 0,
      color: '#ffffff',
      size: 14,
      vy: -1.2,
      opacity: 0,
      duration: 0.9,
      elapsed: 0,
      italic: false,
      seq: 0,
    } as any))
  );

  // 3. Helper điều phối chặn trùng lặp TouchEvent và MouseEvent trên di động
  const lastTouchTimeRef = useRef<number>(0);

  // Helper lấy hạt từ Object Pool
  const emitPooledParticle = useCallback(
    (pt: Partial<Particle> & { x: number; y: number; vx: number; vy: number; color: string; size: number; maxLife: number }) => {
      const pool = particlePoolRef.current;
      let target: Particle | null = null;
      for (let i = 0; i < MAX_PARTICLES; i++) {
        if (pool[i].alpha <= 0 || pool[i].life >= pool[i].maxLife) {
          target = pool[i];
          break;
        }
      }
      if (!target) {
        let maxRatio = -1;
        let bestIdx = 0;
        for (let i = 0; i < MAX_PARTICLES; i++) {
          const ratio = pool[i].life / (pool[i].maxLife || 1);
          if (ratio > maxRatio) {
            maxRatio = ratio;
            bestIdx = i;
          }
        }
        target = pool[bestIdx];
      }

      target.x = pt.x;
      target.y = pt.y;
      target.vx = pt.vx;
      target.vy = pt.vy;
      target.color = pt.color;
      target.size = pt.size;
      target.alpha = pt.alpha ?? 1;
      target.life = pt.life ?? 0;
      target.maxLife = Math.max(0.08, pt.maxLife);
      target.gravity = pt.gravity;
      target.drag = pt.drag;
      target.layer = pt.layer || 'above';
      return target;
    },
    []
  );

  // Helper lấy chữ nhảy sát thương từ Object Pool
  const emitPooledFloatingText = useCallback((ft: any) => {
    const pool = floatingTextsPoolRef.current;
    let target: FloatingText | null = null;
    for (let i = 0; i < MAX_FLOATING_TEXTS; i++) {
      if (pool[i].opacity <= 0) {
        target = pool[i];
        break;
      }
    }
    if (!target) {
      let maxElapsed = -1;
      let oldestIdx = 0;
      for (let i = 0; i < MAX_FLOATING_TEXTS; i++) {
        if (pool[i].elapsed > maxElapsed) {
          maxElapsed = pool[i].elapsed;
          oldestIdx = i;
        }
      }
      target = pool[oldestIdx];
    }
    target.text = ft.text;
    target.x = ft.x;
    target.y = ft.y;
    target.color = ft.color;
    target.size = ft.size;
    target.vy = ft.vy ?? -1.2;
    target.opacity = ft.opacity ?? 1;
    target.duration = ft.duration ?? 0.9;
    target.elapsed = 0;
    target.italic = ft.italic ?? false;
    target.seq = ft.seq ?? 0;
    return target;
  }, []);

  // Tự động ủy nhiệm particlesRef và floatingTextsRef vào Object Pool để tương thích 100% mọi lệnh push cũ mà không gây rác Garbage Collection
  useEffect(() => {
    (particlesRef.current as any).push = (pt: any) => {
      emitPooledParticle(pt);
      return MAX_PARTICLES;
    };
    (floatingTextsRef.current as any).push = (ft: any) => {
      emitPooledFloatingText(ft);
      return MAX_FLOATING_TEXTS;
    };
  }, [emitPooledParticle, emitPooledFloatingText]);

  // Input Tracker
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const mouseWorldRef = useRef({ x: 0, y: 0 });
  const isMouseDownRef = useRef(false);

  // Attack, Charge (Gồng lực) & Swing Animation State
  const isAttackHeldRef = useRef(false);
  const attackHoldStartTimeRef = useRef(0);
  const isChargingRef = useRef(false);
  const chargeProgressRef = useRef(0); // 0.0 to 1.0
  const chargeMaxNotifiedRef = useRef(false);
  const comboStepRef = useRef(0);
  const chargeStanceRef = useRef<'down' | 'up'>('down');

  // Trạng thái vũ khí: Có kiếm (true) hoặc Tay không / Đấm quyền (false)
  const [hasSword, setHasSword] = useState<boolean>(false);
  const hasSwordRef = useRef<boolean>(false);
  useEffect(() => {
    hasSwordRef.current = hasSword;
  }, [hasSword]);

  // Gồng 1 tay luân phiên ('right' | 'left')
  const chargeHandRef = useRef<'right' | 'left'>('left');
  // Lưu quái vật mục tiêu hiện tại (ưu tiên máu thấp nhất, sau đó gần nhất trong phạm vi <= 5m = 400px)
  const currentTargetEnemyRef = useRef<Enemy | null>(null);
  // Khóa mục tiêu: Khi đòn đánh hoặc chiêu trúng 1 mục tiêu, sẽ ghim mục tiêu trong phạm vi <= 5m (400px). Vượt quá 5m tự động hủy ghim.
  const lockedTargetIdRef = useRef<string | null>(null);
  // Dấu ấn Sát Thủ (Chiêu 2: Phi Tiêu Dấu Ấn - phát nổ sau 5s gây 50% ST chuẩn & hồi 30% máu)
  const assassinMarksRef = useRef<Map<string, { enemyId: string; startTime: number; duration: number; accumulatedDamage: number }>>(new Map());
  // Tầng nội tại Sát Thủ: Tối đa 5 tầng (+5% CR/tầng). Đánh trúng mới tích tầng. Tồn tại 3s, sau đó giảm dần từng tầng theo chu kỳ 3s tiếp theo
  const assassinStacksRef = useRef<{ count: number; lastHitTime: number }>({ count: 0, lastHitTime: 0 });
  // Bộ đếm tạm thời vô hiệu hóa cơ chế nhìn vào quái vật khi thực hiện đòn lướt và trong 0.25s sau khi lướt
  const postDashNoLookTimerRef = useRef<number>(0);
  // Lưu hướng tay và hướng nhìn khi lướt để giữ nguyên sau khi lướt
  const lastDashAngleRef = useRef<number>(0);
  const lastDashFacingRightRef = useRef<boolean>(true);
  const lastDashHandAngleRef = useRef<number>(0);

  // Player spawn visual effect state & refs
  // Chuỗi hiệu ứng:
  // 0. White Screen Fade-out (0.00s -> 0.60s): Toàn bộ màn hình phủ trắng tinh khôi và từ từ mờ dần biến mất mượt mà
  // 1. Gather (0.60s -> 1.30s): Ngay sau lớp màn hình trắng mờ đi, các hạt từ ngoài màn hình bay vào tụ lại đúng hình dáng người chơi
  // 2. Glow & Fade-in (1.30s -> 1.85s): Sau khi tụ đầy đủ, nhân vật phát sáng và từ từ hiện rõ lên (fade in)
  // 3. Burst (1.85s -> 2.25s): Các hạt bùng nổ tỏa ra xung quanh và kích hoạt sóng xung kích
  const SPAWN_WHITE_FADE_END = 0.60;
  const SPAWN_GATHER_END = 1.30;
  const SPAWN_FADEIN_END = 1.85;
  const SPAWN_TOTAL_DURATION = 2.25;

  const spawnBlocksRef = useRef<SpawnBlock[]>(PREALLOCATED_SPAWN_BLOCKS);
  const playerSpawnTimerRef = useRef<number>(0);
  const aiFreezeTimerRef = useRef<number>(0);
  const worldLoadPhaseRef = useRef<number>(3);
  const pendingSpawnsRef = useRef<any[]>([]);
  const hasTriggeredShockwaveRef = useRef<boolean>(false);
  const spawnShockwaveRef = useRef<{ x: number; y: number; progress: number; active: boolean }>({ x: 0, y: 0, progress: 0, active: false });

  // Khởi tạo lười (Lazy Initialization): Tái sử dụng trực tiếp bộ đệm PREALLOCATED_SPAWN_BLOCKS và mảng hằng số CHARACTER_SILHOUETTE_POINTS
  // Không tạo Object mới, không tạo Canvas tạm và không gọi Math.hypot tại frame khởi chạy
  const initPlayerSpawnEffect = useCallback(() => {
    playerSpawnTimerRef.current = SPAWN_TOTAL_DURATION;
    const fSign = playerRef.current.facingRight ? 1 : -1;
    const rawW = typeof window !== 'undefined' ? window.innerWidth : 960;
    const rawH = typeof window !== 'undefined' ? window.innerHeight : 540;
    const maxDim = rawW > rawH ? rawW : rawH;
    const outsideBaseRadius = maxDim * 0.78 + 120;

    const poolBlocks = spawnBlocksRef.current;
    for (let i = 0; i < MAX_SPAWN_PARTICLES; i++) {
      const block = poolBlocks[i];
      const pt = CHARACTER_SILHOUETTE_POINTS[i];
      const angle = (i / MAX_SPAWN_PARTICLES) * Math.PI * 2;
      const outsideDist = outsideBaseRadius + (i % 5) * 32;
      block.startX = Math.cos(angle) * outsideDist;
      block.startY = Math.sin(angle) * outsideDist;
      block.offsetX = pt.x * fSign;
      block.offsetY = pt.y;
      block.size = pt.size;
    }
    hasTriggeredShockwaveRef.current = false;
  }, []);

  // ================= HỆ THỐNG KHỐI ĐÁNH DẤU KHU VỰC XUẤT HIỆN QUÁI & HIỆU ỨNG TỤ HẠT TRẮNG ĐỎ TẠI CHỖ =================
  interface MonsterSpawnerZone {
    x: number;
    y: number;
    triggerRadius: number; // 5m ≈ 280px (1m ≈ 56px)
    spawnCooldown: number;
    lastSpawnTime: number;
    maxMonsters: number; // Tối đa 15 quái cùng lúc
  }

  interface MonsterSpawnAnim {
    id: string;
    x: number;
    y: number;
    timer: number;
    duration: number; // 0.85s
    enemyType: 'chaser' | 'scout' | 'brute';
    name: string;
    radius: number;
    hp: number;
    maxHp: number;
    speed: number;
    damage: number;
    color: string;
    goldDrop: number;
    particles: Array<{
      angle: number;
      dist: number;
      speed: number;
      color: string;
      size: number;
      height: number;
    }>;
  }

  const spawnerZoneRef = useRef<MonsterSpawnerZone>({
    x: 340,
    y: -140,
    triggerRadius: 280, // Phạm vi kích hoạt 5m
    spawnCooldown: 3.0, // Mỗi lần triệu hồi cách nhau 3s
    lastSpawnTime: 0,
    maxMonsters: 15, // Tổng số lượng quái cùng thời điểm không quá 15 con
  });

  const monsterSpawnAnimsRef = useRef<MonsterSpawnAnim[]>([]);

  const combatBotsConfigRef = useRef<
    Array<{
      id: string;
      name: string;
      spawnX: number;
      spawnY: number;
      botClass: ClassType;
      maxHp: number;
    }>
  >([]);
  const botRespawnQueueRef = useRef<Map<string, number>>(new Map());

  // Helper kích hoạt hiệu ứng quái xuất hiện bằng chấm màu trắng - đỏ tại chỗ (không bay từ ngoài vào)
  const triggerMonsterSpawnInPlace = useCallback((targetX: number, targetY: number) => {
    const wave = waveRef.current || 1;
    const roll = Math.random();
    const enemyType: 'chaser' | 'scout' | 'brute' = roll > 0.75 ? 'brute' : roll > 0.4 ? 'scout' : 'chaser';

    const particleColors = ['#ffffff', '#ffffff', '#fee2e2', '#fecaca', '#f87171', '#ef4444', '#dc2626', '#b91c1c'];
    const particles: MonsterSpawnAnim['particles'] = [];
    const particleCount = 28;

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 4 + Math.random() * 22;
      particles.push({
        angle,
        dist,
        speed: 1.2 + Math.random() * 2.2,
        color: particleColors[Math.floor(Math.random() * particleColors.length)],
        size: 2.0 + Math.random() * 2.5,
        height: Math.random() * 16,
      });
    }

    monsterSpawnAnimsRef.current.push({
      id: Math.random().toString(),
      x: targetX,
      y: targetY,
      timer: 0,
      duration: 0.85,
      enemyType,
      name: enemyType === 'brute' ? 'Quái Búa Khổng Lồ' : enemyType === 'scout' ? 'Yêu Tinh Nhanh Nhẹn' : 'Bộ Xương Tấn Công',
      radius: enemyType === 'brute' ? 24 : enemyType === 'scout' ? 12 : 16,
      hp: enemyType === 'brute' ? 120 + wave * 20 : enemyType === 'scout' ? 35 + wave * 5 : 60 + wave * 10,
      maxHp: enemyType === 'brute' ? 120 + wave * 20 : enemyType === 'scout' ? 35 + wave * 5 : 60 + wave * 10,
      speed: enemyType === 'scout' ? 150 : enemyType === 'brute' ? 70 : 105,
      damage: enemyType === 'brute' ? 22 : enemyType === 'scout' ? 8 : 12,
      color: enemyType === 'brute' ? '#7c3aed' : enemyType === 'scout' ? '#f97316' : '#ef4444',
      goldDrop: enemyType === 'brute' ? 25 : enemyType === 'scout' ? 10 : 15,
      particles,
    });
  }, []);

  // Character part pre-render caches to eliminate rendering stutter
  const cachedDauImgRef = useRef<HTMLCanvasElement | HTMLImageElement | null>(null);
  const cachedThanImgRef = useRef<HTMLCanvasElement | HTMLImageElement | null>(null);
  const cachedTayImgRef = useRef<HTMLCanvasElement | HTMLImageElement | null>(null);
  const cachedHairImgRef = useRef<HTMLCanvasElement | HTMLImageElement | null>(null);

  // Chạy thử vòng vẽ rỗng (Dummy Draw Call) để GPU nạp sẵn toàn bộ Sprite vào VRAM tránh giật lag đòn đánh đầu tiên
  const preWarmGPUTextures = useCallback(() => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 10;
      canvas.height = 10;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const imagesToWarm = [
        partImagesRef.current.tay,
        partImagesRef.current.than,
        partImagesRef.current.dau,
        partImagesRef.current.chanTrai,
        partImagesRef.current.chanPhai,
        partImagesRef.current.hair_black,
        partImagesRef.current.hair_silver,
        partImagesRef.current.hair_red,
        partImagesRef.current.hair_violet,
        partImagesRef.current.hair_green,
        partImagesRef.current.bush,
        partImagesRef.current.tree,
        partImagesRef.current.pebble,
      ];
      
      imagesToWarm.forEach((img) => {
        if (img) {
          ctx.drawImage(img, 0, 0, 10, 10);
        }
      });
    } catch (e) {
      console.warn('Pre-warm GPU textures failed:', e);
    }
  }, []);

  const updateCachedCharacterImages = useCallback(() => {
    const baseTayImg = partImagesRef.current.tay;
    if (baseTayImg) {
      cachedTayImgRef.current = getTintedSkinImage(baseTayImg, 'tay', skinColorRef.current);
    }
    
    const baseThanImg = partImagesRef.current.than;
    if (baseThanImg) {
      cachedThanImgRef.current = getTintedSkinImage(baseThanImg, 'than', skinColorRef.current);
    }

    const baseDauImg = partImagesRef.current.dau;
    if (baseDauImg) {
      cachedDauImgRef.current = getTintedSkinImage(baseDauImg, 'dau', skinColorRef.current);
    }

    const curHair = hairStyleRef.current;
    const baseHairImg =
      curHair === 'none'
        ? null
        : curHair === 'hair_silver'
        ? partImagesRef.current.hair_silver
        : curHair === 'hair_red'
        ? partImagesRef.current.hair_red
        : curHair === 'hair_violet'
        ? partImagesRef.current.hair_violet
        : curHair === 'hair_green'
        ? partImagesRef.current.hair_green
        : partImagesRef.current.hair_black;

    if (baseHairImg && curHair && curHair !== 'none') {
      cachedHairImgRef.current = getTintedHairImage(baseHairImg, curHair, hairColorRef.current);
    } else {
      cachedHairImgRef.current = null;
    }
  }, []);

  // Sync cache changes on character customization changes
  useEffect(() => {
    updateCachedCharacterImages();
  }, [hairStyle, hairColor, skinColor, updateCachedCharacterImages]);

  // Helper lấy số tầng nội tại Sát Thủ còn hiệu lực (tối đa 5 tầng, tồn tại 3s, sau đó giảm dần từng tầng theo chu kỳ 3s tiếp theo)
  const getActiveAssassinStacks = useCallback((): number => {
    const now = performance.now();
    const last = assassinStacksRef.current.lastHitTime;
    if (last <= 0 || assassinStacksRef.current.count <= 0) {
      assassinStacksRef.current.count = 0;
      return 0;
    }
    const elapsed = (now - last) / 1000;
    if (elapsed <= 3.0) {
      return assassinStacksRef.current.count;
    }
    // Sau 3 giây không đánh trúng tiếp, số tầng sẽ mất dần (giảm từng tầng một theo chu kỳ 3s tiếp theo)
    const stacksLost = Math.floor((elapsed - 3.0) / 3.0) + 1;
    const remaining = Math.max(0, assassinStacksRef.current.count - stacksLost);
    if (remaining <= 0) {
      assassinStacksRef.current.count = 0;
      return 0;
    }
    return remaining;
  }, []);

  // Helper cộng tầng nội tại Sát Thủ khi đánh trúng địch (cả đòn thường, đòn gồng & chiêu thức, tối đa 5 tầng)
  const addAssassinStackOnHit = useCallback(() => {
    if (statsRef.current.classType !== 'Assassin') return;
    const current = getActiveAssassinStacks();
    assassinStacksRef.current.count = Math.min(5, current + 1);
    assassinStacksRef.current.lastHitTime = performance.now();
  }, [getActiveAssassinStacks]);

  // Helper tìm quái vật ưu tiên máu thấp nhất, nếu bằng nhau thì chọn quái gần nhất trong phạm vi <= 5m (400px)
  const getPriorityTarget = useCallback((): Enemy | null => {
    const p = playerRef.current;
    const livingEnemies = enemiesRef.current.filter((e) => e.hp > 0);
    if (livingEnemies.length === 0) {
      lockedTargetIdRef.current = null;
      return null;
    }

    // Khoảng cách khóa mục tiêu: chỉ hướng về quái vật trong phạm vi <= 5m (400px, 1m = 80px). Qua 5m tự động hủy khóa/bỏ ghim
    const MAX_LOCK_DIST = 400;

    if (lockedTargetIdRef.current) {
      const lockedEnemy = livingEnemies.find((e) => e.id === lockedTargetIdRef.current);
      if (lockedEnemy && lockedEnemy.hp > 0) {
        const dist = Math.hypot(lockedEnemy.x - p.x, lockedEnemy.y - p.y);
        if (dist <= MAX_LOCK_DIST) {
          return lockedEnemy;
        }
      }
      // Vượt quá 5m (400px) -> Tự động hủy cơ chế ghim/hướng về mục tiêu
      lockedTargetIdRef.current = null;
    }

    // Nhân vật chỉ xoay mặt/hướng về phía mục tiêu khi ở trong phạm vi <= 5m (400px)
    const inRange = livingEnemies
      .map((e) => ({ enemy: e, dist: Math.hypot(e.x - p.x, e.y - p.y) }))
      .filter((item) => item.dist <= MAX_LOCK_DIST);

    if (inRange.length === 0) {
      return null; // Ngoài 5m tự động hủy ghim và không xoay mặt về mục tiêu
    }

    // Ưu tiên 1: Quái máu thấp nhất
    // Ưu tiên 2: Quái gần nhất
    inRange.sort((a, b) => {
      if (a.enemy.hp !== b.enemy.hp) {
        return a.enemy.hp - b.enemy.hp;
      }
      return a.dist - b.dist;
    });

    return inRange[0].enemy;
  }, []);

  // Đếm chuỗi 3 đòn đánh thường của Tank: 0 (Tay trái) -> 1 (Tay phải) -> 2 (Đòn thứ 3: Đập 2 tay tại chỗ không nhảy)
  const tankComboCountRef = useRef<number>(0);
  const tankLastNotifiedSecRef = useRef<number>(0);
  // Đếm chuỗi 2 đòn đánh combo của Đấu Sĩ: 0 (Tay trái) -> 1 (Tay Phải)
  const fighterComboCountRef = useRef<number>(0);
  // Đếm chuỗi 3 đòn đánh combo của Sát Thủ: 0 (Đấm tay trái 30°) -> 1 (Đấm tay phải hook 75°) -> 2 (Lướt tới scaleX=1.3)
  const assassinComboCountRef = useRef<number>(0);
  // Hit Stop Timer (Khựng hình 0.03s - 0.05s tại điểm va chạm)
  const hitStopTimerRef = useRef<number>(0);

  // Đếm chuỗi cộng dồn % hao tòn mana khi đánh thường liên tục
  const attackComboStackRef = useRef<number>(0);
  // Bộ đếm thời gian đứng yên (chỉ khi đứng yên 3 giây liên tục mới reset cộng dồn về 0)
  const standingStillTimerRef = useRef<number>(0);
  // Bộ đếm thời gian hồi máu khi Mana đầy
  const hpRegenTimerRef = useRef<number>(0);

  // Trạng thái di chuyển từng bước về phía trước khi bấm đánh thường cho Đấu Sĩ, Sát Thủ, Đỡ Đòn
  const attackStepMoveRef = useRef<{
    active: boolean;
    elapsed: number;
    delay: number;
    duration: number;
    dirX: number;
    dirY: number;
    stepDist: number;
  }>({
    active: false,
    elapsed: 0,
    delay: 0,
    duration: 0.16,
    dirX: 0,
    dirY: 0,
    stepDist: 0,
  });

  // Trạng thái bay trên không khi Tank giữ gồng 1s-5s (2m-6m) nhảy đập đất (không tạo tàn ảnh xanh nước)
  const tankLeapRef = useRef<{
    active: boolean;
    elapsed: number;
    airDuration: number;
    vx: number;
    vy: number;
    maxHeight: number;
    meters: number;
    damage: number;
  }>({
    active: false,
    elapsed: 0,
    airDuration: 0.85,
    vx: 0,
    vy: 0,
    maxHeight: 72,
    meters: 2,
    damage: 0,
  });

  // Trạng thái đòn gồng của Tank: Lao về phía trước húc đổ đối thủ (Battering Ram Charge)
  const tankRamRef = useRef<{
    active: boolean;
    elapsed: number;
    duration: number;
    dirX: number;
    dirY: number;
    speed: number;
    chargeLevel: number;
    damage: number;
    hitEnemyIds: Set<string>;
    afterimageTimer: number;
    dustTimer: number;
  }>({
    active: false,
    elapsed: 0,
    duration: 0.34,
    dirX: 0,
    dirY: 0,
    speed: 0,
    chargeLevel: 0,
    damage: 0,
    hitEnemyIds: new Set<string>(),
    afterimageTimer: 0,
    dustTimer: 0,
  });

  // Trạng thái hoạt ảnh lướt nhanh có sọc tốc độ trên cơ thể của Đấu Sĩ
  const fighterLungeAnimRef = useRef<{
    active: boolean;
    startTime: number;
    duration: number;
    dirX: number;
    dirY: number;
    chargeLevel: number;
  }>({
    active: false,
    startTime: 0,
    duration: 0.28,
    dirX: 0,
    dirY: 0,
    chargeLevel: 0,
  });

  // Hiệu ứng 3 vòng tròn cùng tọa độ phía trước thể hiện đòn gồng rất mạnh mẽ của Đấu Sĩ
  const fighterImpactRingsRef = useRef<
    Array<{
      x: number;
      y: number;
      startTime: number;
      duration: number;
      chargeLevel: number;
    }>
  >([]);

  // Kiểm tra chiêu thức là chiêu Buff (Kỹ năng 1 của tất cả các Class luôn là Buff)
  const isBuffSkill = useCallback((skillId: 1 | 2 | 3) => {
    return skillId === 1;
  }, []);

  interface SwingAnimationState {
    active: boolean;
    startTime: number;
    duration: number;
    strikeDuration?: number;
    retractDuration?: number;
    startAngle: number;
    endAngle: number;
    isCharged: boolean;
    chargeLevel: number;
    comboStep: number;
    activeHand?: 'right' | 'left';
    tankMode?: 'normal_punch' | 'standing_slam' | 'jump_slam' | 'ram_charge';
    hitStopDuration?: number;
    hitStopTriggered?: boolean;
    airDuration?: number;
    maxJumpHeight?: number;
    jumpMeters?: number;
  }
  const swingAnimRef = useRef<SwingAnimationState>({
    active: false,
    startTime: 0,
    duration: 0.16,
    strikeDuration: 0.14,
    retractDuration: 0.40,
    startAngle: 0,
    endAngle: 0,
    isCharged: false,
    chargeLevel: 0,
    comboStep: 0,
    activeHand: 'right',
  });

  interface SwordTrailNode {
    x: number;
    y: number;
    alpha: number;
    color: string;
    width: number;
  }
  const swordTrailRef = useRef<SwordTrailNode[]>([]);

  // Directional Skill Aiming State (Định hướng xoay xanh dương / Hủy đỏ)
  interface SkillAimState {
    skillId: 1 | 2 | 3;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    angle: number;
    dist: number;
    isCancelled: boolean;
    touchId: number | null;
  }
  const aimingSkillRef = useRef<SkillAimState | null>(null);
  const [aimingSkillId, setAimingSkillId] = useState<number | null>(null);

  interface SkillConfig {
    type: 'directional' | 'aoe_circle' | 'none';
    range: number;
  }

  const SKILL_INDICATOR_CONFIG: Record<ClassType, { 1: SkillConfig; 2: SkillConfig; 3: SkillConfig }> = {
    Fighter: {
      1: { type: 'aoe_circle', range: 85 },     // Heavy Slash (Tầm chém)
      2: { type: 'aoe_circle', range: 42 },     // Battle Cry Buff (Vòng hào quang nhỏ gọn quanh người)
      3: { type: 'directional', range: 160 },   // Leap Slam -> Định hướng/Hủy
    },
    Tank: {
      1: { type: 'aoe_circle', range: 36 },     // Holy Shield Buff (Vòng khiên bảo vệ ôm sát nhân vật)
      2: { type: 'aoe_circle', range: 220 },    // Taunt Pull (Vòng hút quái)
      3: { type: 'directional', range: 180 },   // Shield Charge -> Định hướng/Hủy
    },
    Assassin: {
      1: { type: 'directional', range: 160 },   // Shadow Dash -> Định hướng/Hủy
      2: { type: 'aoe_circle', range: 130 },    // Dagger Storm
      3: { type: 'directional', range: 150 },   // Phantom Flurry -> Định hướng/Hủy
    },
    Marksman: {
      1: { type: 'directional', range: 170 },   // Spread Shot -> Định hướng/Hủy
      2: { type: 'aoe_circle', range: 140 },    // Explosive Trap
      3: { type: 'directional', range: 200 },   // Piercing Shot -> Định hướng/Hủy
    },
    Mage: {
      1: { type: 'aoe_circle', range: 160 },    // Frost Nova
      2: { type: 'directional', range: 160 },   // Fireball -> Định hướng/Hủy
      3: { type: 'aoe_circle', range: 260 },    // Thunderstorm
    },
  };

  // Sync Class Changes
  useEffect(() => {
    const preset = CLASS_PRESETS[activeClass];
    playerRef.current.tankShieldHp = 0;
    playerRef.current.tankShieldTimer = 0;
    playerRef.current.marksmanStoneStacks = 0;
    setSkillSystem((prev) => {
      if (prev.unlockedClasses.length === 1 && prev.skillPoints === 1 && Object.values(prev.skillLevels).every((v) => v === 0)) {
        return { ...prev, unlockedClasses: [activeClass] };
      }
      return prev;
    });
    setStats((prev) => ({
      ...prev,
      classType: activeClass,
      shieldHp: 0,
      maxHp: preset.maxHp + (prev.attributes?.hpPoints || 0) * 15,
      currentHp: preset.maxHp + (prev.attributes?.hpPoints || 0) * 15,
      currentMana: (preset.maxMana || 50) + (prev.attributes?.mpPoints || 0) * 10,
      maxMana: (preset.maxMana || 50) + (prev.attributes?.mpPoints || 0) * 10,
      baseDamage: preset.baseDamage + (prev.attributes?.strPoints || 0) * 3,
      defense: (activeClass === 'Tank' ? 12 : 10) + (prev.attributes?.defPoints || 0) * 2,
      moveSpeed: preset.moveSpeed + (prev.attributes?.dexPoints || 0) * 4 + (prev.speedGrowthBonus || 0),
    }));
    skill1CdRef.current = 0;
    skill2CdRef.current = 0;
    skill3CdRef.current = 0;
    setSkill1CdRemaining(0);
    setSkill2CdRemaining(0);
    setSkill3CdRemaining(0);
  }, [activeClass]);

  // Handlers cho Bảng Kỹ Năng (Học hệ mới mỗi 10 cấp, nâng cấp kỹ năng 1->10)
  const handleUnlockClassInSkillTree = useCallback(
    (targetClass: ClassType) => {
      setSkillSystem((prev) => {
        if (prev.unlockedClasses.includes(targetClass)) return prev;
        // Mỗi 10 cấp được mở khóa 1 hệ mới (10 -> 20 -> 30 -> 40 -> 50)
        const reqLvl = prev.unlockedClasses.length === 0 ? 1 : prev.unlockedClasses.length * 10;
        if ((statsRef.current.level || 1) < reqLvl) return prev;
        return {
          ...prev,
          unlockedClasses: [...prev.unlockedClasses, targetClass],
          skillPoints: prev.skillPoints + 1, // Thưởng 1 điểm kỹ năng khi lĩnh ngộ hệ mới
        };
      });
    },
    []
  );

  const handleUpgradeClassLevel = useCallback(
    (targetClass: ClassType) => {
      setSkillSystem((prev) => {
        const getLvl = (c: ClassType) =>
          prev.classLevels?.[c] ?? (prev.unlockedClasses.includes(c) ? 1 : 0);

        const targetLvl = getLvl(targetClass);
        if (targetLvl >= 10) return prev;

        // Tìm xem có Class nào đang trong quá trình luyện (0 < level < 10)
        const inProgress = ALL_CLASS_TYPES.find((c) => {
          const l = getLvl(c);
          return l > 0 && l < 10;
        });

        // Nếu đang có 1 Class luyện dở mà bấm học 1 Class cấp 0 khác thì chặn lại
        if (inProgress && targetClass !== inProgress && targetLvl === 0) {
          return prev;
        }

        // Công thức chi phí: cấp 1 tốn 10đ, mỗi cấp +5đ (cấp 2: 15đ, cấp 3: 20đ...)
        const cost = 10 + targetLvl * 5;
        if (prev.skillPoints < cost) return prev;

        const baseLevels = prev.classLevels || {
          Fighter: prev.unlockedClasses.includes('Fighter') ? 1 : 0,
          Tank: prev.unlockedClasses.includes('Tank') ? 1 : 0,
          Mage: prev.unlockedClasses.includes('Mage') ? 1 : 0,
          Assassin: prev.unlockedClasses.includes('Assassin') ? 1 : 0,
          Marksman: prev.unlockedClasses.includes('Marksman') ? 1 : 0,
        };

        const nextClassLevels = {
          ...baseLevels,
          [targetClass]: targetLvl + 1,
        };

        const nextUnlocked = prev.unlockedClasses.includes(targetClass)
          ? prev.unlockedClasses
          : [...prev.unlockedClasses, targetClass];

        return {
          ...prev,
          skillPoints: prev.skillPoints - cost,
          classLevels: nextClassLevels,
          unlockedClasses: nextUnlocked,
        };
      });

      // Cộng thẳng +5 Công và +20 Máu vào nhân vật mỗi cấp
      setStats((s) => ({
        ...s,
        baseDamage: s.baseDamage + 5,
        maxHp: s.maxHp + 20,
        currentHp: s.currentHp + 20,
      }));
    },
    []
  );

  // Mở khóa Ô 2 (nhánh phụ): Phím 1 = 10đ, Phím 2 = 100đ, Phím 3 = 1000đ
  const handleUnlockSubSlot = useCallback((slotNumber: 1 | 2 | 3) => {
    const costMap: Record<1 | 2 | 3, number> = { 1: 10, 2: 100, 3: 1000 };
    const cost = costMap[slotNumber];
    setSkillSystem((prev) => {
      const isAlreadyUnlocked = prev.unlockedSubSlots?.[slotNumber] ?? false;
      if (isAlreadyUnlocked || prev.skillPoints < cost) return prev;

      return {
        ...prev,
        skillPoints: prev.skillPoints - cost,
        unlockedSubSlots: {
          ...(prev.unlockedSubSlots || { 1: false, 2: false, 3: false }),
          [slotNumber]: true,
        },
      };
    });
  }, []);

  const handleSaveSkillSystem = useCallback((newSkillSystem: SkillSystemState) => {
    setSkillSystem(newSkillSystem);
  }, []);

  const handleUpgradeSkillNode = useCallback((nodeId: SkillNodeId) => {
    setSkillSystem((prev) => {
      const curLvl = prev.skillLevels[nodeId] || 0;
      if (curLvl >= 10) return prev;

      const [classStr, slotStr] = nodeId.split('_');
      const cType = classStr as ClassType;
      const slotNum = Number(slotStr) as 1 | 2 | 3;

      // Chi phí: Chiêu 1 = (lvl+1)*10, Chiêu 2 = (lvl+1)*20, Chiêu 3 = (lvl+1)*50
      const step = slotNum === 1 ? 10 : slotNum === 2 ? 20 : 50;
      const cost = (curLvl + 1) * step;
      if (prev.skillPoints < cost) return prev;

      // Kiểm tra điều kiện học tuần tự:
      // Chiêu 1 cần Nội tại >= 1
      if (slotNum === 1 && (prev.passiveLevels[cType] || 0) < 1) {
        return prev;
      }
      // Chiêu 2 cần Chiêu 1 >= 1
      if (slotNum === 2 && (prev.skillLevels[`${cType}_1` as SkillNodeId] || 0) < 1) {
        return prev;
      }
      // Chiêu 3 cần Chiêu 2 >= 1
      if (slotNum === 3 && (prev.skillLevels[`${cType}_2` as SkillNodeId] || 0) < 1) {
        return prev;
      }

      const nextLvl = curLvl + 1;
      const nextEquipped = { ...prev.equippedSlots };

      // Khi mới học chiêu ở cấp 1, nếu ô tương ứng (1, 2, hoặc 3) đang trống hoàn toàn thì tự gắn vào Ô 1 (Nhánh Chính)
      if (curLvl === 0 && !nextEquipped[slotNum].main) {
        nextEquipped[slotNum] = { ...nextEquipped[slotNum], main: nodeId };
      }

      return {
        ...prev,
        skillPoints: prev.skillPoints - cost,
        skillLevels: {
          ...prev.skillLevels,
          [nodeId]: nextLvl,
        },
        equippedSlots: nextEquipped,
      };
    });
  }, []);

  const handleUpgradePassiveNode = useCallback((targetClass: ClassType) => {
    setSkillSystem((prev) => {
      const curLvl = prev.passiveLevels[targetClass] || 0;
      // Nội tại: (lvl+1)*5 (Cấp 1: 5, Cấp 2: 10, Cấp 3: 15...)
      const cost = (curLvl + 1) * 5;
      if (prev.skillPoints < cost || curLvl >= 10 || !prev.unlockedClasses.includes(targetClass)) return prev;
      return {
        ...prev,
        skillPoints: prev.skillPoints - cost,
        passiveLevels: {
          ...prev.passiveLevels,
          [targetClass]: curLvl + 1,
        },
      };
    });
    // Cộng thẳng chỉ số nội tại vào nhân vật ngay lập tức (không cần đổi class)
    if (targetClass === 'Fighter') {
      setStats((s) => ({ ...s, baseDamage: s.baseDamage + 3 }));
    } else if (targetClass === 'Tank') {
      setStats((s) => ({ ...s, maxHp: s.maxHp + 25, currentHp: s.currentHp + 25, defense: (s.defense || 10) + 2 }));
    } else if (targetClass === 'Mage') {
      setStats((s) => ({ ...s, maxMana: s.maxMana + 15, currentMana: s.currentMana + 15 }));
    } else if (targetClass === 'Assassin') {
      setStats((s) => ({
        ...s,
        critChanceBonus: (s.critChanceBonus || 0) + 0.02,
        critMultiplierBonus: (s.critMultiplierBonus || 0) + 0.12,
      }));
    } else if (targetClass === 'Marksman') {
      setStats((s) => ({
        ...s,
        critChanceBonus: (s.critChanceBonus || 0) + 0.02,
        moveSpeed: s.moveSpeed + 2,
      }));
    }
  }, []);

  const handleAssignSkillSlot = useCallback(
    (slotNumber: 1 | 2 | 3, branch: 'main' | 'sub', nodeId: SkillNodeId | null) => {
      setSkillSystem((prev) => {
        const nextEquipped: SkillSystemState['equippedSlots'] = {
          1: { ...prev.equippedSlots[1] },
          2: { ...prev.equippedSlots[2] },
          3: { ...prev.equippedSlots[3] },
        };

        // Nếu kỹ năng này đang được gắn ở một ô khác, tự động gỡ khỏi ô cũ để tránh gắn trùng gây lỗi hồi chiêu
        if (nodeId) {
          ([1, 2, 3] as const).forEach((s) => {
            if (nextEquipped[s].main === nodeId) nextEquipped[s].main = null;
            if (nextEquipped[s].sub === nodeId) nextEquipped[s].sub = null;
          });
        }

        nextEquipped[slotNumber][branch] = nodeId;

        return {
          ...prev,
          equippedSlots: nextEquipped,
        };
      });
    },
    []
  );

  // ImgBB Body Parts Image Loader (Tay, Chân Phải, Chân Trái, Đầu, Thân, Tóc Đỏ, Tóc Hiệp Khách)
  const partImagesRef = useRef<{
    tay: HTMLImageElement | null;
    chanPhai: HTMLImageElement | null;
    chanTrai: HTMLImageElement | null;
    dau: HTMLImageElement | null;
    than: HTMLImageElement | null;
    hair_red: HTMLImageElement | null;
    hair_black: HTMLImageElement | null;
    hair_silver: HTMLImageElement | null;
    hair_violet: HTMLImageElement | null;
    hair_green: HTMLImageElement | null;
    pebble: HTMLImageElement | null;
    bush: HTMLImageElement | null;
    tree: HTMLImageElement | null;
    spawnerBlock: HTMLImageElement | null;
  }>({
    tay: null,
    chanPhai: null,
    chanTrai: null,
    dau: null,
    than: null,
    hair_red: null,
    hair_black: null,
    hair_silver: null,
    hair_violet: null,
    hair_green: null,
    pebble: null,
    bush: null,
    tree: null,
    spawnerBlock: null,
  });

  // 5. Đám Mây Đổ Bóng Nền Đất (Cloud Shadows trôi chậm trên địa hình)
  interface CloudShadow {
    x: number;
    y: number;
    width: number;
    height: number;
    speedX: number;
    speedY: number;
    opacity: number;
    circles: Array<{ dx: number; dy: number; r: number }>;
  }

  // Cấu hình Chu kỳ Ngày - Đêm (20 phút = 1200 giây: 10 phút ngày, 10 phút đêm):
  // Bắt đầu ở Ban Ngày (a: 0.00) để nền bản đồ và ô lưới hiển thị sáng rõ ngay khi vào game
  const DAY_NIGHT_KEYFRAMES = [
    // [0s - 480s]: BAN NGÀY - MÀU SÁNG RÕ GỐC CỦA GAME (8 phút ngày tươi sáng, không phủ màu tối)
    { t: 0,    r: 4, g: 12, b: 38, a: 0.00 },
    { t: 480,  r: 4, g: 12, b: 38, a: 0.00 },

    // [480s - 600s]: HOÀNG HÔN (2 phút chuyển tiếp mượt mà sang Ban Đêm)
    { t: 600,  r: 4, g: 12, b: 38, a: 0.78 },

    // [600s - 1080s]: BAN ĐÊM - NỀN XANH ĐẬM TỐI HẲN (8 phút tối sâu)
    { t: 1080, r: 4, g: 12, b: 38, a: 0.78 },

    // [1080s - 1200s]: BÌNH MINH (2 phút chuyển tiếp mượt mà từ đêm về lại Ban Ngày)
    { t: 1200, r: 4, g: 12, b: 38, a: 0.00 },
  ];

  const getDayNightLighting = (offsetMs: number, nowMs: number) => {
    const cycleSec = ((nowMs + offsetMs) / 1000) % 1200; // 20 phút = 1200 giây
    const safeCycleSec = Math.max(0, Math.min(1199.999, cycleSec));
    let k1 = DAY_NIGHT_KEYFRAMES[0];
    let k2 = DAY_NIGHT_KEYFRAMES[1];
    for (let i = 0; i < DAY_NIGHT_KEYFRAMES.length - 1; i++) {
      if (safeCycleSec >= DAY_NIGHT_KEYFRAMES[i].t && safeCycleSec <= DAY_NIGHT_KEYFRAMES[i + 1].t) {
        k1 = DAY_NIGHT_KEYFRAMES[i];
        k2 = DAY_NIGHT_KEYFRAMES[i + 1];
        break;
      }
    }
    const rangeT = Math.max(1, k2.t - k1.t);
    const fraction = Math.max(0, Math.min(1, (safeCycleSec - k1.t) / rangeT));
    const smoothF = fraction * fraction * (3 - 2 * fraction);
    const curR = Math.round(k1.r + (k2.r - k1.r) * smoothF);
    const curG = Math.round(k1.g + (k2.g - k1.g) * smoothF);
    const curB = Math.round(k1.b + (k2.b - k1.b) * smoothF);
    const curA = Math.max(0, Math.min(0.78, k1.a + (k2.a - k1.a) * smoothF));
    return { curR, curG, curB, curA };
  };

  // 4. Chu Kỳ Ngày - Đêm (20 phút real-time) & Offset thời gian chuyển mốc thử nghiệm
  const dayNightTimeOffsetRef = useRef<number>(0);
  const cloudShadowsRef = useRef<CloudShadow[]>([]);

  // 6. Hệ Thống Thời Tiết Chi Tiết (Mưa Chạm Đất, Giông Bão & Nháy Màn Hình 2 Lần Trước Tiếng Sét)
  const weatherCycleIndexRef = useRef<number>(-1);
  const weatherStateRef = useRef<{
    isStormActive: boolean;
    stormDurationTimer: number; // Mưa rơi tối đa trong 1 phút (60s)
    darkOverlayAlpha: number; // Layer tối chèn vào kể cả trời sáng (0 -> 0.52)
    isClearingDarkLayer: boolean; // Trạng thái layer tối tan dần sau khi mưa tạnh hẳn
    rainDrops: Array<{
      x: number;
      y: number;
      groundX: number;
      groundY: number;
      length: number;
      speed: number;
      alpha: number;
    }>;
    rainSplashes: Array<{ x: number; y: number; r: number; maxR: number; alpha: number }>;
    lightningTimer: number;
    lightningFlashAlpha: number;
    lightningStrike: {
      active: boolean;
      timer: number;
      thunderDelay: number;
      thunderTriggered: boolean;
    } | null;
  }>({
    isStormActive: false,
    stormDurationTimer: 60,
    darkOverlayAlpha: 0,
    isClearingDarkLayer: false,
    rainDrops: [],
    rainSplashes: [],
    lightningTimer: 10,
    lightningFlashAlpha: 0,
    lightningStrike: null,
  });

  // 4 biến thể bụi cây đã cắt sát viền (tight crop) + chỉnh màu lá hợp với sàn cỏ (#86a849) + đổi màu hoa:
  // 'white' (hoa trắng), 'red' (hoa đỏ), 'blue' (hoa xanh dương), 'green' (xanh lá - bụi không hoa)
  const bushVariantsRef = useRef<{
    white: HTMLCanvasElement | null;
    red: HTMLCanvasElement | null;
    blue: HTMLCanvasElement | null;
    green: HTMLCanvasElement | null;
  }>({
    white: null,
    red: null,
    blue: null,
    green: null,
  });

  // Cây lớn có thân và tán cây không thân tạo chiều sâu bìa rừng
  const treeVariantRef = useRef<HTMLCanvasElement | null>(null);
  const canopyVariantRef = useRef<HTMLCanvasElement | null>(null);
  const canopyDarkestRef = useRef<HTMLCanvasElement | null>(null);
  const canopyMidRef = useRef<HTMLCanvasElement | null>(null);

  // Bộ 8 ô cỏ đã bẻ góc nghiêng 2.5D Isometric (84x46) với 8 hướng quay/lật ngẫu nhiên từ ảnh https://ibb.co/27TkrmXC
  const grassIsoTilesRef = useRef<{
    town: HTMLCanvasElement[];
    wild: HTMLCanvasElement[];
  }>({
    town: [],
    wild: [],
  });

  // Quản lý hoạt ảnh chạy: Chu kỳ đá chân, góc đá, tốc độ phụ thuộc vận tốc di chuyển
  const runAnimRef = useRef<{
    phase: number;
    weight: number; // 0: đứng yên, 1: chạy tối đa
    lastTime: number;
    dustTimer: number;
    lastStepHalfCycle: number;
  }>({
    phase: 0,
    weight: 0,
    lastTime: performance.now(),
    dustTimer: 0,
    lastStepHalfCycle: 0,
  });

  // Trạng thái choáng đập mặt vào vách đá & rung màn hình
  const dazeTimerRef = useRef(0);
  const dazeOrbitRef = useRef(0);
  const screenShakeRef = useRef({ intensity: 0 });

  // Trạng thái rung chấn động mặt đất khi sấm nổ: Khớp 1:1 đồng thời cùng lúc với âm thanh sấm rền
  const thunderShakeRef = useRef<{
    active: boolean;
    intensity: number;
    duration: number;
    elapsed: number;
  }>({
    active: false,
    intensity: 0,
    duration: 1.85,
    elapsed: 0,
  });

  // Trạng thái chết của nhân vật: bay ngửa ra sau và nằm ngửa
  const deathStateRef = useRef<{
    isDead: boolean;
    elapsed: number;
    knockbackVx: number;
    knockbackVy: number;
    airHeight: number;
    airVelZ: number;
    bounced: boolean;
  }>({
    isDead: false,
    elapsed: 0,
    knockbackVx: 0,
    knockbackVy: 0,
    airHeight: 0,
    airVelZ: 0,
    bounced: false,
  });
  const [isPlayerDead, setIsPlayerDead] = useState(false);
  const [respawnCountdown, setRespawnCountdown] = useState<number | null>(null);
  const lastCountdownRef = useRef<number | null>(null);

  // Hiệu ứng hình thoi mỏng trắng gắn vào tay mờ dần khi Sát Thủ đánh thường:
  // Kéo dài từ tọa độ tay lúc gồng đến tọa độ tay khi vung ra hết
  interface AssassinHandEffectState {
    active: boolean;
    chargeLevel: number;
    startTime: number;
    duration: number;
    isExtendedRush?: boolean;
  }
  const assassinChevronRef = useRef<{
    right: AssassinHandEffectState;
    left: AssassinHandEffectState;
  }>({
    right: { active: false, chargeLevel: 0, startTime: 0, duration: 0.38 },
    left: { active: false, chargeLevel: 0, startTime: 0, duration: 0.38 },
  });

  // ================= 1. HỆ THỐNG RENDER BẢN ĐỒ NỀN ĐẤT THEO CHUNKS =================
  // Toàn bộ bản đồ là nền thảm cỏ & đất liền mạch không có viền xanh
  // Chỉ render các ô chunk trong tầm nhìn/khu vực người chơi, các khu vực khác tải theo yêu cầu
  const renderMapChunk = useCallback((cx: number, cy: number): HTMLCanvasElement => {
    const oc = document.createElement('canvas');
    oc.width = CHUNK_SIZE;
    oc.height = CHUNK_SIZE;
    const ctx = oc.getContext('2d');
    if (!ctx) return oc;

    const halfTileW = 44;
    const halfTileH = 22;

    const worldLeft = cx * CHUNK_SIZE - MAP_BOUND;
    const worldTop = cy * CHUNK_SIZE - MAP_BOUND;
    const worldRight = worldLeft + CHUNK_SIZE;
    const worldBottom = worldTop + CHUNK_SIZE;

    ctx.save();
    // Dịch gốc tọa độ để vẽ chính xác theo hệ tọa độ thế giới (World space)
    ctx.translate(-worldLeft, -worldTop);

    // 1. Nền cỏ phẳng liền mạch cơ bản
    ctx.fillStyle = '#81a345';
    ctx.fillRect(worldLeft, worldTop, CHUNK_SIZE, CHUNK_SIZE);

    const drawCenteredSoftShadow = (
      sx: number,
      sy: number,
      rx: number,
      ry: number,
      centerAlpha = 0.62,
      midAlpha = 0.32
    ) => {
      if (rx <= 0.5 || ry <= 0.5) return;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(1, ry / rx);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      grad.addColorStop(0, `rgba(10, 18, 8, ${centerAlpha})`);
      grad.addColorStop(0.45, `rgba(15, 25, 10, ${midAlpha})`);
      grad.addColorStop(0.8, `rgba(20, 32, 12, ${midAlpha * 0.35})`);
      grad.addColorStop(1, 'rgba(20, 32, 12, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    // 2. Tính toán phạm vi col, row cắt qua chunk này
    const pad = 60;
    const cLeft = worldLeft - pad;
    const cRight = worldRight + pad;
    const cTop = worldTop - pad;
    const cBottom = worldBottom + pad;

    const col1 = Math.floor((cLeft / halfTileW + cTop / halfTileH) / 2);
    const col2 = Math.floor((cRight / halfTileW + cTop / halfTileH) / 2);
    const col3 = Math.floor((cLeft / halfTileW + cBottom / halfTileH) / 2);
    const col4 = Math.floor((cRight / halfTileW + cBottom / halfTileH) / 2);

    const row1 = Math.floor((cTop / halfTileH - cLeft / halfTileW) / 2);
    const row2 = Math.floor((cTop / halfTileH - cRight / halfTileW) / 2);
    const row3 = Math.floor((cBottom / halfTileH - cLeft / halfTileW) / 2);
    const row4 = Math.floor((cBottom / halfTileH - cRight / halfTileW) / 2);

    const minCol = Math.min(col1, col2, col3, col4);
    const maxCol = Math.max(col1, col2, col3, col4);
    const minRow = Math.min(row1, row2, row3, row4);
    const maxRow = Math.max(row1, row2, row3, row4);

    const minDiag = minCol + minRow;
    const maxDiag = maxCol + maxRow;

    for (let sum = minDiag; sum <= maxDiag; sum++) {
      const startCol = Math.max(minCol, sum - maxRow);
      const endCol = Math.min(maxCol, sum - minRow);

      for (let col = startCol; col <= endCol; col++) {
        const row = sum - col;
        const tx = (col - row) * halfTileW;
        const ty = (col + row) * halfTileH;

        if (tx < worldLeft - 60 || tx > worldRight + 60 || ty < worldTop - 60 || ty > worldBottom + 60) {
          continue;
        }

        const isAlt = (col + row) % 2 === 0;
        const tileHash = Math.abs((col * 179424673 ^ row * 271828183) | 0);
        const elevationSteps = [0.8, 1.2, 1.6, 2.0, 2.4];
        const rawElevation = elevationSteps[(tileHash >>> 4) % 5];
        const blockElevation = rawElevation;
        const topY = ty - blockElevation;

        if (blockElevation > 0.25) {
          ctx.beginPath();
          ctx.moveTo(tx - halfTileW - 0.5, topY);
          ctx.lineTo(tx, topY + halfTileH);
          ctx.lineTo(tx, ty + halfTileH);
          ctx.lineTo(tx - halfTileW - 0.5, ty);
          ctx.closePath();
          ctx.fillStyle = '#75963c';
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(tx, topY + halfTileH);
          ctx.lineTo(tx + halfTileW + 0.5, topY);
          ctx.lineTo(tx + halfTileW + 0.5, ty);
          ctx.lineTo(tx, ty + halfTileH);
          ctx.closePath();
          ctx.fillStyle = '#688734';
          ctx.fill();
        }

        const isoVariants = grassIsoTilesRef.current.town;
        if (isoVariants && isoVariants.length > 0) {
          const orientationIdx = tileHash % isoVariants.length;
          const variantCanvas = isoVariants[orientationIdx];
          ctx.drawImage(variantCanvas, tx - 44, topY - 25, 88, 50);
        } else {
          ctx.beginPath();
          ctx.moveTo(tx, topY - halfTileH);
          ctx.lineTo(tx + halfTileW, topY);
          ctx.lineTo(tx, topY + halfTileH);
          ctx.lineTo(tx - halfTileW, topY);
          ctx.closePath();
          ctx.fillStyle = isAlt ? '#86a849' : '#81a345';
          ctx.fill();
        }

        // Cụm hoa điểm xuyết
        if ((tileHash >>> 7) % 11 === 0) {
          const flwOffX = (((tileHash >>> 11) % 25) - 12);
          const flwOffY = (((tileHash >>> 16) % 13) - 6);
          if (Math.abs(flwOffX) / halfTileW + Math.abs(flwOffY) / halfTileH < 0.58) {
            const baseFx = Math.round(tx + flwOffX);
            const baseFy = Math.round(topY + flwOffY);
            const clusterCount = 3 + ((tileHash >>> 20) % 3);
            const clusterOffsets: [number, number][] = [
              [0, 0],
              [4, -2],
              [-3, 2],
              [3, 3],
              [-4, -2],
            ];

            const colorType = (tileHash >>> 14) % 3;
            let petalColor = '#ffffff';
            let pistilColor = '#fef08a';

            if (colorType === 1) {
              petalColor = ((tileHash >>> 17) & 1) === 0 ? '#818cf8' : '#a5b4fc';
              pistilColor = '#e0e7ff';
            } else if (colorType === 2) {
              petalColor = ((tileHash >>> 17) & 1) === 0 ? '#fce7f3' : '#fbcfe8';
              pistilColor = '#fff1f2';
            }

            for (let fIdx = 0; fIdx < clusterCount; fIdx++) {
              const [ox, oy] = clusterOffsets[fIdx];
              const jitterX = (((tileHash >>> (fIdx * 3 + 2)) & 1) === 0 ? 0 : 1);
              const fx = baseFx + ox + jitterX;
              const fy = baseFy + oy;
              ctx.fillStyle = '#5e7c2c';
              ctx.fillRect(fx, fy + 2, 2, 1);
              ctx.fillStyle = petalColor;
              ctx.fillRect(fx, fy, 2, 2);
              ctx.fillStyle = pistilColor;
              ctx.fillRect(fx + 1, fy + 1, 1, 1);
            }
          }
        }

        // Sỏi đá điểm xuyết
        const GRID_SIZE = 6;
        const blockCol = Math.floor(col / GRID_SIZE);
        const blockRow = Math.floor(row / GRID_SIZE);
        const localCol = ((col % GRID_SIZE) + GRID_SIZE) % GRID_SIZE;
        const localRow = ((row % GRID_SIZE) + GRID_SIZE) % GRID_SIZE;

        const blockHash = Math.abs((blockCol * 374761393 ^ blockRow * 668265263) | 0);
        const chosenLocalCol = 1 + ((blockHash >>> 5) % 4);
        const chosenLocalRow = 1 + ((blockHash >>> 9) % 4);

        const hasPebbleInTile = localCol === chosenLocalCol && localRow === chosenLocalRow;
        const distToCenter = Math.hypot(tx, topY);
        if (hasPebbleInTile && distToCenter > 65) {
          const pebbleImg = partImagesRef.current.pebble;
          const pebOffX = (((tileHash >>> 13) % 25) - 12);
          const pebOffY = (((tileHash >>> 18) % 13) - 6);
          if (Math.abs(pebOffX) / halfTileW + Math.abs(pebOffY) / halfTileH < 0.58) {
            const px = Math.round(tx + pebOffX);
            const py = Math.round(topY + pebOffY);
            const pebSize = 18 + ((tileHash >>> 21) % 11);
            const flipPebble = ((tileHash >>> 25) & 1) === 1 ? -1 : 1;

            ctx.save();
            ctx.translate(px, py);
            drawCenteredSoftShadow(0, pebSize * 0.22, pebSize * 0.46, pebSize * 0.22, 0.58, 0.28);
            ctx.scale(flipPebble, 1);
            if (pebbleImg && (pebbleImg.naturalWidth || pebbleImg.width)) {
              const pW = pebbleImg.naturalWidth || pebbleImg.width;
              const pH = pebbleImg.naturalHeight || pebbleImg.height;
              const drawW = pebSize;
              const drawH = pebSize * (pH / pW);
              ctx.drawImage(pebbleImg, -drawW / 2, -drawH / 2, drawW, drawH);
            }
            ctx.restore();
          }
        }
      }
    }

    ctx.restore();
    return oc;
  }, []);

  const getOrLoadMapChunk = useCallback((cx: number, cy: number): HTMLCanvasElement => {
    const key = `${cx}_${cy}`;
    let chunk = mapChunksRef.current.get(key);
    if (!chunk) {
      chunk = renderMapChunk(cx, cy);
      mapChunksRef.current.set(key, chunk);
    }
    return chunk;
  }, [renderMapChunk]);

  const renderCachedMap = useCallback(() => {
    mapChunksRef.current.clear();
    isMapCachedRef.current = true;
  }, []);

  useEffect(() => {
    const loadPartImage = (partKey: keyof typeof partImagesRef.current, primaryUrl: string, fallbacks: string[] = []) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const allUrls = [primaryUrl, ...fallbacks];
      let tryIdx = 0;
      const tryNext = () => {
        if (tryIdx < allUrls.length) {
          img.src = allUrls[tryIdx++];
        }
      };
      img.onload = () => {
        // Ép buộc giải mã hình ảnh không đồng bộ (Asynchronous decode) trong luồng nền
        img.decode().then(() => {
          // Đối với 2 chân: Chuẩn hóa màu xám đen đồng nhất và khử hoàn toàn viền mờ (semi-transparent) gây vạch nhấp nháy ở chân
          if (partKey === 'chanPhai' || partKey === 'chanTrai') {
            try {
              const oc = document.createElement('canvas');
              const w = img.naturalWidth || img.width;
              const h = img.naturalHeight || img.height;
              oc.width = w;
              oc.height = h;
              const octx = oc.getContext('2d');
              if (octx) {
                octx.drawImage(img, 0, 0);
                const imgData = octx.getImageData(0, 0, w, h);
                const d = imgData.data;
                let minL = 255, maxL = 0;
                for (let i = 0; i < d.length; i += 4) {
                  if (d[i + 3] > 20) {
                    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                    if (lum < minL) minL = lum;
                    if (lum > maxL) maxL = lum;
                  }
                }
                const origLegAlpha = new Uint8Array(w * h);
                for (let i = 0; i < d.length; i += 4) {
                  if (d[i + 3] < 140) {
                    d[i + 3] = 0;
                    origLegAlpha[i >> 2] = 0;
                  } else {
                    d[i + 3] = 255;
                    origLegAlpha[i >> 2] = 255;
                    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                    const norm = Math.max(0, Math.min(1, (lum - minL) / (maxL - minL || 1)));
                    const baseGrey = 36 + norm * 28;
                    d[i] = Math.round(baseGrey * 0.95);
                    d[i + 1] = Math.round(baseGrey * 0.98);
                    d[i + 2] = Math.round(baseGrey * 1.05);
                  }
                }
                // Thêm đường viền mỏng (Outline) nhẹ xung quanh ống quần/chân để nổi bật trên nền cỏ
                const legStep = Math.max(1, Math.round(Math.min(w, h) / 22));
                for (let y = 0; y < h; y++) {
                  for (let x = 0; x < w; x++) {
                    const idx = y * w + x;
                    if (origLegAlpha[idx] > 0) continue;
                    if (
                      (x >= legStep && origLegAlpha[idx - legStep] > 0) ||
                      (x + legStep < w && origLegAlpha[idx + legStep] > 0) ||
                      (y >= legStep && origLegAlpha[(y - legStep) * w + x] > 0) ||
                      (y + legStep < h && origLegAlpha[(y + legStep) * w + x] > 0)
                    ) {
                      const pIdx = idx * 4;
                      d[pIdx] = 12;
                      d[pIdx + 1] = 18;
                      d[pIdx + 2] = 28;
                      d[pIdx + 3] = 215;
                    }
                  }
                }
                octx.putImageData(imgData, 0, 0);
                const darkImg = new Image();
                darkImg.onload = () => {
                  darkImg.decode().then(() => {
                    partImagesRef.current[partKey] = darkImg;
                  }).catch(() => {
                    partImagesRef.current[partKey] = darkImg;
                  });
                };
                darkImg.src = oc.toDataURL();
                return;
              }
            } catch {
              // Trường hợp lỗi canvas ngoài ý muốn, vẫn sử dụng ảnh đã nạp
            }
          }
          partImagesRef.current[partKey] = img;
          if (partKey === 'pebble') {
            renderCachedMap();
          }
        }).catch(() => {
          // Fallback nếu .decode() bị lỗi hoặc không được hỗ trợ
          partImagesRef.current[partKey] = img;
          if (partKey === 'pebble') {
            renderCachedMap();
          }
        });
      };
      img.onerror = () => {
        tryNext();
      };
      tryNext();
    };

    // 1. Thân người gốc mới có cổ trắng để nhuộm màu da, giữ nguyên áo (https://ibb.co/cScjqznZ)
    loadPartImage('than', 'https://i.ibb.co/hJRS0pz4/pixil-frame-0-6-1-3-5.png', [
      'https://i.ibb.co/8nbPCRTR/pixil-frame-0-6-1-3-4.png',
      'https://i.ibb.co/mV0RGtnV/pixil-frame-0-6-1-3-3.png',
      '/character/than.png',
    ]);

    // 2. Chân phải màu xám đen
    loadPartImage('chanPhai', '/character/chanPhai.png', [
      '/character/chanPhai_xamden.png',
      'https://i.ibb.co/YFnBy2dS/pixil-frame-0-4-3.png',
    ]);

    // 3. Chân trái màu xám đen
    loadPartImage('chanTrai', '/character/chanTrai.png', [
      '/character/chanTrai_xamden.png',
      'https://i.ibb.co/chcZwp57/pixil-frame-0-4-1.png',
    ]);

    // 4. Tay gốc mới màu trắng/xám để nhuộm màu da (https://ibb.co/tpJPXkpG)
    loadPartImage('tay', 'https://i.ibb.co/8g74cTgC/Gemini-Generated-Image-qe6eetqe6eetqe6e-1.png', [
      'https://i.ibb.co/B2CKNd2p/Gemini-Generated-Image-qe6eetqe6eetqe6e-1.png',
      'https://i.ibb.co/HTFrWpCW/pixil-frame-0-2-1.png',
    ]);

    // 5. Đầu gốc mới màu trắng/xám để nhuộm màu da (https://ibb.co/Q7NcjZtM)
    loadPartImage('dau', 'https://i.ibb.co/6cPZJ2LF/Gemini-Generated-Image-dy7pbcdy7pbcdy7p-1.png', [
      'https://i.ibb.co/nqc08Ttj/Gemini-Generated-Image-dy7pbcdy7pbcdy7p-1.png',
      'https://i.ibb.co/jPgSKXNp/pixil-frame-0-5.png',
    ]);

    // 7. Kiểu Tóc Hiệp Khách Gốc (https://ibb.co/5gx8QVv7)
    loadPartImage('hair_black', 'https://i.ibb.co/W4pyr1FT/Gemini-Generated-Image-rt9fhart9fhart9f-1.png', [
      'https://i.ibb.co/7dNW3FV9/Gemini-Generated-Image-rt9fhart9fhart9f-1.png',
      'https://i.ibb.co/zWPqpSHd/dd4a84aaa3e2f4df091bda916eab3c80-1-1.png',
    ]);

    // 8. Kiểu Tóc Bạch Kim Gốc (https://ibb.co/XkF44dW5)
    loadPartImage('hair_silver', 'https://i.ibb.co/qFmnn4Dg/Gemini-Generated-Image-fof09fof09fof09f-1.png', [
      'https://i.ibb.co/NnW33kFN/Gemini-Generated-Image-fof09fof09fof09f-1.png',
      'https://i.ibb.co/WvWzqjmN/abc9375592b9add18e198e504820a6db-1.png',
    ]);

    // 9. Kiểu Tóc Hỏa Long Gốc Mới (https://ibb.co/BHJfQs2X)
    loadPartImage('hair_red', 'https://i.ibb.co/JWTcGkjf/Gemini-Generated-Image-7ctsig7ctsig7cts-1-1.png', [
      'https://i.ibb.co/6cSyTs03/Gemini-Generated-Image-7ctsig7ctsig7cts-1-1.png',
      'https://i.ibb.co/DfQmbW4t/Gemini-Generated-Image-7ctsig7ctsig7cts-1.png',
    ]);

    // 10. Kiểu Tóc Tử Điện Gốc (https://ibb.co/gbZYfFVY)
    loadPartImage('hair_violet', 'https://i.ibb.co/JWjZGFQZ/Gemini-Generated-Image-oc46rxoc46rxoc46-1.png', [
      'https://i.ibb.co/5XhZSxFZ/Gemini-Generated-Image-oc46rxoc46rxoc46-1.png',
      'https://i.ibb.co/3YdrV7KL/21a75e96b065143a0905f0d2bd7fe166-1-1-3.png',
    ]);

    // 11. Kiểu Tóc Bích Lục Mới (https://ibb.co/5xcRbBPy)
    loadPartImage('hair_green', 'https://i.ibb.co/5xcRbBPy/image.png', [
      'https://i.ibb.co/5xcRbBPy/5xcRbBPy.png',
      'https://i.ibb.co/5xcRbBPy/hair.png',
      'https://i.ibb.co/bRB5ZRJy/6df263fe25e673bb3e64256773f490fb-1.png',
    ]);

    // 11b. Viên sỏi trên mặt cỏ (https://ibb.co/0VdF7qKB)
    loadPartImage('pebble', 'https://i.ibb.co/Lh2JFSrQ/795bdef79e87f2d391865c015fbbe950-removebg-preview.png', [
      'https://i.ibb.co/0VdF7qKB/795bdef79e87f2d391865c015fbbe950-removebg-preview.png',
      'https://i.ibb.co/0VdF7qKB/image.png',
    ]);

    // 5. Khởi tạo các đám mây đổ bóng nền đất (Cloud Shadows diện tích lớn)
    if (cloudShadowsRef.current.length === 0) {
      const clouds = [];
      const baseCount = 14;
      for (let i = 0; i < baseCount; i++) {
        // Tăng mạnh diện tích bóng mây: Chiều rộng 750 - 1350px, Chiều cao 450 - 850px
        const w = 750 + Math.random() * 600;
        const h = 450 + Math.random() * 400;
        const circles = [];
        const numPuffs = 9 + Math.floor(Math.random() * 6);
        for (let j = 0; j < numPuffs; j++) {
          circles.push({
            dx: (Math.random() - 0.5) * w * 0.85,
            dy: (Math.random() - 0.5) * h * 0.75,
            r: 180 + Math.random() * 180, // Bán kính mỗi cụm mây to lớn từ 180px - 360px
          });
        }
        clouds.push({
          x: (Math.random() - 0.5) * 5000,
          y: (Math.random() - 0.5) * 5000,
          width: w,
          height: h,
          speedX: 18 + Math.random() * 12, // Trôi chầm chậm theo chiều gió
          speedY: 7 + Math.random() * 6,
          opacity: 0.10 + Math.random() * 0.04,
          circles,
        });
      }
      cloudShadowsRef.current = clouds;
    }

    // Khởi tạo mảng hạt mưa rỗng khi mới vào game (chỉ sinh hạt khi bắt đầu có mưa, tránh hạt mưa bị bay lơ lửng)
    weatherStateRef.current.rainDrops = [];
    weatherStateRef.current.rainSplashes = [];

    // 12. Mặt cỏ phẳng liền mạch (Flat Seamless Grass Surface) kèm các chi tiết ngọn cỏ bé tự nhiên (Small Pixel Grass Details)
    const generateFlatGrassTiles = () => {
      const halfW = 42;
      const halfH = 23;
      const pad = 2; // Chồng mí nhẹ 1px để mặt cỏ phẳng liền mạch không có đường kẻ ô
      const cw = (halfW + pad) * 2; // 88
      const ch = (halfH + pad) * 2; // 50
      const cx = cw / 2;
      const cy = ch / 2;

      const hash2D = (x: number, y: number, seed: number) => {
        let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
      };

      const buildFlatSet = (isWildZone: boolean) => {
        const variants: HTMLCanvasElement[] = [];

        const palette = isWildZone
          ? {
              base1: '#7e9f43',
              base2: '#78993f',
              speckDark: '#6e8e38',
              speckLight: '#8caf4e',
              bladeLight: '#9ec15c',
              bladeTip: '#b5d672',
              bladeShadow: '#648231',
            }
          : {
              base1: '#86a849',
              base2: '#81a345',
              speckDark: '#75963c',
              speckLight: '#94b854',
              bladeLight: '#a6c964',
              bladeTip: '#bde07b',
              bladeShadow: '#6b8b36',
            };

        for (let v = 0; v < 8; v++) {
          const oc = document.createElement('canvas');
          oc.width = cw;
          oc.height = ch;
          const octx = oc.getContext('2d');
          if (!octx) continue;
          octx.imageSmoothingEnabled = false;

          octx.save();
          // Cắt đúng hình thoi Isometric phẳng (mở rộng nhẹ 0.8px để nối khít thành 1 mặt phẳng duy nhất)
          octx.beginPath();
          octx.moveTo(cx, cy - halfH - 0.8);
          octx.lineTo(cx + halfW + 0.8, cy);
          octx.lineTo(cx, cy + halfH + 0.8);
          octx.lineTo(cx - halfW - 0.8, cy);
          octx.closePath();
          octx.clip();

          // 1. Nền cỏ phẳng mịn đồng nhất
          octx.fillStyle = v % 2 === 0 ? palette.base1 : palette.base2;
          octx.fillRect(0, 0, cw, ch);

          // 2. Các chấm vân cỏ cực nhỏ tạo chất liệu thảm cỏ tự nhiên
          for (let py = 2; py < ch - 2; py += 2) {
            for (let px = 2; px < cw - 2; px += 2) {
              const r = hash2D(px, py, v + 11);
              if (r > 0.86) {
                octx.fillStyle = palette.speckLight;
                octx.fillRect(px, py, 2, 1);
              } else if (r < 0.12) {
                octx.fillStyle = palette.speckDark;
                octx.fillRect(px, py, 2, 1);
              }
            }
          }

          // 3. Các chi tiết ngọn cỏ bé (Small delicate grass tufts: cao 2-3px, mảnh 1px) điểm xuyết vừa phải
          const tuftCount = 5 + (v % 3);
          for (let t = 0; t < tuftCount; t++) {
            const rx = (hash2D(t, v, 301) - 0.5) * (halfW * 1.1);
            const ry = (hash2D(t, v, 709) - 0.5) * (halfH * 1.1);
            // Giữ các bụi cỏ bé nằm gọn bên trong hình thoi
            if (Math.abs(rx) / halfW + Math.abs(ry) / halfH > 0.78) continue;

            const tx = Math.round(cx + rx);
            const ty = Math.round(cy + ry);
            const style = (t + v) % 3;

            // Bóng chân cỏ bé 1px
            octx.fillStyle = palette.bladeShadow;
            octx.fillRect(tx - 1, ty + 1, 3, 1);

            if (style === 0) {
              // Cụm 2 ngọn cỏ bé xinh
              octx.fillStyle = palette.bladeLight;
              octx.fillRect(tx - 1, ty - 1, 1, 2);
              octx.fillRect(tx + 1, ty - 2, 1, 3);
              octx.fillStyle = palette.bladeTip;
              octx.fillRect(tx + 1, ty - 2, 1, 1);
            } else if (style === 1) {
              // Cụm 3 cọng cỏ nhỏ xíu
              octx.fillStyle = palette.bladeLight;
              octx.fillRect(tx - 2, ty - 1, 1, 2);
              octx.fillRect(tx, ty - 2, 1, 3);
              octx.fillRect(tx + 2, ty - 1, 1, 2);
              octx.fillStyle = palette.bladeTip;
              octx.fillRect(tx, ty - 2, 1, 1);
            } else {
              // 1 ngọn cỏ non nhỏ gọn
              octx.fillStyle = palette.bladeLight;
              octx.fillRect(tx, ty - 1, 1, 2);
              octx.fillStyle = palette.bladeTip;
              octx.fillRect(tx, ty - 2, 1, 1);
            }
          }

          octx.restore();
          variants.push(oc);
        }
        return variants;
      };

      grassIsoTilesRef.current = {
        town: buildFlatSet(false),
        wild: buildFlatSet(true),
      };
      renderCachedMap();
    };
    generateFlatGrassTiles();
  }, [renderCachedMap]);

  useEffect(() => {
    // Hàm sinh chi tiết tán cây và cây hoàn chỉnh bằng Canvas 2D
    const createFoliageCanvas = (width: number, height: number, detailed: boolean, colorMode: 'darkest' | 'mid' | 'bright'): HTMLCanvasElement => {
      const oc = document.createElement('canvas');
      oc.width = width;
      oc.height = height;
      const octx = oc.getContext('2d')!;
      octx.imageSmoothingEnabled = false;

      let shadowColor = '';
      let baseColor = '';
      let lightColor = '';
      let trunkColor = '#5c3a21';
      let trunkShadowColor = '#2d190d';
      let trunkHighlightColor = '#8c5935';

      if (colorMode === 'darkest') {
        shadowColor = '#030802';
        baseColor = '#071204';
        lightColor = '#0f240a';
      } else if (colorMode === 'mid') {
        shadowColor = '#061304';
        baseColor = '#102a0a';
        lightColor = '#1c4d11';
      } else {
        shadowColor = '#102d08';
        baseColor = '#245a16';
        lightColor = '#419a28';
      }

      const cx = width / 2;
      const canopyY = detailed ? height * 0.42 : height * 0.50;

      // 1. Thân cây (Trunk) nếu chi tiết
      if (detailed) {
        const trunkW = 12;
        const trunkH = height * 0.48;
        const trunkX = cx - trunkW / 2;
        const trunkY = height - trunkH;

        // Outline gỗ
        octx.fillStyle = '#170e06';
        octx.fillRect(trunkX - 1.5, trunkY, trunkW + 3, trunkH);

        // Thân chính
        octx.fillStyle = trunkColor;
        octx.fillRect(trunkX, trunkY, trunkW, trunkH);

        // Shadow bên trái
        octx.fillStyle = trunkShadowColor;
        octx.fillRect(trunkX, trunkY, 4, trunkH);

        // Highlight bên phải
        octx.fillStyle = trunkHighlightColor;
        octx.fillRect(trunkX + trunkW - 3, trunkY, 3, trunkH);

        // Rễ cây xòe rộng
        octx.fillStyle = '#170e06';
        octx.fillRect(trunkX - 3, height - 4, 3, 4);
        octx.fillRect(trunkX + trunkW, height - 4, 3, 4);
        octx.fillStyle = trunkShadowColor;
        octx.fillRect(trunkX - 1.5, height - 3, 1.5, 3);
        octx.fillStyle = trunkHighlightColor;
        octx.fillRect(trunkX + trunkW, height - 3, 1.5, 3);
      }

      // 2. Tán lá cây (Foliage) xếp đè nhiều vòng tròn bóng đổ
      const blobs = [
        { dx: 0, dy: -14, r: 25 },
        { dx: -18, dy: 0, r: 19 },
        { dx: 18, dy: 0, r: 19 },
        { dx: -10, dy: -24, r: 17 },
        { dx: 10, dy: -24, r: 17 },
      ];

      // Outline đen viền tán
      octx.fillStyle = '#060c04';
      blobs.forEach(b => {
        octx.beginPath();
        octx.arc(cx + b.dx, canopyY + b.dy, b.r + 2, 0, Math.PI * 2);
        octx.fill();
      });

      // Lớp bóng tối sẫm
      octx.fillStyle = shadowColor;
      blobs.forEach(b => {
        octx.beginPath();
        octx.arc(cx + b.dx, canopyY + b.dy, b.r, 0, Math.PI * 2);
        octx.fill();
      });

      // Lớp màu chủ đạo (ánh sáng chếch từ phải qua trái)
      octx.fillStyle = baseColor;
      blobs.forEach(b => {
        octx.beginPath();
        octx.arc(cx + b.dx + 2.5, canopyY + b.dy - 2.5, b.r - 2.5, 0, Math.PI * 2);
        octx.fill();
      });

      // Lớp highlight sáng
      octx.fillStyle = lightColor;
      blobs.forEach(b => {
        octx.beginPath();
        octx.arc(cx + b.dx + 5, canopyY + b.dy - 5, b.r - 6, 0, Math.PI * 2);
        octx.fill();
      });

      // Điểm xuyết các điểm bixel lá cây tự nhiên nổi bật
      octx.fillStyle = lightColor;
      for (let i = 0; i < 30; i++) {
        const angle = i * 2.4;
        const dist = Math.abs(Math.sin(i * 1.7)) * 25;
        const rx = cx + Math.cos(angle) * dist;
        const ry = canopyY + Math.sin(angle) * dist - 8;
        octx.fillRect(Math.round(rx), Math.round(ry), 2, 2);
      }

      return oc;
    };

    // Tạo các biến thể cây
    canopyDarkestRef.current = createFoliageCanvas(80, 80, false, 'darkest');
    canopyMidRef.current = createFoliageCanvas(80, 80, false, 'mid');
    treeVariantRef.current = createFoliageCanvas(80, 95, true, 'bright');
  }, []);

  const floatingTextSeqRef = useRef<number>(0);

  // Helper: Spawn Floating Text (Bay ngẫu nhiên xung quanh kẻ địch, không chữ giải thích, cộng HP chỉ hiện số xanh)
  const spawnFloatingText = useCallback(
    (x: number, y: number, text: string, color: string, size = 14, italic = false) => {
      let cleanText = String(text);

      // Bỏ hoàn toàn số vàng bay lên / rơi ra (chỉ cộng thẳng vàng vào stats)
      const isGoldColor =
        color === '#facc15' ||
        color === '#eab308' ||
        color === '#fbbf24' ||
        color === '#ffd700' ||
        color === '#f59e0b' ||
        color === '#fde047' ||
        color === '#fef08a' ||
        color === '#d97706';

      const lowerText = cleanText.toLowerCase();
      const isGoldText = lowerText.includes('gold') || lowerText.includes('vàng') || (isGoldColor && /^\+?\d+$/.test(cleanText.trim()));

      if (isGoldText) {
        return;
      }

      const isHealing = color === '#22c55e' || color === '#10b981' || color === '#4ade80';
      const isWhiteTrueDamage = color === '#ffffff' || color === '#f8fafc';
      const isExpOrLevel =
        cleanText.includes('EXP') ||
        cleanText.includes('LEVEL') ||
        cleanText.includes('LV') ||
        cleanText.includes('Stats') ||
        color === '#38bdf8';

      if (isExpOrLevel) {
        // Giữ nguyên chuỗi hiển thị cho Kinh Nghiệm (+EXP) và Level Up
      } else if (isHealing || isWhiteTrueDamage) {
        // Hồi máu & Sát thương chuẩn: Chỉ hiện số nguyên
        const digits = cleanText.replace(/[^\d]/g, '');
        if (digits) cleanText = digits;
      } else {
        // Toàn bộ sát thương khác: Chỉ hiện số sát thương
        const digits = cleanText.replace(/[^\d]/g, '');
        if (digits) {
          cleanText = digits;
        } else {
          cleanText = cleanText
            .replace(/chí\s*mạng/gi, '')
            .replace(/critical/gi, '')
            .replace(/chuẩn/gi, '')
            .replace(/\+/gi, '')
            .replace(/hp/gi, '')
            .replace(/!/gi, '')
            .trim();
        }
      }

      if (!cleanText) return;

      // Các con số sát thương văng ra ngẫu nhiên (random offset) xung quanh vị trí mục tiêu tránh đè lên nhau
      const angle = Math.random() * Math.PI * 2;
      const dist = 14 + Math.random() * 26;
      const rx = Math.cos(angle) * dist;
      const ry = Math.sin(angle) * (dist * 0.7) - 10;

      floatingTextSeqRef.current++;
      floatingTextsRef.current.push({
        id: Math.random().toString(),
        text: cleanText,
        x: x + rx,
        y: y + ry,
        color,
        size,
        vy: -1.2,
        opacity: 1,
        duration: 0.9,
        elapsed: 0,
        italic,
        seq: floatingTextSeqRef.current,
      } as any);
    },
    []
  );

  // Helper: Spawn Damage Floating Text (Chỉ hiện số, KHÔNG hiển thị văn bản chú thích)
  const spawnDamageText = useCallback(
    (x: number, y: number, text: string, isMagic: boolean, isCrit: boolean, baseSize = 15) => {
      const numOnly = String(text).replace(/[^\d]/g, '');
      if (!numOnly) return;
      const color = isMagic ? '#a855f7' : '#ef4444';
      const size = isCrit ? Math.max(22, baseSize + 6) : baseSize;
      spawnFloatingText(x, y, numOnly, color, size, isCrit);
    },
    [spawnFloatingText]
  );

  // Helper: Add Screen Shake
  const addScreenShake = useCallback((amount: number) => {
    screenShakeRef.current.intensity = Math.max(screenShakeRef.current.intensity, amount);
  }, []);

  // Kích hoạt hiệu ứng chết: nhân vật bay ngửa ra sau và nằm ngửa
  const triggerPlayerDeath = useCallback(() => {
    if (deathStateRef.current.isDead) return;
    const p = playerRef.current;
    const backDir = p.facingRight ? -1 : 1;

    deathStateRef.current = {
      isDead: true,
      elapsed: 0,
      knockbackVx: backDir * 310, // Bay văng ngược ra phía sau lưng
      knockbackVy: -18,
      airHeight: 2,
      airVelZ: 215, // Hất tung lên không trung rồi rơi ngửa xuống đất
      bounced: false,
    };
    setIsPlayerDead(true);
    setRespawnCountdown(null);
    lastCountdownRef.current = null;

    p.isDashing = false;
    p.dashTimer = 0;
    isAttackHeldRef.current = false;
    isChargingRef.current = false;
    chargeProgressRef.current = 0;
    aimingSkillRef.current = null;
    setAimingSkillId(null);

    sounds.playExplosion();
    addScreenShake(8.5);
  }, [addScreenShake]);

  // Cơ chế 1 mạng (Hardcore Permadeath): Khi chết sẽ xóa toàn bộ đồ, kỹ năng, cấp độ, tiền tệ và mở bảng lập nhân vật mới từ đầu
  const handleHardcoreResetNewCharacter = useCallback(() => {
    deathStateRef.current = {
      isDead: false,
      elapsed: 0,
      knockbackVx: 0,
      knockbackVy: 0,
      airHeight: 0,
      airVelZ: 0,
      bounced: false,
    };
    setIsPlayerDead(false);
    setRespawnCountdown(null);
    lastCountdownRef.current = null;

    // Reset vị trí về làng và xóa sạch quái/đạn/vàng rơi trên sân
    const p = playerRef.current;
    p.x = 0;
    p.y = 0;
    p.vx = 0;
    p.vy = 0;
    p.isDashing = false;
    p.dashTimer = 0;
    p.shieldActive = false;
    p.shieldTimer = 0;
    p.fighterBuffActive = false;
    p.fighterBuffTimer = 0;
    p.fighterEnhanceActive = false;
    p.fighterEnhanceTimer = 0;
    p.fighterGuaranteedChargeTimer = 0;
    p.tankShieldHp = 0;
    p.tankShieldTimer = 0;
    p.mageBuffActive = false;
    p.mageBuffTimer = 0;
    p.assassinBuffActive = false;
    p.assassinBuffTimer = 0;
    p.marksmanBuffActive = false;
    p.marksmanBuffTimer = 0;
    p.marksmanStoneStacks = 0;

    enemiesRef.current = createInitialCombatBots();
    projectilesRef.current = [];
    slashesRef.current = [];
    goldGemsRef.current = [];
    waveRef.current = 1;
    setCurrentWaveDisplay(1);
    currentZoneRef.current = 'town';
    setCurrentZone('town');

    const emptyEquipped: EquippedItems = {
      helmet: null,
      armor: null,
      boots: null,
      mainWeapon: null,
      subWeapon: null,
      necklace: null,
      ring: null,
    };
    setEquipped(emptyEquipped);

    const resetAttrs: PlayerAttributes = {
      hpPoints: 0,
      mpPoints: 0,
      strPoints: 0,
      dexPoints: 0,
      intPoints: 0,
      defPoints: 0,
      crPoints: 0,
      cdPoints: 0,
      luckPoints: 0,
      atkSpeedPoints: 0,
      manaControlPoints: 0,
    };
    setAttributes(resetAttrs);

    const preset = CLASS_PRESETS[activeClass];
    setStats({
      classType: activeClass,
      level: 1,
      reincarnations: 0,
      currentExp: 0,
      maxExp: 100,
      statExp: 0,
      attributes: resetAttrs,
      equipped: emptyEquipped,
      defense: activeClass === 'Tank' ? 12 : 10,
      shieldHp: 0,
      currentHp: preset.maxHp,
      maxHp: preset.maxHp,
      currentMana: preset.maxMana || 50,
      maxMana: preset.maxMana || 50,
      manaControlLevel: 0,
      critChanceBonus: 0,
      critMultiplierBonus: 0,
      speedGrowthBonus: 0,
      baseDamage: preset.baseDamage,
      bonusDamage: 0,
      moveSpeed: preset.moveSpeed,
      gold: 0,
      redCurrency: 0,
      potions: 0,
      potionHealAmount: 60,
      potionCooldown: 3.0,
      lastPotionTime: 0,
      killCount: 0,
    });

    skill1CdRef.current = 0;
    skill2CdRef.current = 0;
    skill3CdRef.current = 0;
    setSkill1CdRemaining(0);
    setSkill2CdRemaining(0);
    setSkill3CdRemaining(0);

    // Xóa toàn bộ kỹ năng đã học, về lại từ đầu không có kỹ năng nào
    setSkillSystem(createInitialSkillSystem(activeClass));

    // Mở bảng tạo nhân vật mới
    setIsCharacterCustomOpen(true);
  }, [activeClass, createInitialSkillSystem]);

  // Helper: Spawn Cliff Impact Visuals (Puff of dust + Spray of tiny pixelated rock chips)
  const spawnCliffImpact = useCallback((x: number, y: number, normalX: number, normalY: number) => {
    // 1. Rock Chips: Mảnh vụn đá pixel sắc nhọn bắn ngược ra ngoài
    const chipColors = ['#94a3b8', '#64748b', '#475569', '#334155'];
    for (let i = 0; i < 8; i++) {
      const spread = (Math.random() - 0.5) * 1.6;
      const speed = Math.random() * 4.2 + 2.2;
      const vx = (normalX + spread * normalY) * speed;
      const vy = (normalY + spread * normalX) * speed;
      particlesRef.current.push({
        id: Math.random().toString(),
        x,
        y,
        vx,
        vy,
        color: chipColors[Math.floor(Math.random() * chipColors.length)],
        size: Math.random() * 3 + 2,
        alpha: 1,
        life: 0,
        maxLife: Math.random() * 0.4 + 0.3,
      });
    }

    // 2. Dust Cloud: Làn khói bụi mờ mịn pixel mở rộng khi va đập
    const dustColors = ['#f1f5f9', '#e2e8f0', '#cbd5e1'];
    for (let i = 0; i < 9; i++) {
      const angle = Math.atan2(normalY, normalX) + (Math.random() - 0.5) * 1.8;
      const speed = Math.random() * 2.5 + 0.8;
      particlesRef.current.push({
        id: Math.random().toString(),
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: dustColors[Math.floor(Math.random() * dustColors.length)],
        size: Math.random() * 5 + 3,
        alpha: 0.85,
        life: 0,
        maxLife: Math.random() * 0.45 + 0.35,
      });
    }
  }, []);

  // Helper: Spawn Particles từ Object Pool
  const spawnParticles = useCallback((x: number, y: number, color: string, count = 6, speed = 2.5) => {
    const safeCount = Math.min(count, 6);
    for (let i = 0; i < safeCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const vel = Math.random() * speed + 0.8;
      emitPooledParticle({
        x,
        y,
        vx: Math.cos(angle) * vel,
        vy: Math.sin(angle) * vel,
        color,
        size: Math.random() * 3 + 2,
        alpha: 1,
        life: 0,
        maxLife: Math.random() * 0.35 + 0.25,
      });
    }
  }, [emitPooledParticle]);

  // Helper: Hiệu ứng đập đất của Tank - bay lên các hạt đất đá từ Object Pool
  const spawnTankEarthSlamParticles = useCallback((x: number, y: number, intensity = 1.0) => {
    const earthColors = ['#78350f', '#92400e', '#a16207', '#854d0e', '#b45309', '#713f12', '#5c2e0b'];
    const stoneColors = ['#64748b', '#475569', '#334155', '#94a3b8', '#1e293b', '#cbd5e1'];

    const count = Math.min(10, Math.round(10 * intensity));

    for (let i = 0; i < count; i++) {
      const baseAngle = (i * Math.PI * 2) / count;
      const angle = baseAngle + (Math.random() - 0.5) * 0.16;
      const radialSpeed = (Math.random() * 2.8 + 2.0) * intensity;
      const liftUp = (Math.random() * 3.2 + 1.8) * intensity;
      const vx = Math.cos(angle) * radialSpeed;
      const vy = Math.sin(angle) * (radialSpeed * 0.55) - liftUp;

      const isRock = Math.random() < 0.45;
      const color = isRock
        ? stoneColors[Math.floor(Math.random() * stoneColors.length)]
        : earthColors[Math.floor(Math.random() * earthColors.length)];

      const size = isRock
        ? Math.random() * 2.8 + 2.2
        : Math.random() * 2.0 + 1.6;

      emitPooledParticle({
        x: x + Math.cos(angle) * (Math.random() * 8 + 4),
        y: y + Math.sin(angle) * (Math.random() * 4 + 2),
        vx,
        vy,
        color,
        size,
        alpha: 1,
        life: 0,
        maxLife: Math.random() * 0.35 + 0.35,
        gravity: 9.5,
        drag: 0.95,
      });
    }

    // Vòng bụi đất mờ bay là là mặt đất
    const dustCount = Math.min(4, Math.round(4 * intensity));
    for (let d = 0; d < dustCount; d++) {
      const dAngle = (d * Math.PI * 2) / dustCount;
      const dSpeed = (Math.random() * 1.8 + 0.8) * intensity;
      emitPooledParticle({
        x: x + Math.cos(dAngle) * 5,
        y: y + Math.sin(dAngle) * 3,
        vx: Math.cos(dAngle) * dSpeed,
        vy: Math.sin(dAngle) * (dSpeed * 0.5) - 0.5,
        color: d % 2 === 0 ? '#78350f' : '#64748b',
        size: Math.random() * 3.5 + 2.5,
        alpha: 0.55,
        life: 0,
        maxLife: Math.random() * 0.25 + 0.25,
        drag: 0.92,
      });
    }
  }, [emitPooledParticle]);

  // Helper: Hiệu ứng 2 vòng hạt lồng nhau tỏa ra MÀU TRẮNG TINH (Pure White Particles) khi Đấu Sĩ gồng full lực
  const spawnFighterDoubleParticleRings = useCallback((x: number, y: number) => {
    const innerCount = 14; // Vòng hạt bên trong
    const outerCount = 22; // Vòng hạt bên ngoài lồng nhau

    // 1. Vòng hạt bên trong (Inner Particle Ring - Tất cả màu trắng #ffffff)
    for (let i = 0; i < innerCount; i++) {
      const angle = (i / innerCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.12;
      const rInner = 14 + Math.random() * 4;
      const startX = x + Math.cos(angle) * rInner * 0.45; // Bẻ dẹp theo tỷ lệ
      const startY = y + Math.sin(angle) * rInner;
      const vel = 1.8 + Math.random() * 0.8;

      emitPooledParticle({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * vel * 0.45,
        vy: Math.sin(angle) * vel,
        color: '#ffffff',
        size: Math.random() * 2.5 + 2.2,
        alpha: 1,
        life: 0,
        maxLife: Math.random() * 0.22 + 0.18,
      });
    }

    // 2. Vòng hạt bên ngoài lồng nhau (Outer Particle Ring - Tất cả màu trắng #ffffff)
    for (let j = 0; j < outerCount; j++) {
      const angle = (j / outerCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.12;
      const rOuter = 28 + Math.random() * 6;
      const startX = x + Math.cos(angle) * rOuter * 0.45; // Bẻ dẹp theo tỷ lệ
      const startY = y + Math.sin(angle) * rOuter;
      const vel = 3.2 + Math.random() * 1.0;

      emitPooledParticle({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * vel * 0.45,
        vy: Math.sin(angle) * vel,
        color: '#ffffff',
        size: Math.random() * 2.5 + 2.0,
        alpha: 1,
        life: 0,
        maxLife: Math.random() * 0.28 + 0.22,
      });
    }
  }, [emitPooledParticle]);

  // Helper: Sinh các viên ngọc kinh nghiệm (EXP Orbs) văng ra trên mặt đất khi diệt quái
  const spawnExpOrbs = useCallback((x: number, y: number, totalExp: number) => {
    if (totalExp <= 0) return;
    const orbCount = Math.min(8, Math.max(2, Math.floor(totalExp / 10)));
    const expPerOrb = Math.max(1, Math.round(totalExp / orbCount));

    for (let i = 0; i < orbCount; i++) {
      const angle = (i / orbCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const speed = 50 + Math.random() * 85;
      goldGemsRef.current.push({
        id: `exp_orb_${Date.now()}_${Math.random()}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.6 - 25,
        value: expPerOrb,
        bounceHeight: 12 + Math.random() * 16,
        bounceSpeed: 8 + Math.random() * 6,
        createdTime: performance.now(),
        currencyType: 'exp',
      });
    }
  }, []);

  // Helper: Cộng kinh nghiệm (EXP) & Tự động tăng cấp (Level Up)
  const awardExp = useCallback((expAmount: number) => {
    if (expAmount <= 0) return;

    const p = playerRef.current;

    setStats((prev) => {
      if (prev.level >= 999) {
        return { ...prev, currentExp: 0 };
      }

      let nextExp = (prev.currentExp ?? 0) + expAmount;
      let nextStatExp = prev.statExp ?? 0;
      let nextLevel = prev.level;
      let nextMaxExp = prev.maxExp ?? 100;
      let nextMaxHp = prev.maxHp;
      let nextCurrentHp = prev.currentHp;
      let nextMaxMana = prev.maxMana;
      let nextCurrentMana = prev.currentMana;
      let nextBaseDamage = prev.baseDamage;
      let nextDefense = prev.defense || 10;
      let nextMoveSpeed = prev.moveSpeed;
      let nextCritChanceBonus = prev.critChanceBonus || 0;
      let nextCritMultiplierBonus = prev.critMultiplierBonus || 0;
      let nextSpeedGrowthBonus = prev.speedGrowthBonus || 0;
      let didLevelUp = false;
      let levelsGainedCount = 0;

      if (nextExp >= nextMaxExp) {
        didLevelUp = true;
        while (nextExp >= nextMaxExp && nextLevel < 999) {
          nextExp -= nextMaxExp;
          nextLevel += 1;
          levelsGainedCount += 1;
          nextStatExp += 20; // +20 điểm Stats mỗi lần lên cấp
          nextMaxExp = Math.round(nextMaxExp * 1.35);

          nextMaxHp += 5;
          nextMaxMana += 5;

          // Hồi 20% HP & MP khi lên cấp
          nextCurrentHp = Math.min(nextMaxHp, nextCurrentHp + Math.round(nextMaxHp * 0.2));
          nextCurrentMana = Math.min(nextMaxMana, nextCurrentMana + Math.round(nextMaxMana * 0.2));

          if (prev.classType === 'Fighter') {
            nextBaseDamage += 2;
          } else if (prev.classType === 'Tank') {
            nextDefense += 2;
          } else if (prev.classType === 'Assassin') {
            nextCritMultiplierBonus += 0.02;
            if (CLASS_PRESETS['Assassin'].critChance + nextCritChanceBonus < 1.0) {
              nextCritChanceBonus = Math.min(1.0 - CLASS_PRESETS['Assassin'].critChance, nextCritChanceBonus + 0.01);
            }
          } else if (prev.classType === 'Mage') {
            nextBaseDamage += 1;
          } else if (prev.classType === 'Marksman') {
            if (nextSpeedGrowthBonus < 50) {
              nextSpeedGrowthBonus = Math.min(50, nextSpeedGrowthBonus + 1);
              nextMoveSpeed += 1;
            }
            nextBaseDamage += 1;
            if (nextCritChanceBonus < 0.70) {
              nextCritChanceBonus = Math.min(0.70, nextCritChanceBonus + 0.01);
            }
            nextCritMultiplierBonus += 0.03;
          }
        }
      }

      if (didLevelUp) {
        sounds.playLevelUp?.();
        spawnParticles(p.x, p.y, '#facc15', 25, 4);
        spawnParticles(p.x, p.y, '#f59e0b', 16, 3);
        setSkillSystem((prevSys) => ({
          ...prevSys,
          skillPoints: prevSys.skillPoints + levelsGainedCount,
        }));
        setLevelUpNotification({
          id: Date.now(),
          oldLevel: prev.level,
          newLevel: nextLevel,
          statPointsGained: levelsGainedCount * 20,
          skillPointsGained: levelsGainedCount,
        });
      }

      return {
        ...prev,
        statExp: nextStatExp,
        level: nextLevel,
        currentExp: nextLevel >= 999 ? 0 : nextExp,
        maxExp: nextMaxExp,
        maxHp: nextMaxHp,
        currentHp: nextCurrentHp,
        maxMana: nextMaxMana,
        currentMana: nextCurrentMana,
        baseDamage: nextBaseDamage,
        defense: nextDefense,
        moveSpeed: nextMoveSpeed,
        critChanceBonus: nextCritChanceBonus,
        critMultiplierBonus: nextCritMultiplierBonus,
        speedGrowthBonus: nextSpeedGrowthBonus,
      };
    });
  }, [spawnFloatingText, spawnParticles]);

  // Helper: Ghi nhận sát thương gây ra cho Dấu Ấn Sát Thủ & Hình Nộm Test Sát Thương
  const recordEnemyHit = useCallback((enemy: Enemy, dmg: number) => {
    // Tích lũy sát thương cho Dấu Ấn Sát Thủ (Phi Tiêu Dấu Ấn - Chiêu 2)
    if (assassinMarksRef.current.has(enemy.id)) {
      const m = assassinMarksRef.current.get(enemy.id)!;
      m.accumulatedDamage += dmg;
    }

    if (enemy.isDummy || enemy.type === 'dummy') {
      const now = performance.now();
      enemy.totalDamageTaken = (enemy.totalDamageTaken || 0) + dmg;
      enemy.lastDamageTakenTime = now; // Mốc thời gian nhận đòn cuối cùng (để tự động Reset sau 10s)
      if (!enemy.recentDamageHistory) enemy.recentDamageHistory = [];
      enemy.recentDamageHistory.push({ time: now, damage: dmg });

      // Cơ chế rung lắc đàn hồi (elastic/spring recoil wobble) và chớp sáng khi bị đánh trúng
      enemy.wobbleTimer = 0.45;
      enemy.wobbleIntensity = Math.min(1.2, (enemy.wobbleIntensity || 0) + 0.4);
      enemy.hurtFlashTime = 0.18; // Chớp sáng nhẹ

      // Giữ lại lịch sử gây sát thương trong 3 giây gần nhất để tính DPS chính xác
      enemy.recentDamageHistory = enemy.recentDamageHistory.filter((item) => now - item.time <= 3000);
      const totalRecent = enemy.recentDamageHistory.reduce((sum, h) => sum + h.damage, 0);
      enemy.dps = Math.round(totalRecent / 3.0);

      // Hồi phục 100% máu ngay lập tức để nhân vật mục tiêu không bao giờ chết
      enemy.hp = enemy.maxHp;

      // Sinh ngọc EXP rơi ra khi luyện đánh nhân vật thử sát thương
      const dummyExp = Math.max(2, Math.round(dmg * 0.20));
      spawnExpOrbs(enemy.x, enemy.y, dummyExp);
    }
  }, [spawnExpOrbs]);

  // Helper: Nội tại Sát Thủ khi tích đủ 5 tầng của bản thân nhân vật sẽ đánh ra thêm 10% sát thương chuẩn từ sát thương vật lý gây ra
  const applyAssassinPassiveTrueDamage = useCallback(
    (enemy: Enemy, baseDamageDealt: number) => {
      if (statsRef.current.classType !== 'Assassin') return;
      
      // Lấy tầng tích lũy sát thủ của bản thân nhân vật
      const currentStacks = getActiveAssassinStacks();
      
      if (currentStacks >= 5 && baseDamageDealt > 0) {
        const pLvl = skillSystemRef.current.passiveLevels.Assassin || 0;
        const trueDmgRate = 0.10 + pLvl * 0.01; // 10% sát thương vật lý gây ra (+1% mỗi cấp kỹ năng nội tại)
        const trueDmg = Math.max(1, Math.round(baseDamageDealt * trueDmgRate));
        enemy.hp -= trueDmg;
        recordEnemyHit(enemy, trueDmg);
        enemy.hurtFlashTime = 0.18;

        // Sát thương chuẩn màu trắng, chỉ hiện số nguyên thuần túy (không kèm chữ hay dấu +)
        spawnFloatingText(enemy.x, enemy.y - 24, `${trueDmg}`, '#ffffff', 18, true);

        // Hiệu ứng tia sét và hạt trắng tím ma pháp khi kích nổ sát thương chuẩn nội tại
        spawnParticles(enemy.x, enemy.y, '#ffffff', 8, 2.2);
        spawnParticles(enemy.x, enemy.y, '#c084fc', 7, 1.8);
      }
    },
    [getActiveAssassinStacks, recordEnemyHit, spawnFloatingText, spawnParticles]
  );

  // Helper: Gọi / Đặt lại Nhân Vật Đầu Trọc Thử Sát Thương (Training Target Partner)
  const spawnTargetDummy = useCallback((customX?: number, customY?: number) => {
    const p = playerRef.current;
    const facingOffset = p.facingRight ? 130 : -130;
    const dummyX = customX ?? (p.x + facingOffset);
    const dummyY = customY ?? p.y;

    // Xóa nhân vật thử cũ nếu đã có
    enemiesRef.current = enemiesRef.current.filter((e) => e.type !== 'dummy');

    const dummyEnemy: Enemy = {
      id: `target_dummy_${Date.now()}`,
      type: 'dummy',
      name: '🎯 NHÂN VẬT THỬ SÁT THƯƠNG',
      x: dummyX,
      y: dummyY,
      vx: 0,
      vy: 0,
      radius: 22,
      hp: 999999,
      maxHp: 999999,
      speed: 0,
      damage: 0,
      color: '#d97706',
      goldDrop: 0,
      hurtFlashTime: 0,
      isDummy: true,
      totalDamageTaken: 0,
      dps: 0,
      recentDamageHistory: [],
      lastDamageTakenTime: performance.now(),
      wobbleTimer: 0,
      wobbleIntensity: 0,
    };

    enemiesRef.current.push(dummyEnemy);
    spawnFloatingText(dummyX, dummyY - 50, '🎯 Đã xuất hiện Nhân Vật Đầu Trọc (Test DPS & ST)!', '#fde047', 16, true);
  }, [spawnFloatingText]);

  // Execute Attack: Đòn đánh thường (Chỉ áp dụng đòn gồng khi tay không, không áp dụng đòn gồng khi cầm vũ khí của tất cả các class)
  const executeAttack = useCallback((rawChargeLevel = 0) => {
    if (deathStateRef.current.isDead || playerSpawnTimerRef.current > 0 || tankLeapRef.current.active) return;
    const preset = CLASS_PRESETS[activeClass];
    const now = performance.now();
    // Tốc đánh của Tank: 0.5s 1 đòn (interval = 500ms). Cộng thêm điểm nâng Tốc Đánh (ASPD: +5%/điểm) và buff Xạ Thủ (+70%)
    const aspdPoints = attributesRef.current.atkSpeedPoints || statsRef.current.attributes?.atkSpeedPoints || 0;
    const aspdStatMultiplier = 1 + aspdPoints * 0.05;
    let speedFactor = aspdStatMultiplier;
    if (activeClass === 'Marksman' && playerRef.current.marksmanBuffActive) {
      speedFactor *= 1.70 + Math.max(0, (skillSystemRef.current.skillLevels.Marksman_1 || 1) - 1) * 0.05; // +70% tốc đánh (+5%/cấp)
    }
    if (playerRef.current.fighterEnhanceActive) {
      const fEnhLvl = Math.max(1, skillSystemRef.current.skillLevels.Fighter_3 || 1);
      speedFactor *= 1.60 + (fEnhLvl - 1) * 0.06; // Chiêu 3 Đấu Sĩ: Cường hóa tăng mạnh tốc đánh
    }
    const interval = activeClass === 'Tank' ? 500 / speedFactor : (1000 / (preset.attackSpeed * speedFactor)) * 0.45;
    // Không áp dụng đòn gồng khi cầm vũ khí của tất cả các class.
    // Khi đang có hiệu ứng 5 giây kích hoạt 100% đòn gồng từ Chiêu 3 Đấu Sĩ (fighterGuaranteedChargeTimer > 0):
    // Mọi đòn đánh thường đều tự động biến thành đòn gồng full 100% (chargeLevel = 1.0) và chỉ tốn mana như đánh thường!
    const isGuaranteedFullChargeFromFighter3 =
      !hasSwordRef.current && playerRef.current.fighterGuaranteedChargeTimer > 0;
    const chargeLevel = hasSwordRef.current
      ? 0
      : isGuaranteedFullChargeFromFighter3
      ? 1.0
      : activeClass === 'Assassin'
      ? rawChargeLevel >= 1.0
        ? 1.0
        : 0
      : rawChargeLevel;
    const isCharged = chargeLevel > 0.35;

    if (now - lastAttackTimeRef.current < interval) return;

    // Cơ chế gồng lướt / lao xô đối thủ của Tank (kích hoạt sau 0.75s) và Sát Thủ (chỉ kích hoạt khi gồng full 100%)
    const isTankRamCharge = activeClass === 'Tank' && !hasSwordRef.current && chargeLevel > 0.05;
    const isAssassinRamCharge = activeClass === 'Assassin' && !hasSwordRef.current && chargeLevel >= 1.0;
    // Nếu đang trong 5s kích hoạt 100% đòn gồng của Chiêu 3 Đấu Sĩ thì chỉ tính mana như đánh thường để liên tục tung đòn gồng
    const isChargeAttack =
      !isGuaranteedFullChargeFromFighter3 &&
      (isTankRamCharge ||
        isAssassinRamCharge ||
        (activeClass !== 'Tank' && activeClass !== 'Assassin' && !hasSwordRef.current && isCharged));

    // Tiêu hao Mana theo % (giống thanh độ mệt mỏi):
    // - Mức độ kiểm soát mana (0 - 100 cấp): mỗi 1 cấp giảm bớt số % trừ đi, lên cấp 100 là không cộng thêm % trừ nào nữa
    const curStats = statsRef.current;
    const curAttrs = attributesRef.current;
    const curEquipped = equippedRef.current;
    const mcLevel = Math.min(100, Math.max(0, curStats.attributes?.manaControlPoints ?? curStats.manaControlLevel ?? 0));
    const penaltyReduction = 1.0 - (mcLevel / 100);

    let requiredMana = 0;
    if (activeClass === 'Mage') {
      // Pháp Sư: Tăng độ tốn mana để đầu game không thể spam chiêu và đánh thường liên tục
      if (isChargeAttack) {
        requiredMana = (curStats.maxMana * 25) / 100;
      } else {
        const currentStack = attackComboStackRef.current;
        const bonusPercent = currentStack * 2.5 * penaltyReduction;
        const totalPercent = 5.0 + bonusPercent;
        requiredMana = (curStats.maxMana * totalPercent) / 100;

        attackComboStackRef.current += 1;
        standingStillTimerRef.current = 0;
      }
    } else {
      // Các class khác (Đấu Sĩ, Đỡ Đòn, Sát Thủ, Xạ Thủ): Giảm độ tốn mana khi đánh thường & gồng cho hợp lý hơn
      if (isChargeAttack) {
        const chargePercent = activeClass === 'Marksman' ? 4 : 15;
        requiredMana = (curStats.maxMana * chargePercent) / 100;
      } else {
        // Đánh thường chỉ tốn 0.35% maxMana cơ bản, cộng dồn rất nhẹ 0.08% mỗi đòn (tối đa cộng thêm 0.8%)
        const currentStack = Math.min(10, attackComboStackRef.current);
        const bonusPercent = currentStack * 0.08 * penaltyReduction;
        const totalPercent = 0.35 + bonusPercent;
        requiredMana = (curStats.maxMana * totalPercent) / 100;

        attackComboStackRef.current = Math.min(10, attackComboStackRef.current + 1);
        standingStillTimerRef.current = 0;
      }
    }

    if (curStats.currentMana < requiredMana) {
      sounds.playNoMana?.();
      spawnFloatingText(playerRef.current.x, playerRef.current.y - 25, 'Không đủ Mana!', '#ef4444', 15);
      return;
    }

    statsRef.current = {
      ...curStats,
      currentMana: Math.max(0, curStats.currentMana - requiredMana),
    };
    setStats((prev) => ({
      ...prev,
      currentMana: Math.max(0, prev.currentMana - requiredMana),
    }));

    lastAttackTimeRef.current = now;

    const p = playerRef.current;

    // Cập nhật hướng quay về quái vật (nếu không trong thời gian lướt / 0.25s sau khi lướt)
    if (postDashNoLookTimerRef.current <= 0) {
      const priorityEnemy = getPriorityTarget();
      if (priorityEnemy) {
        currentTargetEnemyRef.current = priorityEnemy;
        p.facingRight = priorityEnemy.x >= p.x;
        p.angle = Math.atan2(priorityEnemy.y - p.y, priorityEnemy.x - p.x);
      }
    }

    const angle = p.angle;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    const combo = comboStepRef.current;
    comboStepRef.current = (comboStepRef.current + 1) % 2;

    let startAngle = 0;
    let endAngle = 0;
    let slashDirection: 'up' | 'down' = 'down';

    const currentStance = chargeStanceRef.current;
    if (currentStance === 'down') {
      startAngle = angle - Math.PI * 0.65;
      endAngle = angle + Math.PI * 0.65;
      slashDirection = 'down';
      chargeStanceRef.current = 'up';
    } else {
      startAngle = angle + Math.PI * 0.65;
      endAngle = angle - Math.PI * 0.65;
      slashDirection = 'up';
      chargeStanceRef.current = 'down';
    }

    let activePunchHand: 'right' | 'left' = chargeHandRef.current;
    let tankMode: 'normal_punch' | 'standing_slam' | 'ram_charge' = 'normal_punch';
    let strikeDuration = 0.14;
    const retractDuration = 0.40; // Thời gian rụt tay về khoảng 0.4s
    let swingDuration = strikeDuration + retractDuration;
    let tankAirDuration = 0;
    let tankMaxJumpH = 0;
    let tankJumpMeters = 0;

    let assassinStep = 0;
    let fighterStep = 0;
    let assassinHitStopDur = 0.03;

    if (activeClass === 'Tank') {
      if (isTankRamCharge) {
        // Chiêu gồng của Tank: Lao về phía trước húc đổ đối thủ (Battering Ram Charge)
        tankMode = 'ram_charge';
        strikeDuration = 0.32 + chargeLevel * 0.12;
        swingDuration = strikeDuration + 0.16;
      } else {
        // Bấm đánh thường: 1 trái -> 1 phải -> đòn thứ 3 đập 2 tay tại chỗ (có chút hạt trắng tỏa xung quanh, KHÔNG hạt nâu xám)
        const step3 = tankComboCountRef.current;
        tankComboCountRef.current = (step3 + 1) % 3;
        if (step3 === 0) {
          activePunchHand = 'right';
          chargeHandRef.current = 'left';
          tankMode = 'normal_punch';
          strikeDuration = 0.15;
          swingDuration = strikeDuration + 0.35; // Tổng 0.50s (0.15s tung đấm + 0.35s rụt về)
        } else if (step3 === 1) {
          activePunchHand = 'left';
          chargeHandRef.current = 'right';
          tankMode = 'normal_punch';
          strikeDuration = 0.15;
          swingDuration = strikeDuration + 0.35; // Tổng 0.50s (0.15s tung đấm + 0.35s rụt về)
        } else {
          tankMode = 'standing_slam';
          strikeDuration = 0.18;
          swingDuration = strikeDuration + 0.32; // Tổng 0.50s (0.18s đập đất + 0.32s rụt về)
          chargeHandRef.current = 'left';
        }
      }
    } else if (activeClass === 'Fighter' || activeClass === 'Mage' || activeClass === 'Marksman') {
      // Đấu sĩ, Pháp Sư & Xạ Thủ: Chuỗi 2 đòn đánh (Đòn 1 tay phải -> Đòn 2 tay trái) với thời gian rụt tay về khoảng 0.4s
      fighterStep = fighterComboCountRef.current;
      fighterComboCountRef.current = (fighterStep + 1) % 2;

      if (fighterStep === 0) {
        activePunchHand = 'right';
        chargeHandRef.current = 'left';
        strikeDuration = 0.14;
        swingDuration = strikeDuration + retractDuration; // Đòn 1 lúc chưa thêm đòn 2
      } else {
        activePunchHand = 'left';
        chargeHandRef.current = 'right';
        strikeDuration = 0.14;
        swingDuration = strikeDuration + retractDuration; // Đòn 2 mới thêm
      }
    } else if (activeClass === 'Assassin') {
      if (isAssassinRamCharge) {
        // Chiêu gồng của Sát Thủ: Lướt đi siêu nhanh như bóng ma xé gió
        tankMode = 'ram_charge';
        strikeDuration = 0.09 + chargeLevel * 0.03;
        swingDuration = strikeDuration + 0.06;
      } else {
        // Sát thủ: Giống Đấu Sĩ bình thường có đòn 1 (tay phải), đòn 2 (tay trái)
        assassinStep = assassinComboCountRef.current;
        assassinComboCountRef.current = (assassinStep + 1) % 2;

        if (assassinStep === 0) {
          activePunchHand = 'right';
          chargeHandRef.current = 'left';
          strikeDuration = 0.12;
          swingDuration = strikeDuration + retractDuration; // Đòn 1 lúc chưa thêm đòn 2
        } else {
          activePunchHand = 'left';
          chargeHandRef.current = 'right';
          strikeDuration = 0.12;
          swingDuration = strikeDuration + retractDuration; // Đòn 2 mới thêm
        }
      }
    } else {
      activePunchHand = chargeHandRef.current;
      chargeHandRef.current = activePunchHand === 'right' ? 'left' : 'right';
      strikeDuration = 0.12;
      swingDuration = strikeDuration + retractDuration; // 0.12s tung đòn + 0.40s rụt tay về
    }

    // Kích hoạt di chuyển từng bước:
    // - Đấu Sĩ, Sát Thủ, Đỡ Đòn: bước tấn dấn tới phía trước
    // - Pháp Sư & Xạ Thủ: Đòn 1 đứng yên, Đòn 2 (mới thêm) lùi ra sau một chút
    if (activeClass === 'Fighter' || (activeClass === 'Assassin' && tankMode !== 'ram_charge') || (activeClass === 'Tank' && tankMode !== 'ram_charge')) {
      const isTankAttack = activeClass === 'Tank';
      const stepDistance =
        activeClass === 'Assassin'
          ? 20 + chargeLevel * 8
          : activeClass === 'Fighter'
          ? 24 + chargeLevel * 12
          : tankMode === 'standing_slam'
          ? 24
          : 20;
      const stepDur =
        activeClass === 'Assassin'
          ? 0.22
          : activeClass === 'Fighter'
          ? 0.28 // Độ khựng đồng nhất 0.28s cho đòn 1 và 2
          : 0.20;
      const stepDelay = isTankAttack ? 0.03 : 0;

      attackStepMoveRef.current = {
        active: true,
        elapsed: 0,
        delay: stepDelay,
        duration: stepDur,
        dirX,
        dirY,
        stepDist: stepDistance,
      };
    } else if (activeClass === 'Mage' || activeClass === 'Marksman') {
      // Cả 2 đòn đánh của Pháp Sư và Xạ Thủ đều giật lùi ra sau dứt khoát để tạo cảm giác phản lực bắn chân thật
      attackStepMoveRef.current = {
        active: true,
        elapsed: 0,
        delay: 0,
        duration: 0.22,
        dirX: -dirX, // Lùi ra phía sau ngược hướng ngắm
        dirY: -dirY,
        stepDist: 18, // Giật lùi nhẹ nhàng dứt khoát
      };
    }

    // Phải gồng đủ full 100% (chargeLevel >= 1.0) mới tính là full lực
    const isFullCharge = !hasSwordRef.current && chargeLevel >= 1.0;

    swingAnimRef.current = {
      active: true,
      startTime: now,
      duration: swingDuration,
      strikeDuration,
      retractDuration,
      startAngle,
      endAngle,
      isCharged,
      chargeLevel,
      comboStep: activeClass === 'Assassin' ? assassinStep : (activeClass === 'Fighter' || activeClass === 'Mage' || activeClass === 'Marksman') ? fighterStep : combo,
      activeHand: activePunchHand,
      tankMode,
      hitStopDuration: assassinHitStopDur,
      hitStopTriggered: false,
      airDuration: tankAirDuration,
      maxJumpHeight: tankMaxJumpH,
      jumpMeters: tankJumpMeters,
    };

    // Tính toán sát thương:
    // - Đỡ Đòn (đã giảm sức mạnh): không còn cộng % Máu tối đa vào sát thương, chỉ tăng +5% sát thương mỗi mục tiêu trong phạm vi 5m (400px), tối đa 10 mục tiêu (+50%)
    let buffMult = p.battleCryActive ? 1.5 : 1.0;
    if (activeClass === 'Fighter' && p.fighterBuffActive) {
      buffMult *= 1.10; // Đấu sĩ buff dame +10%
    }
    const tankNearbyEnemies5m =
      activeClass === 'Tank'
        ? Math.min(10, enemiesRef.current.filter((e) => e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) <= 400).length)
        : 0;
    const tankCrowdBonusMult = 1 + tankNearbyEnemies5m * 0.05; // Mỗi kẻ địch trong 5m +5% sát thương (tối đa 10 mục tiêu)

    const baseClassDmg =
      activeClass === 'Tank'
        ? (curStats.baseDamage + curStats.bonusDamage) * tankCrowdBonusMult
        : curStats.baseDamage + curStats.bonusDamage;
    const rawDmg = baseClassDmg * buffMult;

    // Sát thương theo mức độ gồng lực (Đấu sĩ giảm hệ số gồng để đòn gồng dao động 90-150 thay vì >400)
    const chargeMultiplier =
      activeClass === 'Fighter'
        ? 1.0 + chargeLevel * 0.8
        : 1.0 + chargeLevel * 2.2;

    // Tầng nội tại Sát Thủ: tối đa 5 tầng (+5% CR/tầng = tối đa +25% CR). Tồn tại 3s, sau đó giảm dần từng tầng theo chu kỳ 3s
    const activeAssassinStacks = getActiveAssassinStacks();
    const assassinStackCritBonus = activeAssassinStacks * 0.05;

    // Tính toán chuẩn xác các chỉ số CR & CD
    const eqCrit = (curEquipped.mainWeapon?.critBonus || 0) + (curEquipped.ring?.critBonus || 0) + (curEquipped.necklace?.critBonus || 0) + (curEquipped.subWeapon?.critBonus || 0);
    const eqCritDmg = (curEquipped.mainWeapon?.critDmgBonus || 0) + (curEquipped.ring?.critDmgBonus || 0) + (curEquipped.subWeapon?.critDmgBonus || 0);

    // CR full tối đa 100% (2% cơ bản + nội tại tướng + tăng theo level + tiềm năng + trang bị + tầng nội tại Sát Thủ)
    let effectiveCritRate = Math.min(
      1.0,
      preset.critChance +
      (curStats.critChanceBonus || 0) +
      (curAttrs.dexPoints || 0) * 0.01 +
      (curAttrs.crPoints || 0) * 0.01 +
      eqCrit +
      assassinStackCritBonus
    );
    if (activeClass === 'Assassin' && p.assassinBuffActive) {
      effectiveCritRate = Math.min(1.0, effectiveCritRate + 0.30); // Sát thủ buff 30% chí mạng cộng dồn
    }

    // CD (Sát thương chí mạng: 1.7x gốc + nội tại tướng + tăng theo level + tiềm năng + trang bị)
    let effectiveCritDmg =
      preset.critMultiplier +
      (curStats.critMultiplierBonus || 0) +
      (curAttrs.cdPoints || 0) * 0.05 +
      eqCritDmg;
    if (activeClass === 'Assassin' && p.assassinBuffActive) {
      effectiveCritDmg += 0.50; // Sát thủ buff 50% sát thương chí mạng cộng dồn
    }

    let isCrit = (activeClass === 'Assassin' && isFullCharge) || Math.random() < effectiveCritRate;
    let finalDamage = Math.round(isCrit ? rawDmg * effectiveCritDmg * chargeMultiplier : rawDmg * chargeMultiplier);

    // Cân bằng đòn gồng của Sát Thủ (Charged Attack Balancing):
    // - Sát thương đòn gồng cơ bản (chưa chí mạng) dao động trong khoảng 400 - 950.
    // - Điều chỉnh sát thương chí mạng (Crit Damage): Giảm hệ số nhân chí mạng / Damage modifier của đòn gồng
    //   sao cho tổng sát thương trung bình ra thực tế sau khi nhân chí mạng chỉ nằm ở mức xung quanh 900 (thay vì 3000 như trước).
    if (activeClass === 'Assassin' && (isCharged || isFullCharge || isAssassinRamCharge)) {
      const chargeProg = Math.max(0, Math.min(1, (chargeLevel - 0.35) / 0.65));
      // Sát thương đòn gồng cơ bản (chưa chí mạng) dao động trong khoảng 400 - 950
      const baseCharged = Math.round(400 + chargeProg * 320 + (Math.random() - 0.5) * 40);
      if (isCrit) {
        // Điều chỉnh hệ số nhân chí mạng sao cho tổng sát thương trung bình thực tế sau chí mạng xung quanh 900
        const critTarget = 880 + chargeProg * 40 + (Math.random() - 0.5) * 30; // Dao động nhẹ 865 - 935, trung bình ~900
        finalDamage = Math.min(950, Math.max(400, Math.round(critTarget)));
      } else {
        finalDamage = Math.min(950, Math.max(400, baseCharged));
      }
    }

    if (activeClass === 'Fighter') {
      // Đấu sĩ: đấm ra màu trắng (thay cho màu vàng), đòn gồng cân bằng ở mức 90-150 sát thương
      sounds.playBasicAttack();
      addScreenShake(2.5 + chargeLevel * 4.0);

      // Đòn đánh gồng Đấu Sĩ: Gồng full lực 100% (chargeLevel >= 0.95) mới xuất hiện đòn lướt gồng uy lực
      const isFighterChargeLunge = chargeLevel >= 0.95;

      if (isFighterChargeLunge) {
        // Đòn đánh thường gồng của Đấu Sĩ:
        // - Sát thương gốc 200 (+ sát thương cộng thêm từ cấp độ/trang bị)
        // - Xuyên 80% giáp mục tiêu (80% Armor Penetration -> cộng thêm 25% sát thương xuyên phá trực tiếp vào máu mục tiêu)
        const fighterChargedBase = (200 + curStats.bonusDamage + Math.max(0, curStats.baseDamage - 50)) * buffMult;
        const armorPen80Multiplier = 1.25; // Xuyên 80% giáp
        const scaleByCharge = 0.75 + chargeLevel * 0.25; // Gồng full 100% đạt trọn vẹn sát thương gốc 200 + xuyên 80% giáp
        const rawChargedFighter = fighterChargedBase * scaleByCharge * armorPen80Multiplier;
        finalDamage = Math.round(isCrit ? rawChargedFighter * effectiveCritDmg : rawChargedFighter);
      }

      // Khi gồng full lực (100%): Hoạt ảnh lao người về trước mạnh mẽ
      if (isFighterChargeLunge) {
        const lungeSurge = 420 + chargeLevel * 280;
        p.vx += dirX * lungeSurge;
        p.vy += dirY * lungeSurge;

        // Kích hoạt hoạt ảnh lướt nhanh với các sọc tốc độ mỏng
        fighterLungeAnimRef.current = {
          active: true,
          startTime: performance.now(),
          duration: 0.28 + chargeLevel * 0.08,
          dirX,
          dirY,
          chargeLevel,
        };

        // Tâm điểm va chạm tại tay vung tới (xịch ra ngoài trục X +10px, nâng cao lên trục Y khoảng 9px => +8 - 9 = -1px)
        const handDist = (activePunchHand === 'right' ? 44 : 34) + chargeLevel * 10;
        const xDirectionSign = p.facingRight ? 1 : -1;
        const ringX = p.x + dirX * handDist + xDirectionSign * 10;
        const ringY = p.y + dirY * handDist - 1;

        // Bùng nổ 2 vòng hạt lồng nhau (Double Concentric Particle Rings) từ Object Pool thay thế hoàn toàn vòng tròn Canvas
        spawnFighterDoubleParticleRings(ringX, ringY);

        // Đã bỏ hoàn toàn các hạt đằng sau khi lướt theo đúng yêu cầu
      }

      const meleeReach = 72 + chargeLevel * 18;
      let hitAny = false;

      // Ưu tiên mục tiêu đã khóa hoặc mục tiêu gần nhất trước mặt
      const sortedFighterTargets = [...enemiesRef.current]
        .filter((e) => e.hp > 0)
        .sort((a, b) => {
          if (lockedTargetIdRef.current === a.id) return -1;
          if (lockedTargetIdRef.current === b.id) return 1;
          return Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y);
        });

      // Đòn đánh lan trong phạm vi hình quạt phía trước
      for (const enemy of sortedFighterTargets) {
        const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
        const edx = enemy.x - p.x;
        const edy = enemy.y - p.y;
        let enemyAngle = Math.atan2(edy, edx);
        let diff = Math.abs(enemyAngle - angle);
        while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);

        // Đòn 1-2 quét hình quạt phía trước (đánh lan)
        const isHitTarget = dist <= meleeReach + enemy.radius && (diff <= Math.PI * 0.52 || dist <= p.radius + enemy.radius + 12);

        if (isHitTarget) {
          hitAny = true;
          enemy.hp -= finalDamage;
          recordEnemyHit(enemy, finalDamage);
          enemy.hurtFlashTime = 0.18;
          sounds.playHit(isCrit);

          // Sát Thủ đánh trúng kẻ địch -> Tích tầng nội tại & đánh ra 10% sát thương chuẩn khi đủ 5 dấu ấn
          if (statsRef.current.classType === 'Assassin') {
            addAssassinStackOnHit();
            applyAssassinPassiveTrueDamage(enemy, finalDamage);
          }

          // Khóa mục tiêu trúng đòn trong phạm vi <= 5m (400px)
          if (!lockedTargetIdRef.current && dist <= 400) {
            lockedTargetIdRef.current = enemy.id;
            currentTargetEnemyRef.current = enemy;
          }

          // Gây đẩy lùi kẻ địch mạnh mẽ theo hướng đánh
          const knockAngle = angle;
          const knockForce = isFighterChargeLunge ? 520 + chargeLevel * 300 : 280;
          enemy.vx += Math.cos(knockAngle) * knockForce;
          enemy.vy += Math.sin(knockAngle) * knockForce;

          spawnDamageText(
            enemy.x,
            enemy.y,
            `${finalDamage}${isCrit ? '!' : ''}`,
            false,
            isCrit,
            isFullCharge ? 17 : chargeLevel > 0.35 ? 16 : 15
          );

          spawnParticles(enemy.x, enemy.y, '#ffffff', chargeLevel > 0.35 ? 12 : 6, 1.8);
        }
      }

      if (chargeLevel > 0.35 && hitAny) {
        sounds.playExplosion();
      }

      // Tọa độ bàn tay phía trước nhân vật luôn hướng theo góc đánh
      const handDist = (activePunchHand === 'right' ? 44 : 34) + chargeLevel * 10;
      const handWorldX = p.x + dirX * handDist;
      const handWorldY = p.y + dirY * handDist;

      // Đòn 1 & 2 thường (không gồng): hiệu ứng hạt trắng tỏa ra tròn ở tay đang đấm
      if (!isFighterChargeLunge) {
        const circleCount = 10;
        for (let i = 0; i < circleCount; i++) {
          const radAngle = (i * Math.PI * 2) / circleCount + (Math.random() - 0.5) * 0.12;
          const radialSpeed = (0.65 + Math.random() * 0.25) * 1.2;
          const startRadius = 3;
          particlesRef.current.push({
            id: Math.random().toString(),
            x: handWorldX + Math.cos(radAngle) * startRadius,
            y: handWorldY + Math.sin(radAngle) * startRadius,
            vx: Math.cos(radAngle) * radialSpeed,
            vy: Math.sin(radAngle) * radialSpeed,
            color: '#ffffff',
            size: Math.random() * 2.0 + 1.5,
            alpha: 1,
            life: 0,
            maxLife: 0.18,
            drag: 0.88,
          });
        }
      }
    } else if (activeClass === 'Tank') {
      if (tankMode === 'ram_charge') {
        // Đòn gồng của Đỡ Đòn: Lao về phía trước húc đổ đối thủ (Battering Ram Charge) - phát tiếng chiêu gồng kèm tiếng đánh thường
        // Thời gian gồng 6s để đạt max tầm 3m (240px)
        sounds.playBasicAttack();
        sounds.playChargedSkill();
        addScreenShake(6.5 + chargeLevel * 4.0);

        const targetDist = 60 + chargeLevel * (240 - 60); // Max 3m = 240px
        const ramDuration = 0.28 + chargeLevel * 0.12; // 0.28s - 0.40s
        const ramSpeed = targetDist / ramDuration;

        p.isDashing = true;
        p.dashTimer = ramDuration;
        p.dashVx = dirX * ramSpeed;
        p.dashVy = dirY * ramSpeed;
        p.vx = dirX * ramSpeed;
        p.vy = dirY * ramSpeed;
        postDashNoLookTimerRef.current = 0.25;
        lastDashAngleRef.current = angle;
        lastDashFacingRightRef.current = Math.cos(angle) >= 0;
        lastDashHandAngleRef.current = Math.max(-1.15, Math.min(1.15, Math.atan2(dirY, Math.abs(dirX))));

        // Đòn gồng của Đỡ Đòn (đã giảm sức mạnh): chỉ tăng +5% sát thương mỗi mục tiêu trong phạm vi 5m (400px), tối đa 10 mục tiêu
        const baseTankRamDmg = (35 + curStats.bonusDamage) * tankCrowdBonusMult * buffMult;
        const ramDmg = Math.round(isCrit ? baseTankRamDmg * effectiveCritDmg : baseTankRamDmg);

        tankRamRef.current = {
          active: true,
          elapsed: 0,
          duration: ramDuration,
          dirX,
          dirY,
          speed: ramSpeed,
          chargeLevel,
          damage: ramDmg,
          hitEnemyIds: new Set<string>(),
          afterimageTimer: 0,
          dustTimer: 0,
        };

        // Luồng không khí và bụi vút ngược ra sau lúc xuất chiêu (màu trắng)
        for (let w = 0; w < 24; w++) {
          const spreadAngle = Math.atan2(-dirY, -dirX) + (Math.random() - 0.5) * 0.8;
          const speed = Math.random() * 4.5 + 2.5;
          particlesRef.current.push({
            id: Math.random().toString(),
            x: p.x - dirX * 10 + (Math.random() - 0.5) * 16,
            y: p.y - dirY * 10 + 6 + (Math.random() - 0.5) * 10,
            vx: Math.cos(spreadAngle) * speed,
            vy: Math.sin(spreadAngle) * speed,
            color: '#ffffff',
            size: Math.random() * 3.5 + 2.0,
            alpha: 0.9,
            life: 0,
            maxLife: 0.30,
            drag: 0.88,
          });
        }
      } else if (tankMode === 'standing_slam') {
        // Đòn đánh thường thứ 3: Kích hoạt đòn đập 2 tay tại chỗ, KHÔNG nhảy
        const quakeRadius = 135;
        const quakeDmg = finalDamage;

        // Chấn động mặt đất khi 2 tay đập xuống tại chỗ (~150ms cho hoạt ảnh nhanh)
        setTimeout(() => {
          if (deathStateRef.current.isDead) return;
          const curP = playerRef.current;
          sounds.playTankSlam();
          addScreenShake(8.0);

          const slamImpactX = curP.x + Math.cos(curP.angle) * 16;
          const slamImpactY = curP.y + Math.sin(curP.angle) * 16;

          // Đòn đập đất lan tỏa AoE cho tất cả quái vật trong phạm vi
          enemiesRef.current.forEach((enemy) => {
            if (enemy.hp <= 0) return;
            const dist = Math.hypot(enemy.x - slamImpactX, enemy.y - slamImpactY);
            if (dist <= quakeRadius + enemy.radius) {
              enemy.hp -= quakeDmg;
              recordEnemyHit(enemy, quakeDmg);
              enemy.hurtFlashTime = 0.3;
              if (!lockedTargetIdRef.current && dist <= 400) {
                lockedTargetIdRef.current = enemy.id;
                currentTargetEnemyRef.current = enemy;
              }
              const kAngle = Math.atan2(enemy.y - slamImpactY, enemy.x - slamImpactX);
              enemy.vx += Math.cos(kAngle) * 350;
              enemy.vy += Math.sin(kAngle) * 350;
              sounds.playHit(isCrit);
              spawnDamageText(enemy.x, enemy.y, `${quakeDmg}${isCrit ? '!' : ''}`, false, isCrit, 16);
            }
          });
        }, 280);
      } else {
        // Đòn đánh thường 1 (Trái) và 2 (Phải) của Tank: giống Đấu Sĩ (đấm thẳng + hạt trắng tỏa tròn)
        sounds.playBasicAttack();
        addScreenShake(2.5);

        const meleeReach = 72;
        let hitAny = false;

        const sortedTankTargets = [...enemiesRef.current]
          .filter((e) => e.hp > 0)
          .sort((a, b) => {
            if (lockedTargetIdRef.current === a.id) return -1;
            if (lockedTargetIdRef.current === b.id) return 1;
            return Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y);
          });

        // Đòn đấm thường của Tank: quét lan tất cả kẻ địch trong tầm
        for (const enemy of sortedTankTargets) {
          const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
          const edx = enemy.x - p.x;
          const edy = enemy.y - p.y;
          let enemyAngle = Math.atan2(edy, edx);
          let diff = Math.abs(enemyAngle - angle);
          while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);

          if (dist <= meleeReach + enemy.radius && (diff <= Math.PI * 0.52 || dist <= p.radius + enemy.radius + 12)) {
            hitAny = true;
            enemy.hp -= finalDamage;
            recordEnemyHit(enemy, finalDamage);
            enemy.hurtFlashTime = 0.15;
            sounds.playHit(isCrit);

            // Khóa mục tiêu trúng đòn trong phạm vi <= 5m (400px)
            if (!lockedTargetIdRef.current && dist <= 400) {
              lockedTargetIdRef.current = enemy.id;
              currentTargetEnemyRef.current = enemy;
            }

            const knockForce = 280;
            enemy.vx += dirX * knockForce;
            enemy.vy += dirY * knockForce;

            spawnDamageText(
              enemy.x,
              enemy.y,
              `${finalDamage}${isCrit ? '!' : ''}`,
              false,
              isCrit,
              15
            );

            spawnParticles(enemy.x, enemy.y, '#ffffff', 6, 1.4);
          }
        }

        // Hiệu ứng hạt trắng tỏa ra tròn ở tay đang đấm (1 trái, 1 phải) giống Đấu Sĩ
        const flipX = p.facingRight ? 1 : -1;
        const handOffsetX = activePunchHand === 'right' ? 42 : 32;
        const handOffsetY = activePunchHand === 'right' ? -2 : -9;
        const handWorldX = p.x + handOffsetX * flipX;
        const handWorldY = p.y + handOffsetY;
        const circleCount = 10;
        for (let i = 0; i < circleCount; i++) {
          const radAngle = (i * Math.PI * 2) / circleCount + (Math.random() - 0.5) * 0.12;
          const radialSpeed = 0.65 + Math.random() * 0.25;
          const startRadius = 2.5;
          particlesRef.current.push({
            id: Math.random().toString(),
            x: handWorldX + Math.cos(radAngle) * startRadius,
            y: handWorldY + Math.sin(radAngle) * startRadius,
            vx: Math.cos(radAngle) * radialSpeed,
            vy: Math.sin(radAngle) * radialSpeed,
            color: '#ffffff',
            size: Math.random() * 2.0 + 1.5,
            alpha: 1,
            life: 0,
            maxLife: 0.2,
            drag: 0.88,
          });
        }
      }
    } else if (activeClass === 'Mage') {
      // Pháp sư: Đòn đánh thường và đòn gồng đều bắn ra CẦU ÁNH SÁNG kèm hiệu ứng hạt sáng tại bàn tay vừa tung đòn
      sounds.playBasicAttack();
      addScreenShake(isCharged ? 4 : 1.5);
      const flipX = p.facingRight ? 1 : -1;
      const handOffsetX = activePunchHand === 'right' ? 38 : 28;
      const handOffsetY = activePunchHand === 'right' ? -2 : -8;
      const spawnOrbX = p.x + dirX * 22 + handOffsetX * flipX * 0.15;
      const spawnOrbY = p.y + dirY * 22 + handOffsetY * 0.35;

      // Hiệu ứng hạt sáng trắng-vàng tỏa ra ở bàn tay khi Pháp Sư tung đòn đánh thường
      const castParticleCount = isCharged ? 14 : 8;
      for (let i = 0; i < castParticleCount; i++) {
        const radAngle = (i * Math.PI * 2) / castParticleCount + (Math.random() - 0.5) * 0.2;
        const radialSpeed = (0.8 + Math.random() * 0.6) * (1 + chargeLevel * 1.4);
        particlesRef.current.push({
          id: Math.random().toString(),
          x: spawnOrbX + Math.cos(radAngle) * 3,
          y: spawnOrbY + Math.sin(radAngle) * 3,
          vx: Math.cos(radAngle) * radialSpeed + dirX * 1.2,
          vy: Math.sin(radAngle) * radialSpeed + dirY * 1.2,
          color: i % 2 === 0 ? '#ffffff' : '#fef08a',
          size: Math.random() * 2.2 + 1.5,
          alpha: 0.95,
          life: 0,
          maxLife: 0.22,
          drag: 0.88,
        });
      }

      projectilesRef.current.push({
        id: Math.random().toString(),
        source: 'player',
        x: spawnOrbX,
        y: spawnOrbY,
        vx: dirX * (isCharged ? 580 : 480),
        vy: dirY * (isCharged ? 580 : 480),
        radius: isCharged ? 15 : 9,
        damage: finalDamage,
        isCrit,
        color: '#ffffff',
        trailColor: '#fef08a',
        pierce: 1, // KHÔNG xuyên thấu (nổ và biến mất ngay khi chạm mục tiêu đầu tiên)
        maxLifetime: 1.5,
        age: 0,
        isAoe: true,
        aoeRadius: isCharged ? 95 : 55,
        projectileType: 'light_orb',
      });
    } else if (activeClass === 'Marksman') {
      // Xạ thủ: Đánh thường dạng áp sát 40 ST, ném ra được đá 70 ST
      sounds.playBasicAttack();
      const punchReach = 48 + chargeLevel * 14;
      let hitAny = false;
      const sortedMarksmanTargets = [...enemiesRef.current]
        .filter((e) => e.hp > 0)
        .sort((a, b) => {
          if (lockedTargetIdRef.current === a.id) return -1;
          if (lockedTargetIdRef.current === b.id) return 1;
          return Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y);
        });

      // Sát thương cận chiến áp sát (gốc 40)
      const punchRaw = (40 + curStats.bonusDamage) * buffMult;
      const punchDmg = Math.round(isCrit ? punchRaw * effectiveCritDmg * chargeMultiplier : punchRaw * chargeMultiplier);

      // Đòn cận chiến của Xạ Thủ: đánh lan các kẻ địch trước mặt
      for (const enemy of sortedMarksmanTargets) {
        const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
        const edx = enemy.x - p.x;
        const edy = enemy.y - p.y;
        let enemyAngle = Math.atan2(edy, edx);
        let diff = Math.abs(enemyAngle - angle);
        while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);

        if (dist <= punchReach + enemy.radius && (diff <= Math.PI * 0.52 || dist <= p.radius + enemy.radius + 10)) {
          hitAny = true;
          enemy.hp -= punchDmg;
          recordEnemyHit(enemy, punchDmg);
          enemy.hurtFlashTime = 0.15;
          sounds.playHit(isCrit);

          // Khóa mục tiêu trúng đòn trong phạm vi <= 5m (400px)
          if (!lockedTargetIdRef.current && dist <= 400) {
            lockedTargetIdRef.current = enemy.id;
            currentTargetEnemyRef.current = enemy;
          }

          const knockForce = isFullCharge ? 420 : 180 + chargeLevel * 90;
          enemy.vx += dirX * knockForce;
          enemy.vy += dirY * knockForce;
          if (isFullCharge) {
            enemy.x += dirX * 70;
            enemy.y += dirY * 70;
          }
          spawnDamageText(enemy.x, enemy.y, `${punchDmg}${isCrit ? '!' : ''}`, false, isCrit, 15);
          spawnParticles(enemy.x, enemy.y, '#f8fafc', 5, 2.0);
        }
      }
      if (hitAny) {
        addScreenShake(2.0 + chargeLevel * 2.0);
      }

      // Sát thương ném đá / bắn xa (gốc 70; nếu gồng full lực: gây sát thương gốc + 100% sát thương gốc cộng thêm = 2.0x sát thương gốc)
      const stoneRaw = (70 + curStats.bonusDamage) * buffMult;
      const stoneChargeFactor = isFullCharge ? 2.0 : 1.0 + chargeLevel * 1.0;
      const stoneDmg = Math.round(isCrit ? stoneRaw * effectiveCritDmg * stoneChargeFactor : stoneRaw * stoneChargeFactor);

      // 20% tỉ lệ ném ra đá (viên xám có trọng lực) - Hoặc 10 đòn tiếp theo 100% ném ra đá khi bật Buff Xạ Thủ
      const guaranteedStoneFromBuff = (p.marksmanStoneStacks || 0) > 0;
      if (guaranteedStoneFromBuff || Math.random() < 0.2) {
        if (guaranteedStoneFromBuff) {
          p.marksmanStoneStacks = Math.max(0, (p.marksmanStoneStacks || 0) - 1);
        }
        sounds.playShoot();
        if (isFullCharge) {
          sounds.playHeavySlash();
          addScreenShake(4.5);
        }
        // Đá ném đi nhanh hơn, xa hơn; khi full lực KHÔNG tăng kích thước mà bay siêu nhanh tạo sóng xung kích
        const stoneSpeed = isFullCharge ? 1550 : isCharged ? 1050 : 880;
        const stoneLifetime = isFullCharge ? 0.36 : 0.62;
        const targetEnemy = currentTargetEnemyRef.current;
        let stoneDirX = dirX;
        let stoneDirY = dirY;
        if (targetEnemy && targetEnemy.hp > 0) {
          const tdx = targetEnemy.x - (p.x + dirX * 20);
          const tdy = targetEnemy.y - (p.y + dirY * 20);
          const tLen = Math.hypot(tdx, tdy);
          if (tLen > 1) {
            stoneDirX = tdx / tLen;
            stoneDirY = tdy / tLen;
          }
        }
        const spawnX = p.x + dirX * 20;
        const spawnY = p.y + dirY * 20;

        // Sóng xung kích bung ra khi ném viên đá full lực siêu thanh:
        // Tạo 3 vòng tròn hạt trắng hiển thị dọc (vuông góc với hướng ném), tỏa ra theo đường bay và biến mất dần để tạo độ uy lực cực mạnh cho cú ném
        if (isFullCharge) {
          const shockAngle = Math.atan2(stoneDirY, stoneDirX);
          const perpX = -Math.sin(shockAngle);
          const perpY = Math.cos(shockAngle);

          // 3 vòng tròn hạt trắng dọc (Vertical White Particle Rings) xếp nối tiếp dọc theo quỹ đạo cú ném từ vòng TO đến BÉ
          const ringDistances = [16, 52, 92];
          const ringRadii = [1.56, 1.24, 0.92];
          const ringLifetimes = [0.38, 0.34, 0.30];
          const particlesPerRing = 22;

          for (let rIdx = 0; rIdx < 3; rIdx++) {
            const distOffset = ringDistances[rIdx];
            const scaleR = ringRadii[rIdx];
            const lifeDur = ringLifetimes[rIdx];
            const ringCenterX = spawnX + stoneDirX * distOffset;
            const ringCenterY = spawnY + stoneDirY * distOffset;

            for (let s = 0; s < particlesPerRing; s++) {
              const theta = (s / particlesPerRing) * Math.PI * 2;
              // Hiển thị dọc (nén nhẹ theo chiều bay tạo hình elip đứng vuông góc hướng ném, mở rộng mạnh theo phương dọc/vuông góc)
              const radialVertical = Math.sin(theta) * 3.8 * scaleR;
              const axialThickness = Math.cos(theta) * 1.05 * scaleR;
              const startOffsetVert = Math.sin(theta) * (5.5 * scaleR);
              const startOffsetAxial = Math.cos(theta) * (1.8 * scaleR);

              particlesRef.current.push({
                id: Math.random().toString(),
                x: ringCenterX + perpX * startOffsetVert + stoneDirX * startOffsetAxial,
                y: ringCenterY + perpY * startOffsetVert + stoneDirY * startOffsetAxial,
                vx: perpX * radialVertical + stoneDirX * (axialThickness + 0.6),
                vy: perpY * radialVertical + stoneDirY * (axialThickness + 0.6),
                color: '#ffffff',
                size: (2.4 - rIdx * 0.25) + (s % 2) * 0.35,
                alpha: 1.0,
                life: 0,
                maxLife: lifeDur,
                drag: 0.90,
              });
            }
          }
        }

        projectilesRef.current.push({
          id: Math.random().toString(),
          source: 'player',
          x: spawnX,
          y: spawnY,
          vx: stoneDirX * stoneSpeed,
          vy: stoneDirY * stoneSpeed,
          radius: 7.0, // Không tăng kích thước kể cả khi gồng full lực
          damage: stoneDmg,
          isCrit,
          color: '#94a3b8',
          trailColor: isFullCharge ? '#f8fafc' : '#64748b',
          pierce: 1,
          maxLifetime: stoneLifetime,
          age: 0,
          projectileType: 'stone',
          isFullChargeStone: isFullCharge,
          maxRange: isFullCharge ? 560 : 540,
          knockbackDist: isFullCharge ? 70 : 0,
        } as any);
      }
    } else if (activeClass === 'Assassin') {
      if (isAssassinRamCharge) {
        // Đòn gồng của Sát Thủ: Lướt đi siêu nhanh (Lightning Shadow Blitz) - phát tiếng chiêu gồng kèm tiếng đánh thường
        sounds.playBasicAttack();
        sounds.playChargedSkill();
        addScreenShake(6.5 + chargeLevel * 4.0);

        // Khoảng cách lướt 120px đến 360px trong tích tắc 0.075s - 0.11s (vận tốc ~1800 - 3200 px/s lướt siêu tốc)
        const targetDist = 120 + chargeLevel * 240;
        const ramDuration = 0.075 + chargeLevel * 0.035;
        const ramSpeed = targetDist / ramDuration;

        p.isDashing = true;
        p.dashTimer = ramDuration;
        p.dashVx = dirX * ramSpeed;
        p.dashVy = dirY * ramSpeed;
        p.vx = dirX * ramSpeed;
        p.vy = dirY * ramSpeed;
        postDashNoLookTimerRef.current = 0.25;
        lastDashAngleRef.current = angle;
        lastDashFacingRightRef.current = Math.cos(angle) >= 0;
        lastDashHandAngleRef.current = Math.max(-1.15, Math.min(1.15, Math.atan2(dirY, Math.abs(dirX))));

        const ramDmg = finalDamage;

        tankRamRef.current = {
          active: true,
          elapsed: 0,
          duration: ramDuration,
          dirX,
          dirY,
          speed: ramSpeed,
          chargeLevel,
          damage: ramDmg,
          hitEnemyIds: new Set<string>(),
          afterimageTimer: 0,
          dustTimer: 0,
        };

        // Kèm theo 1 hiệu ứng đánh thường của Sát Thủ nhưng dài hơn (vươn dài dọc đường lao)
        assassinChevronRef.current[activePunchHand] = {
          active: true,
          chargeLevel: Math.max(chargeLevel, 1.2),
          isExtendedRush: true,
          startTime: now,
          duration: ramDuration + 0.20,
        };

        // Luồng không khí, vệt kiếm và tàn ảnh vút ra sau lúc xuất chiêu siêu tốc
        for (let w = 0; w < 30; w++) {
          const spreadAngle = Math.atan2(-dirY, -dirX) + (Math.random() - 0.5) * 0.6;
          const speed = Math.random() * 8.0 + 4.5;
          particlesRef.current.push({
            id: Math.random().toString(),
            x: p.x - dirX * 12 + (Math.random() - 0.5) * 14,
            y: p.y - dirY * 12 + 6 + (Math.random() - 0.5) * 10,
            vx: Math.cos(spreadAngle) * speed,
            vy: Math.sin(spreadAngle) * speed,
            color: w % 2 === 0 ? '#c084fc' : '#ffffff',
            size: Math.random() * 3.5 + 2.0,
            alpha: 0.95,
            life: 0,
            maxLife: 0.22,
          });
        }
      } else {
        // Sát thủ đánh thường tại chỗ luân phiên 2 tay
        assassinChevronRef.current[activePunchHand] = {
          active: true,
          chargeLevel,
          isExtendedRush: false,
          startTime: now,
          duration: 0.44 + chargeLevel * 0.14,
        };
        sounds.playBasicAttack();
        if (isCharged || isFullCharge) {
          sounds.playChargedSkill();
        }
        addScreenShake(2.0 + chargeLevel * 3.5);

        const flipX = p.facingRight ? 1 : -1;
        const punchBackwardAngle = p.facingRight ? Math.PI : 0;
        const handOffsetX = activePunchHand === 'right' ? 28 : 18;
        const handOffsetY = activePunchHand === 'right' ? -2 : -9;
        const handWorldX = p.x + handOffsetX * flipX;
        const handWorldY = p.y + handOffsetY;

        // Càng gồng mạnh: số lượng hạt trắng nhiều hơn (từ 6 lên tới 24 hạt) và góc tỏa ra sau rộng hơn
        const burstCount = Math.round(6 + chargeLevel * 18);
        const backwardSpread = 0.45 + chargeLevel * 0.8;
        for (let i = 0; i < burstCount; i++) {
          const spread = (Math.random() - 0.5) * backwardSpread;
          const speed = (Math.random() * 2.4 + 1.5) * (1 + chargeLevel * 0.55);
          particlesRef.current.push({
            id: Math.random().toString(),
            x: handWorldX + (Math.random() - 0.5) * (3 + chargeLevel * 4),
            y: handWorldY + (Math.random() - 0.5) * (3 + chargeLevel * 4),
            vx: Math.cos(punchBackwardAngle + spread) * speed,
            vy: Math.sin(punchBackwardAngle + spread) * speed,
            color: '#ffffff',
            size: Math.random() * (2.6 + chargeLevel * 1.4) + 1.6,
            alpha: 1,
            life: 0,
            maxLife: Math.random() * 0.24 + 0.18 + chargeLevel * 0.08,
          });
        }

        // Sát thương đòn đấm của Sát Thủ (đã cân bằng đòn gồng chuẩn xác theo finalDamage)
        const assassinDmg = finalDamage;

        slashesRef.current.push({
          id: Math.random().toString(),
          x: p.x + dirX * (24 + chargeLevel * 14),
          y: p.y + dirY * (24 + chargeLevel * 14),
          angle,
          arc: isCharged ? Math.PI * 0.8 : Math.PI * 0.45,
          radius: 55 + chargeLevel * 38,
          damage: assassinDmg,
          isCrit: isFullCharge || isCrit,
          color: '#ffffff',
          duration: 0.28,
          elapsed: 0,
          hitEnemyIds: new Set(),
          direction: slashDirection,
        });
      }
    }
  }, [activeClass, addScreenShake, spawnFloatingText, spawnDamageText, spawnParticles, getPriorityTarget]);

  // Thực thi 1 Kỹ Năng cụ thể theo SkillNodeId (không cần cầm vũ khí vẫn học & dùng được mọi kỹ năng)
  const executeSingleSkillNode = useCallback(
    (nodeId: SkillNodeId, customAngle?: number) => {
      const p = playerRef.current;
      if (deathStateRef.current.isDead) return;

      const curSkillSys = skillSystemRef.current;
      const skillLvl = Math.max(1, curSkillSys.skillLevels[nodeId] || 1);
      const lvlBonusMult = 1 + (skillLvl - 1) * 0.10; // Mỗi cấp kỹ năng tăng 10% sát thương/hiệu lực

      if (customAngle === undefined) {
        const priorityEnemy = getPriorityTarget();
        if (priorityEnemy) {
          currentTargetEnemyRef.current = priorityEnemy;
          p.facingRight = priorityEnemy.x >= p.x;
          p.angle = Math.atan2(priorityEnemy.y - p.y, priorityEnemy.x - p.x);
        }
      }
      const angle = customAngle !== undefined ? customAngle : p.angle;
      p.angle = angle;
      p.facingRight = Math.cos(angle) >= 0;
      const dirX = Math.cos(angle);
      const dirY = Math.sin(angle);

      const curStats = statsRef.current;
      const curAttr = attributesRef.current;
      const curEq = equippedRef.current;
      const preset = CLASS_PRESETS[activeClass];

      let rawAtk = (curStats.baseDamage + curStats.bonusDamage) * lvlBonusMult;
      if (p.fighterBuffActive) {
        const fBuffLvl = Math.max(1, curSkillSys.skillLevels.Fighter_1 || 1);
        rawAtk *= 1.2 + (fBuffLvl - 1) * 0.04;
      }

      // Cộng dồn nội tại chí mạng từ Sát Thủ & Xạ Thủ nếu đã lĩnh ngộ (không cần đổi class)
      const unlocked = curSkillSys.unlockedClasses;
      const pLvls = curSkillSys.passiveLevels;
      const assassinPassiveCrit = unlocked.includes('Assassin') ? 0.20 + (pLvls.Assassin || 0) * 0.02 : 0;
      const assassinPassiveCritDmg = unlocked.includes('Assassin') ? 1.50 + (pLvls.Assassin || 0) * 0.12 : 0;
      const marksmanPassiveCrit = unlocked.includes('Marksman') ? 0.10 + (pLvls.Marksman || 0) * 0.02 : 0;

      const eqCrit =
        (curEq.mainWeapon?.critBonus || 0) +
        (curEq.ring?.critBonus || 0) +
        (curEq.necklace?.critBonus || 0) +
        (curEq.subWeapon?.critBonus || 0);
      const eqCritDmg =
        (curEq.mainWeapon?.critDmgBonus || 0) +
        (curEq.ring?.critDmgBonus || 0) +
        (curEq.subWeapon?.critDmgBonus || 0);

      let skillCritRate = Math.min(
        1.0,
        0.02 +
          assassinPassiveCrit +
          marksmanPassiveCrit +
          (curStats.critChanceBonus || 0) +
          (curAttr.dexPoints || 0) * 0.01 +
          (curAttr.crPoints || 0) * 0.01 +
          eqCrit
      );
      if (p.assassinBuffActive) {
        const aBuffLvl = Math.max(1, curSkillSys.skillLevels.Assassin_1 || 1);
        skillCritRate = Math.min(1.0, skillCritRate + 0.30 + (aBuffLvl - 1) * 0.02);
      }

      let skillCritMult =
        1.7 +
        assassinPassiveCritDmg +
        (curStats.critMultiplierBonus || 0) +
        (curAttr.cdPoints || 0) * 0.05 +
        eqCritDmg;
      if (p.assassinBuffActive) {
        const aBuffLvl = Math.max(1, curSkillSys.skillLevels.Assassin_1 || 1);
        skillCritMult += 0.50 + (aBuffLvl - 1) * 0.05;
      }

      // ================= 1. ĐẤU SĨ (FIGHTER) =================
      if (nodeId === 'Fighter_1') {
        // Chiêu 1: Buff Damage
        sounds.playShield?.();
        p.fighterBuffActive = true;
        p.fighterBuffTimer = 10.0 + (skillLvl - 1) * 0.5;
        spawnParticles(p.x, p.y, '#ef4444', 24, 4.0);
        spawnFloatingText(p.x, p.y - 28, `CHIẾN BINH NỘ CẤP ${skillLvl}!`, '#ef4444', 14);
      } else if (nodeId === 'Fighter_2') {
        // Chiêu 2: Quay 1 vòng chém xung quanh 360 độ
        sounds.playHeavySlash();
        addScreenShake(5.5);
        const spinRadius = 115 + skillLvl * 4;
        const spinDmg = Math.round(rawAtk * 2.1);

        slashesRef.current.push({
          id: Math.random().toString(),
          x: p.x,
          y: p.y,
          angle,
          arc: Math.PI * 2,
          radius: spinRadius,
          damage: 0,
          isCrit: false,
          color: '#f97316',
          duration: 0.28,
          elapsed: 0,
          hitEnemyIds: new Set(),
        });

        enemiesRef.current.forEach((enemy) => {
          if (enemy.hp <= 0) return;
          const d = Math.hypot(enemy.x - p.x, enemy.y - p.y);
          if (d <= spinRadius + enemy.radius) {
            const isCrit = Math.random() < skillCritRate;
            const appliedDmg = isCrit ? Math.round(spinDmg * skillCritMult) : spinDmg;
            enemy.hp -= appliedDmg;
            recordEnemyHit(enemy, appliedDmg);
            enemy.hurtFlashTime = 0.2;
            const kAngle = Math.atan2(enemy.y - p.y, enemy.x - p.x);
            enemy.vx += Math.cos(kAngle) * 380;
            enemy.vy += Math.sin(kAngle) * 380;
            spawnDamageText(enemy.x, enemy.y, `${appliedDmg}${isCrit ? '!' : ''}`, false, isCrit, 16);
          }
        });
        spawnParticles(p.x, p.y, '#f97316', 26, 4.5);
        spawnParticles(p.x, p.y, '#ffffff', 14, 3.5);
      } else if (nodeId === 'Fighter_3') {
        // Chiêu 3: Cường hóa (Tăng tốc đánh, tốc độ hồi phục HP & Mana + Kích hoạt 100% đòn gồng trong 5s)
        sounds.playShield?.();
        p.fighterEnhanceActive = true;
        p.fighterEnhanceTimer = 8.0 + (skillLvl - 1) * 0.5;
        p.fighterGuaranteedChargeTimer = 5.0; // Kích hoạt 100% đòn gồng trong 5 giây
        spawnParticles(p.x, p.y, '#dc2626', 28, 4.5);
        spawnParticles(p.x, p.y, '#fde047', 16, 3.5);
        spawnFloatingText(p.x, p.y - 28, 'CƯỜNG HÓA + 100% ĐÒN GỒNG (5S)!', '#facc15', 14);
      }

      // ================= 2. ĐỠ ĐÒN (TANK) =================
      else if (nodeId === 'Tank_1') {
        // Chiêu 1: Buff Giáp ảo như hiện tại
        sounds.playShield?.();
        const shieldRatio = 0.5 + (skillLvl - 1) * 0.05;
        const tankShieldAmount = Math.round(curStats.maxHp * shieldRatio);
        p.tankShieldHp = tankShieldAmount;
        p.tankShieldTimer = 10.0;
        setStats((prev) => ({ ...prev, shieldHp: Math.round(prev.maxHp * shieldRatio) }));
        spawnParticles(p.x, p.y, '#3b82f6', 24, 4.0);
        spawnFloatingText(p.x, p.y - 28, `+${tankShieldAmount} GIÁP ẢO!`, '#38bdf8', 14);
      } else if (nodeId === 'Tank_2') {
        // Chiêu 2: Lao về phía kẻ địch (Càng đông mục tiêu: +5% sát thương mỗi mục tiêu trong phạm vi 5m, tối đa 10 mục tiêu)
        sounds.playBasicAttack();
        sounds.playChargedSkill();
        addScreenShake(7.0);
        const nearbyEnemies5m = Math.min(
          10,
          enemiesRef.current.filter((e) => e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) <= 400).length
        );
        const tankCrowdMult = 1 + nearbyEnemies5m * 0.05;
        const chargeDmg = Math.round(rawAtk * 1.8 * tankCrowdMult);
        tankRamRef.current = {
          active: true,
          elapsed: 0,
          duration: 0.28,
          dirX,
          dirY,
          speed: 780,
          chargeLevel: 0.8,
          damage: chargeDmg,
          hitEnemyIds: new Set<string>(),
          afterimageTimer: 0,
          dustTimer: 0,
        };
        p.isDashing = true;
        p.dashTimer = 0.28;
        p.dashVx = dirX * 780;
        p.dashVy = dirY * 780;
      } else if (nodeId === 'Tank_3') {
        // Chiêu 3: Nhảy lên trời dậm xuống thật mạnh (Càng đông mục tiêu: +5% sát thương mỗi mục tiêu trong phạm vi 5m, tối đa 10 mục tiêu)
        const airDuration = 0.65;
        const jumpDist = 170;
        const nearbyEnemies5m = Math.min(
          10,
          enemiesRef.current.filter((e) => e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) <= 400).length
        );
        const tankCrowdMult = 1 + nearbyEnemies5m * 0.05;
        const slamDmg = Math.round(rawAtk * 2.2 * tankCrowdMult);
        tankLeapRef.current = {
          active: true,
          elapsed: 0,
          airDuration,
          vx: (dirX * jumpDist) / airDuration,
          vy: (dirY * jumpDist) / airDuration,
          maxHeight: 95,
          meters: 3,
          damage: slamDmg,
        };
        swingAnimRef.current = {
          active: true,
          startTime: performance.now(),
          duration: airDuration + 0.35,
          airDuration,
          maxJumpHeight: 95,
          jumpMeters: 3,
          startAngle: angle,
          endAngle: angle,
          isCharged: true,
          chargeLevel: 1,
          comboStep: 2,
          tankMode: 'jump_slam',
        };
        sounds.playDash();
      }

      // ================= 3. PHÁP SƯ (MAGE) =================
      else if (nodeId === 'Mage_1') {
        // Chiêu 1: Buff hiện tại (hồi mana mỗi giây + giảm thời gian hồi phục)
        sounds.playShield?.();
        p.mageBuffActive = true;
        p.mageBuffTimer = 10.0;
        p.mageManaTickTimer = 0;
        spawnParticles(p.x, p.y, '#eab308', 24, 4.0);
        spawnFloatingText(p.x, p.y - 28, 'LINH QUANG THUẬT!', '#facc15', 14);
      } else if (nodeId === 'Mage_2') {
        // Chiêu 2: Bắn lần lượt 10 quả cầu ra xung quanh
        const orbDmg = Math.round(rawAtk * 1.15);
        for (let i = 0; i < 10; i++) {
          setTimeout(() => {
            if (deathStateRef.current.isDead) return;
            const curP = playerRef.current;
            const orbAngle = angle + (i * Math.PI * 2) / 10;
            const isCrit = Math.random() < skillCritRate;
            sounds.playFireball();
            projectilesRef.current.push({
              id: Math.random().toString(),
              source: 'player',
              x: curP.x + Math.cos(orbAngle) * 20,
              y: curP.y + Math.sin(orbAngle) * 20,
              vx: Math.cos(orbAngle) * 420,
              vy: Math.sin(orbAngle) * 420,
              radius: 10,
              damage: isCrit ? Math.round(orbDmg * skillCritMult) : orbDmg,
              isCrit,
              color: '#ffffff',
              trailColor: '#fef08a',
              pierce: 2,
              maxLifetime: 1.35,
              age: 0,
              isAoe: true,
              aoeRadius: 55,
              projectileType: 'light_orb',
            });
          }, i * 75);
        }
      } else if (nodeId === 'Mage_3') {
        // Chiêu 3: Triệu hồi 3 siêu cầu từ trên lao xuống kẻ địch trong phạm vi 8m (640px)
        const meteorDmg = Math.round(rawAtk * 2.65);
        for (let m = 0; m < 3; m++) {
          setTimeout(() => {
            if (deathStateRef.current.isDead) return;
            const curP = playerRef.current;
            const inRangeEnemies = enemiesRef.current.filter(
              (e) => e.hp > 0 && Math.hypot(e.x - curP.x, e.y - curP.y) <= 640
            );
            let targetX = curP.x + dirX * (140 + m * 75) + (Math.random() - 0.5) * 60;
            let targetY = curP.y + dirY * (140 + m * 75) + (Math.random() - 0.5) * 60;
            if (inRangeEnemies.length > 0) {
              const chosen = inRangeEnemies[m % inRangeEnemies.length];
              targetX = chosen.x;
              targetY = chosen.y;
            }

            // Vệt siêu cầu giáng từ bầu trời xuống mục tiêu
            const skyStartX = targetX - 90;
            const skyStartY = targetY - 260;
            for (let s = 0; s < 14; s++) {
              const prog = s / 14;
              particlesRef.current.push({
                id: Math.random().toString(),
                x: skyStartX + (targetX - skyStartX) * prog,
                y: skyStartY + (targetY - skyStartY) * prog,
                vx: (Math.random() - 0.5) * 1.5,
                vy: 2.5,
                color: s % 2 === 0 ? '#facc15' : '#ffffff',
                size: 6 + prog * 8,
                alpha: 0.95,
                life: 0,
                maxLife: 0.28,
              });
            }

            sounds.playExplosion();
            addScreenShake(7.0);
            spawnParticles(targetX, targetY, '#facc15', 32, 5.2);
            spawnParticles(targetX, targetY, '#ffffff', 20, 4.0);

            const blastRadius = 135;
            enemiesRef.current.forEach((enemy) => {
              if (enemy.hp <= 0) return;
              if (Math.hypot(enemy.x - targetX, enemy.y - targetY) <= blastRadius + enemy.radius) {
                const isCrit = Math.random() < skillCritRate;
                const applied = isCrit ? Math.round(meteorDmg * skillCritMult) : meteorDmg;
                enemy.hp -= applied;
                recordEnemyHit(enemy, applied);
                enemy.hurtFlashTime = 0.25;
                const kAng = Math.atan2(enemy.y - targetY, enemy.x - targetX);
                enemy.vx += Math.cos(kAng) * 340;
                enemy.vy += Math.sin(kAng) * 340;
                spawnDamageText(enemy.x, enemy.y, `${applied}${isCrit ? '!' : ''}`, true, isCrit, 18);
              }
            });
          }, m * 220);
        }
      }

      // ================= 4. SÁT THỦ (ASSASSIN) =================
      else if (nodeId === 'Assassin_1') {
        // Chiêu 1: Buff hiện tại
        sounds.playShield?.();
        p.assassinBuffActive = true;
        p.assassinBuffTimer = 6.0;
        spawnParticles(p.x, p.y, '#a855f7', 24, 4.0);
        spawnFloatingText(p.x, p.y - 28, 'VÔ ẢNH BỘ!', '#c084fc', 14);
      } else if (nodeId === 'Assassin_2') {
        // Chiêu 2: Ném 1 phi tiêu dấu ấn về trước 5m (400px). Không đẩy lùi (No knockback), không xuyên qua mục tiêu (Single target hit)
        sounds.playHeavySlash();
        addScreenShake(3.5);
        const shurikenSpeed = 520;
        const shurikenLifetime = 400 / shurikenSpeed; // Đúng 5m = 400px
        const shurikenDmg = Math.round(rawAtk * 2.2);
        const isCrit = Math.random() < skillCritRate;
        const newProj: Projectile = {
          id: Math.random().toString(),
          source: 'player',
          x: p.x + dirX * 26,
          y: p.y + dirY * 26,
          vx: dirX * shurikenSpeed,
          vy: dirY * shurikenSpeed,
          radius: 26,
          damage: isCrit ? Math.round(shurikenDmg * skillCritMult) : shurikenDmg,
          isCrit,
          color: '#c084fc',
          trailColor: '#a855f7',
          pierce: 1, // Không xuyên qua mục tiêu (Single target hit)
          maxLifetime: shurikenLifetime,
          age: 0,
          projectileType: 'giant_shuriken',
        };
        (newProj as any).knockbackDist = 0; // Không gây đẩy lùi (No knockback)
        projectilesRef.current.push(newProj);
      } else if (nodeId === 'Assassin_3') {
        // Chiêu 3: Nhập vào 1 mục tiêu và chém liên tục (hồi máu, hồi chiêu nhanh dựa vào đòn đánh)
        let targetEnemy = getPriorityTarget();
        const slashHits = 8;
        const singleSlashDmg = Math.round(rawAtk * 0.72);

        if (!targetEnemy) {
          // Nếu xung quanh chưa có mục tiêu, thi triển Liên Trảm Bóng Tối tại chỗ xung quanh bản thân để không làm mất lượt hay kẹt hồi chiêu
          sounds.playDash();
          for (let hit = 0; hit < slashHits; hit++) {
            setTimeout(() => {
              if (deathStateRef.current.isDead) return;
              const curP = playerRef.current;
              const liveEnemy = getPriorityTarget();
              const offsetAng = (hit * Math.PI * 2) / slashHits;
              if (liveEnemy) {
                curP.x = liveEnemy.x + Math.cos(offsetAng) * 18;
                curP.y = liveEnemy.y + Math.sin(offsetAng) * 12;
                curP.facingRight = liveEnemy.x >= curP.x;
                const isCrit = Math.random() < skillCritRate;
                const applied = isCrit ? Math.round(singleSlashDmg * skillCritMult) : singleSlashDmg;
                liveEnemy.hp -= applied;
                recordEnemyHit(liveEnemy, applied);
                addAssassinStackOnHit();
                applyAssassinPassiveTrueDamage(liveEnemy, applied);
                liveEnemy.hurtFlashTime = 0.12;
                spawnDamageText(liveEnemy.x, liveEnemy.y, `${applied}`, false, isCrit, 15);
              } else {
                curP.x += Math.cos(offsetAng) * 14;
                curP.y += Math.sin(offsetAng) * 10;
              }
              sounds.playBasicAttack();
              spawnParticles(curP.x, curP.y, '#c084fc', 8, 3.2);
              skill1CdRef.current = Math.max(0, skill1CdRef.current - 0.35);
              skill2CdRef.current = Math.max(0, skill2CdRef.current - 0.35);
              skill3CdRef.current = Math.max(0, skill3CdRef.current - 0.25);
              setSkill1CdRemaining(skill1CdRef.current);
              setSkill2CdRemaining(skill2CdRef.current);
              setSkill3CdRemaining(skill3CdRef.current);
            }, hit * 75);
          }
          return;
        }

        sounds.playDash();
        for (let hit = 0; hit < slashHits; hit++) {
          setTimeout(() => {
            if (deathStateRef.current.isDead) return;
            const curP = playerRef.current;
            if (!targetEnemy || targetEnemy.hp <= 0) {
              targetEnemy = getPriorityTarget();
            }
            const offsetAng = (hit * Math.PI * 2) / slashHits;
            if (targetEnemy && targetEnemy.hp > 0) {
              // Nhập sát vào mục tiêu ở các góc chém luân phiên
              curP.x = targetEnemy.x + Math.cos(offsetAng) * 18;
              curP.y = targetEnemy.y + Math.sin(offsetAng) * 12;
              curP.facingRight = targetEnemy.x >= curP.x;

              const isCrit = Math.random() < skillCritRate;
              const applied = isCrit ? Math.round(singleSlashDmg * skillCritMult) : singleSlashDmg;
              targetEnemy.hp -= applied;
              recordEnemyHit(targetEnemy, applied);
              addAssassinStackOnHit();
              applyAssassinPassiveTrueDamage(targetEnemy, applied);
              targetEnemy.hurtFlashTime = 0.12;
              spawnDamageText(targetEnemy.x, targetEnemy.y, `${applied}`, false, isCrit, 15);
              spawnParticles(targetEnemy.x, targetEnemy.y, '#c084fc', 8, 3.2);
            } else {
              // Mục tiêu đã bị hạ gục giữa chừng: vẫn chém nốt các nhát còn lại để hồi máu & giảm hồi chiêu đầy đủ
              curP.x += Math.cos(offsetAng) * 14;
              curP.y += Math.sin(offsetAng) * 10;
              spawnParticles(curP.x, curP.y, '#c084fc', 6, 2.8);
            }
            sounds.playBasicAttack();

            // Mỗi đòn chém hồi máu (4% maxHp) và giảm hồi chiêu của các kỹ năng đi 0.35s, đồng bộ ngay lên UI
            setStats((prev) => ({
              ...prev,
              currentHp: Math.min(prev.maxHp, prev.currentHp + Math.max(2, Math.round(prev.maxHp * 0.04))),
            }));
            skill1CdRef.current = Math.max(0, skill1CdRef.current - 0.35);
            skill2CdRef.current = Math.max(0, skill2CdRef.current - 0.35);
            skill3CdRef.current = Math.max(0, skill3CdRef.current - 0.25);
            setSkill1CdRemaining(skill1CdRef.current);
            setSkill2CdRemaining(skill2CdRef.current);
            setSkill3CdRemaining(skill3CdRef.current);
          }, hit * 75);
        }
      }

      // ================= 5. XẠ THỦ (MARKSMAN) =================
      else if (nodeId === 'Marksman_1') {
        // Chiêu 1: Buff như hiện tại
        sounds.playShield?.();
        p.marksmanBuffActive = true;
        p.marksmanBuffTimer = 10.0;
        p.marksmanStoneStacks = 10;
        spawnParticles(p.x, p.y, '#10b981', 24, 4.0);
        spawnFloatingText(p.x, p.y - 28, 'ƯNG NHÃN TỐC BỘ!', '#34d399', 14);
      } else if (nodeId === 'Marksman_2') {
        // Chiêu 2: Bắn liên tục 5 đòn gồng về phía mục tiêu (xuyên thấu)
        const shotDmg = Math.round(rawAtk * 1.35);
        for (let s = 0; s < 5; s++) {
          setTimeout(() => {
            if (deathStateRef.current.isDead) return;
            const curP = playerRef.current;
            const liveTarget = getPriorityTarget();
            const shotAngle = liveTarget
              ? Math.atan2(liveTarget.y - curP.y, liveTarget.x - curP.x)
              : angle;
            curP.angle = shotAngle;
            curP.facingRight = Math.cos(shotAngle) >= 0;
            sounds.playShoot();
            const isCrit = Math.random() < skillCritRate;
            const proj: Projectile = {
              id: Math.random().toString(),
              source: 'player',
              x: curP.x + Math.cos(shotAngle) * 22,
              y: curP.y + Math.sin(shotAngle) * 22,
              vx: Math.cos(shotAngle) * 860,
              vy: Math.sin(shotAngle) * 860,
              radius: 7,
              damage: isCrit ? Math.round(shotDmg * skillCritMult) : shotDmg,
              isCrit,
              color: '#34d399',
              trailColor: '#10b981',
              pierce: 99, // Xuyên thấu toàn bộ mục tiêu
              maxLifetime: 0.9,
              age: 0,
              projectileType: 'stone',
            };
            (proj as any).isFullChargeStone = true;
            (proj as any).knockbackDist = 28;
            projectilesRef.current.push(proj);
          }, s * 95);
        }
      } else if (nodeId === 'Marksman_3') {
        // Chiêu 3: Xoay người và liên tục bắn
        const totalShots = 16;
        const spinShotDmg = Math.round(rawAtk * 0.95);
        for (let i = 0; i < totalShots; i++) {
          setTimeout(() => {
            if (deathStateRef.current.isDead) return;
            const curP = playerRef.current;
            const spinAngle = angle + (i * Math.PI * 2) / 8;
            curP.angle = spinAngle;
            curP.facingRight = Math.cos(spinAngle) >= 0;
            sounds.playShoot();
            const isCrit = Math.random() < skillCritRate;
            projectilesRef.current.push({
              id: Math.random().toString(),
              source: 'player',
              x: curP.x + Math.cos(spinAngle) * 20,
              y: curP.y + Math.sin(spinAngle) * 20,
              vx: Math.cos(spinAngle) * 700,
              vy: Math.sin(spinAngle) * 700,
              radius: 5.5,
              damage: isCrit ? Math.round(spinShotDmg * skillCritMult) : spinShotDmg,
              isCrit,
              color: '#10b981',
              trailColor: '#059669',
              pierce: 4,
              maxLifetime: 0.85,
              age: 0,
              projectileType: 'stone',
            });
          }, i * 55);
        }
      }
    },
    [activeClass, addScreenShake, getPriorityTarget, spawnDamageText, spawnFloatingText, spawnParticles]
  );

  // Thực thi Nút Kỹ Năng (1, 2, hoặc 3): Kích hoạt Ô 1 (Nhánh Chính) trước -> Ô 2 (Nhánh Phụ) kích hoạt ngay sau
  const executeSkillSlot = useCallback(
    (slotNum: 1 | 2 | 3, customAngle?: number) => {
      if (deathStateRef.current.isDead || playerSpawnTimerRef.current > 0) return;
      const cdRef = slotNum === 1 ? skill1CdRef : slotNum === 2 ? skill2CdRef : skill3CdRef;
      if (cdRef.current > 0) return;

      const curSkillSys = skillSystemRef.current;
      const fusion = curSkillSys.equippedSlots[slotNum];
      if (!fusion.main && !fusion.sub) {
        spawnFloatingText(playerRef.current.x, playerRef.current.y - 25, 'Chưa học/gắn kỹ năng!', '#facc15', 14);
        setIsLearnSkillsOpen(true);
        return;
      }

      const mainNode = fusion.main || fusion.sub!;
      const subNode = fusion.main && fusion.sub && fusion.main !== fusion.sub ? fusion.sub : null;

      const mainDef = getSkillDefinitionByNodeId(mainNode);
      const subDef = subNode ? getSkillDefinitionByNodeId(subNode) : null;

      const mainLvl = Math.max(1, curSkillSys.skillLevels[mainNode] || 1);
      const subLvl = subNode ? Math.max(1, curSkillSys.skillLevels[subNode] || 1) : 0;

      // Cân bằng Mana & Cooldown khi kết hợp 2 chiêu:
      // Giới hạn tổng Mana tiêu hao không vượt quá 80% Max Mana của hệ phái hiện tại (để Đỡ Đòn / Sát Thủ gắn chiêu Pháp Sư không bao giờ bị kẹt)
      const rawManaCost = mainDef.manaCost + (subDef ? Math.round(subDef.manaCost * 0.5) : 0);
      const totalManaCost = Math.min(rawManaCost, Math.max(4, Math.floor(statsRef.current.maxMana * 0.8)));
      if (statsRef.current.currentMana < totalManaCost) {
        sounds.playNoMana?.();
        spawnFloatingText(playerRef.current.x, playerRef.current.y - 25, `Cần ${totalManaCost} Mana!`, '#ef4444', 15);
        return;
      }

      // Khi gắn 2 chiêu vào nhau: thời gian hồi chiêu lấy theo chiêu có hồi chiêu lâu hơn (không cộng dồn thêm phạt CD gây lỗi hồi chiêu quá lâu)
      const mainCd = Math.max(1.5, mainDef.cooldown * (1 - mainLvl * 0.03));
      const subCd = subDef ? Math.max(1.5, subDef.cooldown * (1 - subLvl * 0.03)) : 0;
      const finalCooldown = subDef ? +Math.max(mainCd, subCd).toFixed(1) : +mainCd.toFixed(1);

      cdRef.current = finalCooldown;
      if (slotNum === 1) setSkill1CdRemaining(finalCooldown);
      else if (slotNum === 2) setSkill2CdRemaining(finalCooldown);
      else setSkill3CdRemaining(finalCooldown);

      setStats((prev) => ({
        ...prev,
        currentMana: Math.max(0, prev.currentMana - totalManaCost),
      }));

      // 1. Kích hoạt Ô 1 (Nhánh Chính) trước
      executeSingleSkillNode(mainNode, customAngle);

      // 2. Nếu có Ô 2 (Nhánh Phụ), tự động kích hoạt nối tiếp ngay sau:
      // Nếu Ô 1 là chiêu lướt/nhảy của Đỡ Đòn (Tank_2: 280ms, Tank_3: 680ms) thì đợi Ô 1 đáp đất xong mới tung Ô 2 để 2 chiêu không đè mất nhau
      if (subNode) {
        const comboDelayMs = mainNode === 'Tank_3' ? 680 : mainNode === 'Tank_2' ? 300 : 260;
        setTimeout(() => {
          if (deathStateRef.current.isDead) return;
          executeSingleSkillNode(subNode, customAngle);
        }, comboDelayMs);
      }
    },
    [executeSingleSkillNode, spawnFloatingText]
  );

  const executeSkill1 = useCallback((customAngle?: number) => executeSkillSlot(1, customAngle), [executeSkillSlot]);
  const executeSkill2 = useCallback((customAngle?: number) => executeSkillSlot(2, customAngle), [executeSkillSlot]);
  const executeSkill3 = useCallback((customAngle?: number) => executeSkillSlot(3, customAngle), [executeSkillSlot]);

  // Điều khiển Joystick nửa màn hình trái: Chặn 100% duplicate triggers giữa TouchEvent và MouseEvent
  const handleLeftHalfTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const isTouch = 'touches' in e || 'changedTouches' in e;
    if (isTouch) {
      lastTouchTimeRef.current = performance.now();
    } else {
      if (performance.now() - lastTouchTimeRef.current < 500) {
        return;
      }
    }

    if (e.cancelable) {
      e.preventDefault();
    }
    e.stopPropagation();

    let clientX = 0;
    let clientY = 0;
    let touchId: number | null = null;

    if ('changedTouches' in e && (e as React.TouchEvent).changedTouches.length > 0) {
      const touches = (e as React.TouchEvent).changedTouches;
      for (let i = 0; i < touches.length; i++) {
        if (touches[i].clientX < window.innerWidth / 2) {
          clientX = touches[i].clientX;
          clientY = touches[i].clientY;
          touchId = touches[i].identifier;
          break;
        }
      }
    } else if ('touches' in e && (e as React.TouchEvent).touches.length > 0) {
      const touches = (e as React.TouchEvent).touches;
      for (let i = 0; i < touches.length; i++) {
        if (touches[i].clientX < window.innerWidth / 2) {
          clientX = touches[i].clientX;
          clientY = touches[i].clientY;
          touchId = touches[i].identifier;
          break;
        }
      }
    } else if ('clientX' in e) {
      const me = e as React.MouseEvent;
      clientX = me.clientX;
      clientY = me.clientY;
      touchId = -999;
    }

    if (clientX >= window.innerWidth / 2 || touchId === null) {
      return;
    }

    setIsJoystickActive(true);
    touchIdRef.current = touchId;
    joystickCenterRef.current = { x: clientX, y: clientY };
    setJoystickOrigin({ x: clientX, y: clientY });

    updateJoystickPos(clientX, clientY, clientX, clientY);
  };

  const updateJoystickPos = (clientX: number, clientY: number, centerX: number, centerY: number) => {
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const maxRadius = 36;
    const dist = Math.hypot(dx, dy);

    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    setJoystickKnob({ x: dx, y: dy });

    const normX = dx / maxRadius;
    const normY = dy / maxRadius;
    joystickVectorRef.current = { x: normX, y: normY };
  };

  // Skill Aim Handlers: Định hướng xoay / Giữ chiêu / Vuốt xa ngoài nút sẽ HỦY CHIÊU (Đỏ)
  // Không cần cầm vũ khí vẫn học & sử dụng được mọi kỹ năng
  const handleSkillAimStart = (skillId: 1 | 2 | 3, e: React.TouchEvent | React.MouseEvent) => {
    const isTouch = 'touches' in e || 'changedTouches' in e;
    if (isTouch) {
      lastTouchTimeRef.current = performance.now();
    } else {
      if (performance.now() - lastTouchTimeRef.current < 500) {
        return;
      }
    }

    if (e.cancelable) {
      e.preventDefault();
    }
    e.stopPropagation();

    const fusion = skillSystemRef.current.equippedSlots[skillId];
    if (!fusion.main && !fusion.sub) {
      spawnFloatingText(playerRef.current.x, playerRef.current.y - 25, 'Chưa học/gắn kỹ năng!', '#facc15', 14);
      setIsLearnSkillsOpen(true);
      return;
    }

    if (skillId === 1 && skill1CdRef.current > 0) return;
    if (skillId === 2 && skill2CdRef.current > 0) return;
    if (skillId === 3 && skill3CdRef.current > 0) return;

    let clientX = 0;
    let clientY = 0;
    let touchId: number | null = null;

    const targetEl = e.currentTarget as HTMLElement;
    const rect = targetEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    if ('changedTouches' in e && (e as any).changedTouches.length > 0) {
      const touch = (e as any).changedTouches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
      touchId = touch.identifier;
    } else if ('touches' in e && (e as any).touches.length > 0) {
      const touch = (e as any).touches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
      touchId = touch.identifier;
    } else if ('clientX' in e) {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
      touchId = -999;
    }

    const p = playerRef.current;
    aimingSkillRef.current = {
      skillId,
      startX: centerX,
      startY: centerY,
      currentX: clientX,
      currentY: clientY,
      angle: p.angle,
      dist: 0,
      isCancelled: false,
      touchId,
    };
    setAimingSkillId(skillId);
  };

  const updateSkillAimPos = (clientX: number, clientY: number) => {
    const aim = aimingSkillRef.current;
    if (!aim) return;

    aim.currentX = clientX;
    aim.currentY = clientY;

    const dx = clientX - aim.startX;
    const dy = clientY - aim.startY;
    const dist = Math.hypot(dx, dy);
    aim.dist = dist;

    // Khi kéo ngón tay ra khỏi tâm nút (> 12px), xoay định hướng theo hướng kéo
    if (dist > 12) {
      const angle = Math.atan2(dy, dx);
      aim.angle = angle;
      const p = playerRef.current;
      p.angle = angle;
      if (Math.cos(angle) > 0.1) {
        p.facingRight = true;
      } else if (Math.cos(angle) < -0.1) {
        p.facingRight = false;
      }
    }

    // Vuốt xa ra bên ngoài nút (> 80px) sẽ hủy (ĐỎ)
    if (dist > 80) {
      aim.isCancelled = true;
    } else {
      aim.isCancelled = false;
    }
  };

  const finishSkillAim = (touchId?: number | null) => {
    const aim = aimingSkillRef.current;
    if (!aim) return;
    if (touchId !== undefined && aim.touchId !== null && touchId !== aim.touchId) {
      return;
    }

    const { skillId, isCancelled, angle, dist } = aim;
    aimingSkillRef.current = null;
    setAimingSkillId(null);

    // Nếu vuốt ra vùng đỏ bên ngoài nút -> HỦY CHIÊU hoàn toàn
    if (isCancelled) {
      return;
    }

    // Tung chiêu: Nếu kéo có định hướng (> 12px) thì dùng góc đó, nếu chỉ tap nhanh (< 12px) thì dùng góc hiện tại
    const targetAngle = dist > 12 ? angle : undefined;
    if (skillId === 1) executeSkill1(targetAngle);
    else if (skillId === 2) executeSkill2(targetAngle);
    else if (skillId === 3) executeSkill3(targetAngle);
  };

  useEffect(() => {
    const handleGlobalTouchMove = (e: TouchEvent) => {
      // 1. Cần điều khiển tay trái (Joystick) - Zero-delay 1:1 tracking
      if (isJoystickActive && touchIdRef.current !== null && touchIdRef.current !== -999) {
        let centerX = joystickCenterRef.current ? joystickCenterRef.current.x : 0;
        let centerY = joystickCenterRef.current ? joystickCenterRef.current.y : 0;
        for (let i = 0; i < e.touches.length; i++) {
          if (e.touches[i].identifier === touchIdRef.current) {
            if (e.cancelable) e.preventDefault();
            updateJoystickPos(e.touches[i].clientX, e.touches[i].clientY, centerX, centerY);
            break;
          }
        }
      }

      // 2. Định hướng xoay chiêu tay phải (Skill Aiming)
      if (aimingSkillRef.current && aimingSkillRef.current.touchId !== null && aimingSkillRef.current.touchId !== -999) {
        for (let i = 0; i < e.touches.length; i++) {
          if (e.touches[i].identifier === aimingSkillRef.current.touchId) {
            if (e.cancelable) e.preventDefault();
            updateSkillAimPos(e.touches[i].clientX, e.touches[i].clientY);
            break;
          }
        }
      }
    };

    const handleGlobalTouchEnd = (e: TouchEvent) => {
      // 1. Cần điều khiển tay trái (End / Cancel)
      if (isJoystickActive && touchIdRef.current !== null && touchIdRef.current !== -999) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === touchIdRef.current) {
            if (e.cancelable) e.preventDefault();
            setIsJoystickActive(false);
            setJoystickKnob({ x: 0, y: 0 });
            joystickVectorRef.current = { x: 0, y: 0 };
            touchIdRef.current = null;
            joystickCenterRef.current = null;
            setJoystickOrigin(null);
            break;
          }
        }
      }

      // 2. Kết thúc định hướng / Hủy chiêu tay phải
      if (aimingSkillRef.current && aimingSkillRef.current.touchId !== null && aimingSkillRef.current.touchId !== -999) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === aimingSkillRef.current.touchId) {
            if (e.cancelable) e.preventDefault();
            finishSkillAim(e.changedTouches[i].identifier);
            break;
          }
        }
      }
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (performance.now() - lastTouchTimeRef.current < 500) return;
      if (isJoystickActive && (touchIdRef.current === -999 || touchIdRef.current === null)) {
        let centerX = joystickCenterRef.current ? joystickCenterRef.current.x : 0;
        let centerY = joystickCenterRef.current ? joystickCenterRef.current.y : 0;
        updateJoystickPos(e.clientX, e.clientY, centerX, centerY);
      }
      if (aimingSkillRef.current && (aimingSkillRef.current.touchId === -999 || aimingSkillRef.current.touchId === null)) {
        updateSkillAimPos(e.clientX, e.clientY);
      }
    };

    const handleGlobalMouseUp = () => {
      if (performance.now() - lastTouchTimeRef.current < 500) return;
      if (isJoystickActive && (touchIdRef.current === -999 || touchIdRef.current === null)) {
        setIsJoystickActive(false);
        setJoystickKnob({ x: 0, y: 0 });
        joystickVectorRef.current = { x: 0, y: 0 };
        touchIdRef.current = null;
        joystickCenterRef.current = null;
        setJoystickOrigin(null);
      }
      if (aimingSkillRef.current && (aimingSkillRef.current.touchId === -999 || aimingSkillRef.current.touchId === null)) {
        finishSkillAim();
      }
    };

    window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    window.addEventListener('touchend', handleGlobalTouchEnd, { passive: false });
    window.addEventListener('touchcancel', handleGlobalTouchEnd, { passive: false });
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
      window.removeEventListener('touchcancel', handleGlobalTouchEnd);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isJoystickActive, executeSkill1, executeSkill2, executeSkill3]);

  // Main Canvas Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();
    let loopFrameCount = 0;

    initPlayerSpawnEffect();
    lastTime = performance.now();

    // Spawn Waves in Dungeon (Staggered through pendingSpawnsRef to prevent frame drop)
    const spawnDungeonWave = () => {
      const p = playerRef.current;
      const wave = waveRef.current;
      const count = 4 + wave * 2;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 320 + Math.random() * 150;
        const enemyType = Math.random() > 0.75 ? 'brute' : Math.random() > 0.4 ? 'scout' : 'chaser';

        pendingSpawnsRef.current.push({
          id: Math.random().toString(),
          type: enemyType,
          name: enemyType === 'brute' ? 'Quái Búa Khổng Lồ' : enemyType === 'scout' ? 'Yêu Tinh Nhanh Nhẹn' : 'Bộ Xương Tấn Công',
          x: p.x + Math.cos(angle) * dist,
          y: p.y + Math.sin(angle) * dist,
          vx: 0,
          vy: 0,
          radius: enemyType === 'brute' ? 24 : enemyType === 'scout' ? 12 : 16,
          hp: enemyType === 'brute' ? 120 + wave * 20 : enemyType === 'scout' ? 35 + wave * 5 : 60 + wave * 10,
          maxHp: enemyType === 'brute' ? 120 + wave * 20 : enemyType === 'scout' ? 35 + wave * 5 : 60 + wave * 10,
          speed: enemyType === 'scout' ? 150 : enemyType === 'brute' ? 70 : 105,
          damage: enemyType === 'brute' ? 22 : enemyType === 'scout' ? 8 : 12,
          color: enemyType === 'brute' ? '#7c3aed' : enemyType === 'scout' ? '#f97316' : '#ef4444',
          goldDrop: enemyType === 'brute' ? 25 : enemyType === 'scout' ? 10 : 15,
          hurtFlashTime: 0,
        });
      }
    };

    const loop = (now: number) => {
      // Đảm bảo luôn đăng ký frame kế tiếp ngay ở đầu hàm, vòng lặp render không bao giờ bị dừng lại
      animId = requestAnimationFrame(loop);

      try {
        loopFrameCount++;
        const dt = loopFrameCount > 1 ? Math.min(0.033, (now - lastTime) / 1000) : 0.016;
        lastTime = now;

        // Quy trình Khởi tạo Thế giới Bất đồng bộ (Async World Instantiation Sequence)
        if (worldLoadPhaseRef.current < 3) {
          if (loopFrameCount === 1) {
            worldLoadPhaseRef.current = 0; // Bước 1: Màu gốc phẳng (#001122)
          } else if (loopFrameCount === 2) {
            worldLoadPhaseRef.current = 1; // Bước 2: Lớp màu cơ bản (Low-res/Diffuse thô)
          } else if (loopFrameCount === 3) {
            worldLoadPhaseRef.current = 2; // Bước 3: Lớp màu chi tiết (Full Detailed Cached Map)
          } else {
            worldLoadPhaseRef.current = 3; // Bước 4: Khởi tạo người chơi qua VFX Hạt ổn định
          }
        }

        const p = playerRef.current;
        const pool = particlePoolRef.current;

        if (loopFrameCount === 1) {
          cameraRef.current.x = p.x;
          cameraRef.current.y = p.y;
        }

        {
          // Xử lý nạp quái vật rải rác: tối đa 1-2 quái mỗi frame để san sẻ tải trọng CPU
        if (pendingSpawnsRef.current.length > 0) {
          const spawnCountThisFrame = Math.min(2, pendingSpawnsRef.current.length);
          for (let s = 0; s < spawnCountThisFrame; s++) {
            const nextEnemy = pendingSpawnsRef.current.shift();
            if (nextEnemy) {
              enemiesRef.current.push(nextEnemy);
            }
          }
        }

        // Cập nhật bộ đếm thời gian xuất hiện của người chơi (dùng trực tiếp CHARACTER_SILHOUETTE_POINTS cố định, không chạy Farthest-Point Sampling trong loop)
        if (playerSpawnTimerRef.current > 0) {
          playerSpawnTimerRef.current -= dt;
          if (playerSpawnTimerRef.current < 0) {
            playerSpawnTimerRef.current = 0;
          }
        }

        // Cập nhật bộ đếm thời gian đóng băng AI quái vật
        if (aiFreezeTimerRef.current > 0) {
          aiFreezeTimerRef.current -= dt;
          if (aiFreezeTimerRef.current < 0) {
            aiFreezeTimerRef.current = 0;
          }
        }

      // Hit Stop (Khựng hình khẩn cấp tại điểm va chạm)
      if (hitStopTimerRef.current > 0) {
        hitStopTimerRef.current = Math.max(0, hitStopTimerRef.current - dt);
        if (swingAnimRef.current.active) {
          swingAnimRef.current.startTime += dt * 1000;
        }
      }

      // Handle Cooldown countdowns (Throttle React state updates to ~10Hz or on completion to prevent 60FPS re-render lag)
      // Khi kích hoạt Chiêu 3 Đấu Sĩ (Huyết Chiến Cường Hóa) hoặc Buff Pháp Sư (Linh Quang Thuật), tốc độ hồi chiêu tăng thêm 35%
      const cdHasteMult =
        1.0 +
        (playerRef.current.fighterEnhanceActive ? 0.35 : 0) +
        (playerRef.current.mageBuffActive ? 0.25 : 0);
      const cdDelta = dt * cdHasteMult;

      cdUiSyncTimerRef.current += dt;
      const shouldSyncCdUi = cdUiSyncTimerRef.current >= 0.08;
      if (shouldSyncCdUi) {
        cdUiSyncTimerRef.current = 0;
      }
      if (skill1CdRef.current > 0) {
        skill1CdRef.current = Math.max(0, skill1CdRef.current - cdDelta);
        if (shouldSyncCdUi || skill1CdRef.current <= 0.001) {
          if (skill1CdRef.current <= 0.001) skill1CdRef.current = 0;
          setSkill1CdRemaining(skill1CdRef.current);
        }
      }
      if (skill2CdRef.current > 0) {
        skill2CdRef.current = Math.max(0, skill2CdRef.current - cdDelta);
        if (shouldSyncCdUi || skill2CdRef.current <= 0.001) {
          if (skill2CdRef.current <= 0.001) skill2CdRef.current = 0;
          setSkill2CdRemaining(skill2CdRef.current);
        }
      }
      if (skill3CdRef.current > 0) {
        skill3CdRef.current = Math.max(0, skill3CdRef.current - cdDelta);
        if (shouldSyncCdUi || skill3CdRef.current <= 0.001) {
          if (skill3CdRef.current <= 0.001) skill3CdRef.current = 0;
          setSkill3CdRemaining(skill3CdRef.current);
        }
      }

      // Mana Regeneration: Giảm tốc độ hồi mana của Pháp Sư (chu kỳ gốc 20s 1 lần, khi có buff là 5s 1 lần)
      const curStats = statsRef.current;
      const intPts = curStats.attributes?.intPoints ?? attributesRef.current.intPoints ?? 0;
      const isMageBuffActiveNow = activeClass === 'Mage' && playerRef.current.mageBuffActive && playerRef.current.mageBuffTimer > 0;
      const baseRegenInterval = isMageBuffActiveNow ? 5.0 : (activeClass === 'Mage' ? 20.0 : 10.0);
      const manaRegenInterval = Math.max(1.0, baseRegenInterval - intPts * 0.4);
      manaRegenTimerRef.current += dt;
      if (manaRegenTimerRef.current >= manaRegenInterval) {
        manaRegenTimerRef.current = 0;
        setStats((prev) => {
          if (prev.currentMana < prev.maxMana) {
            const healRatio = activeClass === 'Mage' ? 0.15 : 0.25;
            const healAmount = Math.max(8, Math.round(prev.maxMana * healRatio));
            return {
              ...prev,
              currentMana: Math.min(prev.maxMana, prev.currentMana + healAmount),
            };
          }
          return prev;
        });
      }

      // Hồi mana tự nhiên định kỳ mỗi 0.5s (Cộng dồn nội tại Pháp Sư nếu đã học + Chiêu 3 Cường Hóa của Đấu Sĩ)
      if (!deathStateRef.current.isDead && curStats.currentMana < curStats.maxMana) {
        passiveManaTimerRef.current += dt;
        if (passiveManaTimerRef.current >= 0.5) {
          const elapsedPassive = passiveManaTimerRef.current;
          passiveManaTimerRef.current = 0;
          const hasMagePassive = skillSystemRef.current.unlockedClasses.includes('Mage');
          const magePassiveManaBonus = hasMagePassive
            ? 0.05 + (skillSystemRef.current.passiveLevels.Mage || 0) * 0.02
            : 0;
          const fighterEnhanceRegenMult = playerRef.current.fighterEnhanceActive ? 2.2 : 1.0;
          const passiveManaPerSec =
            curStats.maxMana *
            (activeClass === 'Mage' ? 0.008 : 0.04) *
            (1 + intPts * 0.05 + magePassiveManaBonus) *
            fighterEnhanceRegenMult;
          const manaGain = passiveManaPerSec * elapsedPassive;
          setStats((prev) => {
            if (prev.currentMana < prev.maxMana) {
              return {
                ...prev,
                currentMana: Math.min(prev.maxMana, prev.currentMana + manaGain),
              };
            }
            return prev;
          });
        }
      } else {
        passiveManaTimerRef.current = 0;
      }

      // Hồi phục Máu khi Mana Đầy hoặc khi đang bật Chiêu 3 Cường Hóa của Đấu Sĩ
      if (
        (curStats.currentMana >= curStats.maxMana || playerRef.current.fighterEnhanceActive) &&
        curStats.currentHp < curStats.maxHp &&
        !deathStateRef.current.isDead
      ) {
        hpRegenTimerRef.current += dt;
        const hpTickInterval = playerRef.current.fighterEnhanceActive ? 0.3 : 0.5;
        if (hpRegenTimerRef.current >= hpTickInterval) {
          hpRegenTimerRef.current = 0;
          setStats((prev) => {
            if (prev.currentHp < prev.maxHp) {
              const hpHeal = Math.max(
                1,
                Math.round(prev.maxHp * (playerRef.current.fighterEnhanceActive ? 0.035 : 0.02))
              );
              return {
                ...prev,
                currentHp: Math.min(prev.maxHp, prev.currentHp + hpHeal),
              };
            }
            return prev;
          });
        }
      } else {
        hpRegenTimerRef.current = 0;
      }

      // Movement Input: WASD / Virtual Joystick
      const p = playerRef.current;
      if (!Number.isFinite(p.x)) p.x = 0;
      if (!Number.isFinite(p.y)) p.y = 0;
      if (!Number.isFinite(p.vx)) p.vx = 0;
      if (!Number.isFinite(p.vy)) p.vy = 0;
      let moveX = 0;
      let moveY = 0;
      if (playerSpawnTimerRef.current <= 0) {
        if (keysRef.current['KeyW'] || keysRef.current['ArrowUp']) moveY -= 1;
        if (keysRef.current['KeyS'] || keysRef.current['ArrowDown']) moveY += 1;
        if (keysRef.current['KeyA'] || keysRef.current['ArrowLeft']) moveX -= 1;
        if (keysRef.current['KeyD'] || keysRef.current['ArrowRight']) moveX += 1;

        const jx = joystickVectorRef.current.x;
        const jy = joystickVectorRef.current.y;
        if (Math.hypot(jx, jy) > 0.08) {
          moveX = jx;
          moveY = jy;
        } else {
          const len = Math.hypot(moveX, moveY);
          if (len > 0) {
            moveX /= len;
            moveY /= len;
          }
        }
      }

      // Check Dash & Buffs & Afterimage Generation
      if (p.dashTimer > 0) {
        p.dashTimer -= dt;
        p.vx = p.dashVx;
        p.vy = p.dashVy;

        p.dashShadowTimer = (p.dashShadowTimer || 0) + dt;
        if (p.dashShadowTimer >= 0.030) {
          p.dashShadowTimer = 0;
          afterimagesRef.current.push({
            id: Math.random().toString(),
            x: p.x,
            y: p.y,
            angle: p.angle,
            facingRight: p.facingRight,
            activeClass,
            alpha: 0.85,
            maxAlpha: 0.85,
            duration: 0.16,
            color: '#ffffff',
          });
        }

        if (p.dashTimer <= 0) p.isDashing = false;
      }
      if (p.shieldTimer > 0) {
        p.shieldTimer -= dt;
        if (p.shieldTimer <= 0) p.shieldActive = false;
      }
      if (p.battleCryTimer > 0) {
        p.battleCryTimer -= dt;
        if (p.battleCryTimer <= 0) p.battleCryActive = false;
      }

      // Xử lý đếm ngược và hiệu ứng các buff chiêu thức mới của từng Class:
      if (p.fighterBuffTimer > 0) {
        p.fighterBuffTimer -= dt;
        if (p.fighterBuffTimer <= 0) p.fighterBuffActive = false;
      }
      if (p.fighterEnhanceTimer > 0) {
        p.fighterEnhanceTimer -= dt;
        if (p.fighterEnhanceTimer <= 0) p.fighterEnhanceActive = false;
      }
      if (p.fighterGuaranteedChargeTimer > 0) {
        p.fighterGuaranteedChargeTimer = Math.max(0, p.fighterGuaranteedChargeTimer - dt);
      }
      if (p.tankShieldTimer > 0) {
        p.tankShieldTimer -= dt;
        if (p.tankShieldTimer <= 0) {
          p.tankShieldHp = 0;
          setStats((prev) => (prev.shieldHp ? { ...prev, shieldHp: 0 } : prev));
        }
      }
      if (p.mageBuffTimer > 0) {
        p.mageBuffTimer -= dt;
        // Hồi mana mỗi giây theo cấp độ Linh Quang Thuật
        p.mageManaTickTimer += dt;
        if (p.mageManaTickTimer >= 1.0) {
          p.mageManaTickTimer -= 1.0;
          const mBuffLvl = Math.max(1, skillSystemRef.current.skillLevels.Mage_1 || 1);
          const manaPerSec = 10 + mBuffLvl * 2;
          setStats((prev) => ({
            ...prev,
            currentMana: Math.min(prev.maxMana, prev.currentMana + manaPerSec),
          }));
        }
        if (p.mageBuffTimer <= 0) p.mageBuffActive = false;
      }
      if (p.assassinBuffTimer > 0) {
        p.assassinBuffTimer -= dt;
        if (p.assassinBuffTimer <= 0) p.assassinBuffActive = false;
      }
      if (p.marksmanBuffTimer > 0) {
        p.marksmanBuffTimer -= dt;
        if (p.marksmanBuffTimer <= 0) p.marksmanBuffActive = false;
      }

      // Xử lý trạng thái chết (Bay ngửa ra sau và nằm ngửa trên mặt đất)
      if (deathStateRef.current.isDead) {
        const ds = deathStateRef.current;
        ds.elapsed += dt;
        moveX = 0;
        moveY = 0;
        p.vx = 0;
        p.vy = 0;

        // Chuyển động bay văng ngửa ra sau
        p.x += ds.knockbackVx * dt;
        p.y += ds.knockbackVy * dt;

        // Quỹ đạo bay lên không trung và rơi xuống theo trọng lực
        if (ds.airHeight > 0 || ds.airVelZ !== 0) {
          ds.airHeight += ds.airVelZ * dt;
          ds.airVelZ -= 620 * dt;

          // Tạo vệt hạt bụi trắng mờ khi đang bay ngửa trên không
          if (ds.airHeight > 4 && Math.random() < 0.5) {
            particlesRef.current.push({
              id: Math.random().toString(),
              x: p.x + (Math.random() - 0.5) * 8,
              y: p.y - ds.airHeight * 0.5,
              vx: -ds.knockbackVx * 0.002,
              vy: (Math.random() - 0.5) * 0.8,
              color: '#ffffff',
              size: Math.random() * 2.5 + 1.5,
              alpha: 0.75,
              life: 0,
              maxLife: 0.22,
            });
          }

          if (ds.airHeight <= 0) {
            ds.airHeight = 0;
            if (!ds.bounced && Math.abs(ds.airVelZ) > 65) {
              // Nảy nhẹ 1 nhịp khi lưng đập xuống đất
              ds.bounced = true;
              ds.airVelZ = 85;
              ds.knockbackVx *= 0.55;
              ds.knockbackVy *= 0.55;
              addScreenShake(4.5);
              sounds.playHit(false);
              spawnParticles(p.x, p.y + 8, '#cbd5e1', 12, 2.2);
              spawnParticles(p.x, p.y + 8, '#94a3b8', 8, 1.8);
            } else {
              ds.airVelZ = 0;
            }
          }
        } else {
          // Ma sát trượt trên mặt đất khi đã nằm ngửa
          ds.knockbackVx *= Math.pow(0.8, dt * 60);
          ds.knockbackVy *= Math.pow(0.8, dt * 60);
        }

        // Sau 3s kể từ khi chết: màn hình xám lại và hiện đếm ngược tạo nhân vật mới (1 mạng duy nhất - Permadeath)
        if (ds.elapsed >= 6.0) {
          handleHardcoreResetNewCharacter();
        } else if (ds.elapsed >= 2.0) {
          const remainSec = Math.max(1, Math.ceil(6.0 - ds.elapsed));
          if (lastCountdownRef.current !== remainSec) {
            lastCountdownRef.current = remainSec;
            setRespawnCountdown(remainSec);
          }
        }
      }

      // Xử lý đòn gồng LAO VỀ PHÍA TRƯỚC của Đỡ Đòn (Tank Battering Ram Rush)
      if (tankRamRef.current.active) {
        const ram = tankRamRef.current;
        if (deathStateRef.current.isDead) {
          ram.active = false;
        } else {
          ram.elapsed += dt;
          moveX = 0;
          moveY = 0;
          p.vx = ram.dirX * ram.speed;
          p.vy = ram.dirY * ram.speed;

          // Tạo tàn ảnh giáp thánh (Tank) hoặc tàn ảnh bóng ma tím/trắng siêu tốc (Sát Thủ)
          ram.afterimageTimer += dt;
          const afterimageInterval = activeClass === 'Assassin' ? 0.015 : 0.035;
          if (ram.afterimageTimer >= afterimageInterval) {
            ram.afterimageTimer = 0;
            afterimagesRef.current.push({
              id: Math.random().toString(),
              x: p.x,
              y: p.y,
              angle: p.angle,
              facingRight: p.facingRight,
              activeClass,
              alpha: activeClass === 'Assassin' ? 0.85 : 0.75,
              maxAlpha: activeClass === 'Assassin' ? 0.85 : 0.75,
              duration: activeClass === 'Assassin' ? 0.22 : 0.28,
              color: activeClass === 'Assassin' ? '#c084fc' : '#ffffff',
            });
          }

          // Tạo luồng bụi và tia gió cuộn dọc theo đường lao
          ram.dustTimer += dt;
          const dustInterval = activeClass === 'Assassin' ? 0.014 : 0.025;
          if (ram.dustTimer >= dustInterval) {
            ram.dustTimer = 0;
            particlesRef.current.push({
              id: Math.random().toString(),
              x: p.x - ram.dirX * 14 + (Math.random() - 0.5) * 12,
              y: p.y - ram.dirY * 14 + 10 + (Math.random() - 0.5) * 6,
              vx: -ram.dirX * (activeClass === 'Assassin' ? 4.8 : 2.5) + (Math.random() - 0.5) * 2.0,
              vy: -ram.dirY * (activeClass === 'Assassin' ? 4.8 : 2.5) + (Math.random() - 0.5) * 2.0,
              color: activeClass === 'Assassin' && Math.random() < 0.4 ? '#c084fc' : '#ffffff',
              size: Math.random() * 3.2 + 1.8,
              alpha: 0.9,
              life: 0,
              maxLife: 0.22,
              drag: 0.88,
            });
          }

          // Quét và chém/húc văng tất cả quái vật trên đường lao tới (Continuous Collision) - đánh lan
          const ramHitRadius = activeClass === 'Assassin' ? 52 : 42;
          enemiesRef.current.forEach((enemy) => {
            if (enemy.hp <= 0) return;
            if (ram.hitEnemyIds.has(enemy.id)) return;

            const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
            if (dist <= ramHitRadius + enemy.radius) {
              ram.hitEnemyIds.add(enemy.id);
              enemy.hp -= ram.damage;
              recordEnemyHit(enemy, ram.damage);
              if (activeClass === 'Assassin') {
                addAssassinStackOnHit();
                applyAssassinPassiveTrueDamage(enemy, ram.damage);
              }
              enemy.hurtFlashTime = 0.3;
              sounds.playHit(true);

              // Khóa mục tiêu trúng đòn đầu tiên trong phạm vi <= 5m (400px)
              if (!lockedTargetIdRef.current && dist <= 400) {
                lockedTargetIdRef.current = enemy.id;
                currentTargetEnemyRef.current = enemy;
              }

              if (activeClass === 'Assassin') {
                sounds.playHeavySlash();
              } else {
                sounds.playExplosion();
              }
              addScreenShake(7.5 + ram.chargeLevel * 3.5);

              // Đẩy lùi dữ dội theo hướng lao
              const knockForce = activeClass === 'Assassin' ? 560 + ram.chargeLevel * 280 : 680 + ram.chargeLevel * 320;
              enemy.vx += ram.dirX * knockForce;
              enemy.vy += ram.dirY * knockForce;

              spawnDamageText(
                enemy.x,
                enemy.y,
                `${ram.damage}`,
                false,
                activeClass === 'Assassin',
                20
              );
              spawnParticles(enemy.x, enemy.y, activeClass === 'Assassin' ? '#c084fc' : '#ffffff', 16, 2.8);
            }
          });

          if (ram.elapsed >= ram.duration) {
            ram.active = false;
            p.isDashing = false;
            p.vx *= 0.35;
            p.vy *= 0.35;
          }
        }
      }

      // Xử lý cú nhảy cao & chậm của Tank (giữ 1s-5s -> nhảy 2m-6m, không tạo hiệu ứng xanh nước)
      if (tankLeapRef.current.active) {
        const leap = tankLeapRef.current;
        if (deathStateRef.current.isDead) {
          leap.active = false;
        } else {
          leap.elapsed += dt;
          moveX = 0;
          moveY = 0;
          p.vx = leap.vx;
          p.vy = leap.vy;

          if (leap.elapsed >= leap.airDuration) {
            leap.active = false;
            p.vx = 0;
            p.vy = 0;

            // Tiếp đất đập mạnh 2 tay xuống đất
            sounds.playExplosion();
            addScreenShake(8.5 + leap.meters * 0.6);

            const flipX = p.facingRight ? 1 : -1;
            const slamImpactX = p.x + flipX * 16;
            const slamImpactY = p.y + 10;
            const quakeRadius = 130 + (leap.meters - 1) * 18;

            enemiesRef.current.forEach((enemy) => {
              if (enemy.hp <= 0) return;
              const dist = Math.hypot(enemy.x - slamImpactX, enemy.y - slamImpactY);
              if (dist <= quakeRadius + enemy.radius) {
                enemy.hp -= leap.damage;
                recordEnemyHit(enemy, leap.damage);
                enemy.hurtFlashTime = 0.35;
                enemy.speed = Math.max(20, enemy.speed * 0.3);
                setTimeout(() => {
                  if (enemy) enemy.speed = 100;
                }, 1500);

                const kAngle = Math.atan2(enemy.y - slamImpactY, enemy.x - slamImpactX);
                enemy.vx += Math.cos(kAngle) * 390;
                enemy.vy += Math.sin(kAngle) * 390;

                sounds.playHit(true);
                spawnDamageText(enemy.x, enemy.y, `${leap.damage}!`, false, false, 18);
              }
            });
          }
        }
      }

      // Xử lý trạng thái choáng (Daze Stun) khi va đập trực diện vào vách đá
      if (dazeTimerRef.current > 0) {
        dazeTimerRef.current -= dt;
        dazeOrbitRef.current += dt * 14;
        // Khóa điều khiển phím trong thời gian bị choáng
        moveX = 0;
        moveY = 0;
      }

      let speedMult = 1.0;
      if (activeClass === 'Marksman' && p.marksmanBuffActive) {
        speedMult = 1.5; // Xạ thủ tăng 50% tốc chạy
      }
      if (isChargingRef.current && chargeProgressRef.current > 0) {
        speedMult *= 0.2; // Chỉ giảm tốc độ di chuyển khi đã thực sự bắt đầu tích lực gồng
      }
      const targetSpeed = statsRef.current.moveSpeed * speedMult;

      if (!p.isDashing && !tankRamRef.current.active && !tankLeapRef.current.active && dazeTimerRef.current <= 0 && !deathStateRef.current.isDead) {
        p.vx = moveX * targetSpeed;
        p.vy = moveY * targetSpeed;
      }

      if (!deathStateRef.current.isDead) {
        // Xử lý bước tiến từng bước khi đánh thường cho Đấu Sĩ, Sát Thủ, Đỡ Đòn
        if (attackStepMoveRef.current.active) {
          const stepMove = attackStepMoveRef.current;
          if (tankLeapRef.current.active || p.isDashing || dazeTimerRef.current > 0) {
            stepMove.active = false;
          } else {
            stepMove.elapsed += dt;
            if (stepMove.elapsed >= stepMove.delay) {
              const activeElapsed = stepMove.elapsed - stepMove.delay;
              if (activeElapsed <= stepMove.duration) {
                const tStep = Math.min(1.0, activeElapsed / stepMove.duration);
                // Xung lực bước dấn dứt khoát (nhanh ở đầu bước và ghì trụ ở cuối bước)
                const stepVel = (stepMove.stepDist / stepMove.duration) * (1 - tStep) * 2.0;
                p.x += stepMove.dirX * stepVel * dt;
                p.y += stepMove.dirY * stepVel * dt;
              } else {
                stepMove.active = false;
              }
            }
          }
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        if (onSendPlayerState && now - lastNetworkSyncTimeRef.current >= 50) {
          lastNetworkSyncTimeRef.current = now;
          onSendPlayerState({
            x: Math.round(p.x * 10) / 10,
            y: Math.round(p.y * 10) / 10,
            facingRight: p.facingRight,
            angle: p.angle,
            hp: statsRef.current.currentHp,
            maxHp: statsRef.current.maxHp,
            level: statsRef.current.level,
            hairStyle: hairStyleRef.current,
            hairColor: hairColorRef.current,
            skinColor: skinColorRef.current,
            isDashing: p.isDashing,
          });
        }

        // Hiệu ứng bụi dưới chân khi chạy (chỉ tạo khi đang chạy trên mặt đất, không đang nhảy trên không)
        const currentMoveSpeed = Math.hypot(p.vx, p.vy);
        if (currentMoveSpeed > 25 && !tankLeapRef.current.active) {
          runAnimRef.current.dustTimer += dt * (currentMoveSpeed / 190);
          if (runAnimRef.current.dustTimer >= 0.055) {
            runAnimRef.current.dustTimer = 0;
            const moveDirX = p.vx / currentMoveSpeed;
            const moveDirY = p.vy / currentMoveSpeed;
            const footSide = Math.sin(runAnimRef.current.phase) >= 0 ? 1 : -1;
            const footBaseX = p.x - moveDirX * 6 + footSide * 4.2;
            const footBaseY = p.y + 11.5 - moveDirY * 2.5;
            const dustColors = ['#e2e8f0', '#cbd5e1', '#d6d3d1', '#a8a29e'];
            const puffCount = 2;
            for (let d = 0; d < puffCount; d++) {
              const spreadAngle = Math.atan2(-moveDirY, -moveDirX) + (Math.random() - 0.5) * 0.85;
              const puffSpeed = (0.35 + Math.random() * 0.55) * (currentMoveSpeed / 210);
              particlesRef.current.push({
                id: Math.random().toString(),
                x: footBaseX + (Math.random() - 0.5) * 4,
                y: footBaseY + (Math.random() - 0.5) * 2.5,
                vx: Math.cos(spreadAngle) * puffSpeed,
                vy: Math.sin(spreadAngle) * (puffSpeed * 0.5) - (0.25 + Math.random() * 0.35),
                color: dustColors[Math.floor(Math.random() * dustColors.length)],
                size: Math.random() * 2.4 + 2.0,
                alpha: 0.65,
                life: 0,
                maxLife: 0.24 + Math.random() * 0.14,
                drag: 0.90,
                layer: 'ground',
              });
            }
          }
        } else {
          runAnimRef.current.dustTimer = 0;
        }

        // Theo dõi đứng yên 3 giây: Chỉ khi đứng yên đủ 3 giây liên tục mới mất cộng dồn trừ mana
        const isPlayerStill =
          currentMoveSpeed < 5 &&
          !p.isDashing &&
          !tankRamRef.current.active &&
          !tankLeapRef.current.active &&
          !attackStepMoveRef.current.active &&
          !swingAnimRef.current.active &&
          !isChargingRef.current;

        if (isPlayerStill) {
          standingStillTimerRef.current += dt;
          if (standingStillTimerRef.current >= 3.0) {
            attackComboStackRef.current = 0;
          }
        } else {
          standingStillTimerRef.current = 0;
        }
      }

      // ================= GIỚI HẠN RANH GIỚI BẢN ĐỒ =================
      clampPlayerPosition(p, DEFAULT_FOREST_BOUNDS);

      // Giới hạn quái vật không vượt qua ranh giới bản đồ
      enemiesRef.current.forEach((enemy) => {
        enemy.x = Math.max(-DEFAULT_FOREST_BOUNDS.forestBoundX, Math.min(DEFAULT_FOREST_BOUNDS.forestBoundX, enemy.x));
        enemy.y = Math.max(-DEFAULT_FOREST_BOUNDS.forestBoundY, Math.min(DEFAULT_FOREST_BOUNDS.forestBoundY, enemy.y));
      });

      // Explore Fog of War tiles around player
      const isoHalfW = 42;
      const isoHalfH = 23;
      const pCol = Math.floor((p.x / isoHalfW + p.y / isoHalfH) / 2);
      const pRow = Math.floor((p.y / isoHalfH - p.x / isoHalfW) / 2);
      for (let c = pCol - 6; c <= pCol + 6; c++) {
        for (let r = pRow - 6; r <= pRow + 6; r++) {
          exploredTilesRef.current.add(`${c}_${r}`);
        }
      }


      // Charge Logic: Chỉ cho phép gồng khi KHÔNG cầm vũ khí (tay không)
      if (hasSwordRef.current) {
        isAttackHeldRef.current = false;
        isChargingRef.current = false;
        chargeProgressRef.current = 0;
        tankLastNotifiedSecRef.current = 0;
      } else if (isAttackHeldRef.current) {
        const heldMs = performance.now() - attackHoldStartTimeRef.current;
        if (activeClass === 'Tank') {
          // Tank: Giữ chiêu sau 0.75s (750ms) mới bắt đầu gồng lực, thời gian gồng 6s (6000ms) để đạt max tầm 3m (Bỏ bộ đếm chữ)
          const holdDelay = 750;
          const chargeTime = 6000;
          const progress = heldMs < holdDelay ? 0 : Math.min(1.0, (heldMs - holdDelay) / chargeTime);
          chargeProgressRef.current = progress;

          if (progress >= 1.0 && !chargeMaxNotifiedRef.current) {
            chargeMaxNotifiedRef.current = true;
          }

          // Hạt năng lượng trắng cuộn hút vào người Tank khi tụ lực (sau khi giữ >= 0.75s)
          if (progress > 0.02 && Math.random() < 0.45) {
            const gatherAngle = Math.random() * Math.PI * 2;
            const gatherDist = 26 + (1 - progress) * 22;
            const gatherSpeed = 1.8 + progress * 2.2;
            particlesRef.current.push({
              id: Math.random().toString(),
              x: p.x + Math.cos(gatherAngle) * gatherDist,
              y: p.y + Math.sin(gatherAngle) * (gatherDist * 0.6),
              vx: -Math.cos(gatherAngle) * gatherSpeed,
              vy: -Math.sin(gatherAngle) * (gatherSpeed * 0.6),
              color: '#ffffff',
              size: Math.random() * 2.2 + 1.4,
              alpha: 0.85,
              life: 0,
              maxLife: 0.28,
              drag: 0.94,
            });
          }
        } else if (activeClass === 'Assassin') {
          // Sát thủ: Tăng thời gian gồng lên hợp lý hơn (giữ sau 240ms mới bắt đầu gồng, thời gian tụ lực 1150ms mới đạt full 100%)
          const holdDelay = 240;
          const chargeTime = 1150;
          const progress = heldMs < holdDelay ? 0 : Math.min(1.0, (heldMs - holdDelay) / chargeTime);
          chargeProgressRef.current = progress;

          if (progress >= 1.0 && !chargeMaxNotifiedRef.current) {
            chargeMaxNotifiedRef.current = true;
          }

          // Hạt năng lượng trắng cuộn hút vào người Sát Thủ khi tụ lực
          if (progress > 0.02 && Math.random() < 0.48) {
            const gatherAngle = Math.random() * Math.PI * 2;
            const gatherDist = 24 + (1 - progress) * 20;
            const gatherSpeed = 2.2 + progress * 2.6;
            particlesRef.current.push({
              id: Math.random().toString(),
              x: p.x + Math.cos(gatherAngle) * gatherDist,
              y: p.y + Math.sin(gatherAngle) * (gatherDist * 0.6),
              vx: -Math.cos(gatherAngle) * gatherSpeed,
              vy: -Math.sin(gatherAngle) * (gatherSpeed * 0.6),
              color: '#ffffff',
              size: Math.random() * 2.0 + 1.2,
              alpha: 0.85,
              life: 0,
              maxLife: 0.24,
              drag: 0.94,
            });
          }
        } else {
          // Các class khác: giữ nút >= 250ms để không bị nhạy lúc tap đánh thường
          const holdDelay = 250;
          const chargeTime = 700;
          const progress = heldMs < holdDelay ? 0 : Math.min(1.0, (heldMs - holdDelay) / chargeTime);
          chargeProgressRef.current = progress;

          if (progress >= 1.0 && !chargeMaxNotifiedRef.current) {
            chargeMaxNotifiedRef.current = true;
          }
        }
      } else {
        tankLastNotifiedSecRef.current = 0;
      }

      // Giảm độ mờ của vệt kiếm (Sword Trail Decay)
      swordTrailRef.current.forEach((node) => {
        node.alpha -= dt * 5.5;
      });
      swordTrailRef.current = swordTrailRef.current.filter((node) => node.alpha > 0.05);

      // Cập nhật bộ đếm tạm thời không nhìn vào quái vật khi lướt và 0.25s sau khi lướt
      if (p.isDashing || tankRamRef.current.active) {
        postDashNoLookTimerRef.current = 0.25;
        if (p.dashVx !== 0 || p.dashVy !== 0) {
          const currentDashAngle = Math.atan2(p.dashVy, p.dashVx);
          lastDashAngleRef.current = currentDashAngle;
          lastDashFacingRightRef.current = p.dashVx >= 0;
          const localHandAngle = Math.atan2(p.dashVy, Math.abs(p.dashVx));
          lastDashHandAngleRef.current = Math.max(-1.15, Math.min(1.15, localHandAngle));
        }
      } else if (postDashNoLookTimerRef.current > 0) {
        postDashNoLookTimerRef.current = Math.max(0, postDashNoLookTimerRef.current - dt);
      }
      const isPostDashNoLook = postDashNoLookTimerRef.current > 0;

      // Aim direction: Ưu tiên tuyệt đối cho định hướng chiêu thức ở nửa phải, sau đó tới hướng di chuyển
      let targetAngle = p.angle;
      if (aimingSkillRef.current && aimingSkillRef.current.dist > 10) {
        targetAngle = aimingSkillRef.current.angle;
      } else if (Math.hypot(moveX, moveY) > 0.08) {
        targetAngle = Math.atan2(moveY, moveX);
      } else if (isPostDashNoLook) {
        targetAngle = lastDashAngleRef.current;
      } else {
        targetAngle = p.facingRight ? 0 : Math.PI;
      }

      // Tự động tìm quái vật ưu tiên máu thấp nhất, sau đó là quái gần nhất
      const priorityEnemy = getPriorityTarget();
      currentTargetEnemyRef.current = isPostDashNoLook ? null : priorityEnemy;

      // CƠ CHẾ BÀN TAY VÀ MẶT HƯỚNG VÀO QUÁI VẬT:
      if (aimingSkillRef.current && aimingSkillRef.current.dist > 10) {
        // Đang chủ động kéo định hướng chiêu: Hướng mặt theo hướng kéo chiêu
        targetAngle = aimingSkillRef.current.angle;
        p.facingRight = Math.cos(targetAngle) >= 0;
      } else if (priorityEnemy && !isPostDashNoLook) {
        // Luôn tự động hướng vào quái vật ưu tiên máu thấp nhất, gần nhất (khi KHÔNG trong thời gian lướt / 0.25s sau khi lướt)
        p.facingRight = priorityEnemy.x >= p.x;
        targetAngle = Math.atan2(priorityEnemy.y - p.y, priorityEnemy.x - p.x);
      } else {
        // Khi không có quái vật hoặc đang lướt / trong 0.25s sau khi lướt:
        // Hướng mặt và góc quay theo hướng lướt hoặc hướng di chuyển
        if (p.isDashing && (p.dashVx !== 0 || p.dashVy !== 0)) {
          targetAngle = Math.atan2(p.dashVy, p.dashVx);
          p.facingRight = p.dashVx >= 0;
        } else if (Math.hypot(p.vx, p.vy) > 15) {
          targetAngle = Math.atan2(p.vy, p.vx);
          p.facingRight = p.vx >= 0;
        } else if (Math.hypot(moveX, moveY) > 0.08) {
          targetAngle = Math.atan2(moveY, moveX);
          p.facingRight = moveX >= 0;
        } else if (isPostDashNoLook) {
          targetAngle = lastDashAngleRef.current;
          p.facingRight = lastDashFacingRightRef.current;
        } else if (moveX > 0.05) {
          p.facingRight = true;
        } else if (moveX < -0.05) {
          p.facingRight = false;
        } else if (Math.abs(Math.cos(targetAngle)) > 0.15) {
          p.facingRight = Math.cos(targetAngle) > 0;
        }
      }
      p.angle = targetAngle;

      // Nhân vật luôn giữ ở giữa màn hình khi di chuyển
      cameraRef.current.x = Number.isFinite(p.x) ? p.x : 0;
      cameraRef.current.y = Number.isFinite(p.y) ? p.y : 0;

      // ================= MELEE SLASHES =================
      slashesRef.current.forEach((slash) => {
        slash.elapsed += dt;
        const maxReach = slash.radius + 60;
        enemiesRef.current.forEach((enemy) => {
          if (enemy.hp <= 0 || slash.hitEnemyIds.has(enemy.id)) return;
          const edx = enemy.x - slash.x;
          if (Math.abs(edx) > maxReach) return;
          const edy = enemy.y - slash.y;
          if (Math.abs(edy) > maxReach) return;
          const dist = Math.hypot(edx, edy);

          // Khoảng cách từ quái đến tâm nhân vật
          const distToPlayer = Math.hypot(enemy.x - p.x, enemy.y - p.y);

          // Quái đứng sát người (< 60px): Luôn chém trúng 100% không bị hụt
          let isHit = false;
          if (distToPlayer <= p.radius + enemy.radius + 30) {
            isHit = true;
          } else if (dist < slash.radius + enemy.radius) {
            let enemyAngle = Math.atan2(edy, edx);
            let diff = Math.abs(enemyAngle - slash.angle);
            while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);

            if (slash.arc >= Math.PI * 1.9 || diff <= slash.arc / 2) {
              isHit = true;
            }
          }

          if (isHit) {
            if (slash.hitEnemyIds.has(enemy.id)) return;
            slash.hitEnemyIds.add(enemy.id);

            const appliedDmg = slash.damage;

            // Sát Thủ đánh trúng kẻ địch -> Tích tầng nội tại & đánh ra 10% sát thương chuẩn khi đủ 5 dấu ấn
            if (statsRef.current.classType === 'Assassin') {
              addAssassinStackOnHit();
              applyAssassinPassiveTrueDamage(enemy, appliedDmg);
            }

            // Khóa mục tiêu trúng chiêu chém trong phạm vi <= 5m (400px)
            if (!lockedTargetIdRef.current && distToPlayer <= 400) {
              lockedTargetIdRef.current = enemy.id;
              currentTargetEnemyRef.current = enemy;
            }

            enemy.hp -= appliedDmg;
            recordEnemyHit(enemy, appliedDmg);
            enemy.hurtFlashTime = 0.12;
            sounds.playHit(slash.isCrit);
            addScreenShake(2);

            // Hiệu ứng đẩy lùi cho tất cả đòn đánh (đẩy văng ra xa nhân vật)
            const knockAngle = Math.atan2(enemy.y - p.y, enemy.x - p.x);
            const knockForce = slash.isCrit ? 360 : 280;
            enemy.vx += Math.cos(knockAngle) * knockForce;
            enemy.vy += Math.sin(knockAngle) * knockForce;

            spawnDamageText(
              enemy.x,
              enemy.y,
              `${appliedDmg}`,
              false,
              slash.isCrit,
              15
            );
          }
        });
      });
      slashesRef.current = slashesRef.current.filter((s) => s.elapsed < s.duration);

      // ================= PROJECTILES =================
      projectilesRef.current.forEach((proj) => {
        const prevX = proj.x;
        const prevY = proj.y;
        proj.age += dt;
        // Giảm dần tốc độ khi viên đá bay càng ngày càng xa (Air Resistance / Drag)
        if (proj.drag) {
          const damping = Math.exp(-proj.drag * dt);
          proj.vx *= damping;
          proj.vy *= damping;
        }
        if (proj.gravity) {
          proj.vy += proj.gravity * dt;
        }
        proj.x += proj.vx * dt;
        proj.y += proj.vy * dt;

        // Vệt hạt ánh sáng lấp lánh rơi ra khi cầu ánh sáng bay
        if (proj.projectileType === 'light_orb' && Math.random() < 0.4) {
          spawnParticles(proj.x - proj.vx * 0.01, proj.y - proj.vy * 0.01, '#ffffff', 1, 1.2);
        }

        // Hiệu ứng luồng sóng xung kích xé gió khi viên đá Xạ Thủ full lực bay siêu nhanh
        if (proj.projectileType === 'stone' && (proj as any).isFullChargeStone) {
          const pAngle = Math.atan2(proj.vy, proj.vx);
          const perpX = -Math.sin(pAngle);
          const perpY = Math.cos(pAngle);
          for (let side of [-1, 1]) {
            emitPooledParticle({
              x: proj.x - Math.cos(pAngle) * 4 + perpX * side * 3,
              y: proj.y - Math.sin(pAngle) * 4 + perpY * side * 3,
              vx: perpX * side * (1.8 + Math.random() * 1.2) - Math.cos(pAngle) * 1.2,
              vy: perpY * side * (1.8 + Math.random() * 1.2) - Math.sin(pAngle) * 1.2,
              color: '#ffffff',
              size: Math.random() * 2.0 + 1.4,
              alpha: 0.85,
              life: 0,
              maxLife: 0.16,
              drag: 0.88,
            });
          }
        }

        if (proj.source === 'player') {
          const maxTravel = Math.max(Math.abs(proj.vx * dt), Math.abs(proj.vy * dt)) + proj.radius + 40;
          enemiesRef.current.forEach((enemy) => {
            if (proj.pierce <= 0 || enemy.hp <= 0) return;
            // Kiểm tra nhanh bounding box trước (Spatial / Distance Check nhanh trước)
            if (Math.abs(enemy.x - proj.x) > maxTravel || Math.abs(enemy.y - proj.y) > maxTravel) {
              return;
            }

            // Kiểm tra va chạm liên tục trên đoạn thẳng (Swept Segment-Circle Collision) để đạn nhanh không bao giờ xuyên lọt qua mục tiêu
            const segX = proj.x - prevX;
            const segY = proj.y - prevY;
            const segLenSq = segX * segX + segY * segY;
            let closestX = proj.x;
            let closestY = proj.y;
            if (segLenSq > 0.0001) {
              const tProj = Math.max(0, Math.min(1, ((enemy.x - prevX) * segX + (enemy.y - prevY) * segY) / segLenSq));
              closestX = prevX + tProj * segX;
              closestY = prevY + tProj * segY;
            }
            const dist = Math.hypot(enemy.x - closestX, enemy.y - closestY);
            if (dist < enemy.radius + proj.radius) {
              proj.pierce--;
              sounds.playHit(proj.isCrit);

              // Sát Thủ đánh trúng -> Tích tầng nội tại (đánh trúng mới tích tầng, tối đa 5 tầng)
              if (statsRef.current.classType === 'Assassin') {
                addAssassinStackOnHit();
              }

              // Phi Tiêu Dấu Ấn (Sát Thủ Chiêu 2): Đánh dấu mục tiêu trong 5s (không cộng sẵn damage, recordEnemyHit sẽ ghi nhận chuẩn xác)
              if (proj.projectileType === 'giant_shuriken') {
                assassinMarksRef.current.set(enemy.id, {
                  enemyId: enemy.id,
                  startTime: performance.now(),
                  duration: 5.0,
                  accumulatedDamage: 0,
                });
              }

              // Khóa mục tiêu trúng đạn trong phạm vi <= 5m (400px)
              const hitProjDist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
              if (!lockedTargetIdRef.current && hitProjDist <= 400) {
                lockedTargetIdRef.current = enemy.id;
                currentTargetEnemyRef.current = enemy;
              }

              // Sát thương của Pháp Sư và Xạ Thủ theo khoảng cách: càng xa damage càng bé
              let appliedDmg = proj.damage;
              if (proj.projectileType === 'light_orb' || proj.projectileType === 'stone' || (proj as any).isRangedShot) {
                const distFromPlayer = Math.hypot(enemy.x - p.x, enemy.y - p.y);
                const maxRange = (proj as any).maxRange || (activeClass === 'Marksman' ? 420 : 380);
                // Càng xa damage càng bé (gần: 100%, xa nhất: 35%)
                const distFactor = Math.max(0.35, 1.0 - (distFromPlayer / maxRange) * 0.65);
                appliedDmg = Math.max(1, Math.round(proj.damage * distFactor));
              }

              // Xuyên giáp cộng dồn từ nội tại Đấu Sĩ (10% + 2%/cấp) & Xạ Thủ (5% + 1.5%/cấp) nếu đã lĩnh ngộ
              const curUnlocks = skillSystemRef.current.unlockedClasses;
              const curPLvls = skillSystemRef.current.passiveLevels;
              const fighterPen = curUnlocks.includes('Fighter') ? 0.10 + (curPLvls.Fighter || 0) * 0.02 : 0;
              const marksmanPen = curUnlocks.includes('Marksman') ? 0.05 + (curPLvls.Marksman || 0) * 0.015 : 0;
              const armorPen = fighterPen + marksmanPen;
              if (armorPen > 0) {
                appliedDmg = Math.round(appliedDmg * (1 + armorPen * 0.5));
              }

              if (proj.isAoe) {
                sounds.playExplosion();
                addScreenShake(4);
                if (proj.projectileType === 'light_orb') {
                  spawnParticles(proj.x, proj.y, '#ffffff', 8, 3.5);
                  spawnParticles(proj.x, proj.y, '#fef08a', 6, 2.8);
                } else {
                  spawnParticles(proj.x, proj.y, proj.trailColor, 8, 3.2);
                }
                const aoeR = proj.aoeRadius || 60;
                const aoeRSq = aoeR * aoeR;
                enemiesRef.current.forEach((e2) => {
                  if (e2.hp <= 0) return;
                  const adx = e2.x - proj.x;
                  if (Math.abs(adx) > aoeR) return;
                  const ady = e2.y - proj.y;
                  if (Math.abs(ady) > aoeR) return;
                  if (adx * adx + ady * ady < aoeRSq) {
                    e2.hp -= appliedDmg;
                    e2.hurtFlashTime = 0.15;
                    // Hiệu ứng đẩy lùi
                    const knockAngle = Math.atan2(e2.y - p.y, e2.x - p.x);
                    e2.vx += Math.cos(knockAngle) * 260;
                    e2.vy += Math.sin(knockAngle) * 260;
                    spawnDamageText(
                      e2.x,
                      e2.y,
                      `${appliedDmg}`,
                      proj.projectileType === 'light_orb' || activeClass === 'Mage',
                      proj.isCrit,
                      15
                    );
                  }
                });
                proj.age = proj.maxLifetime;
              } else {
                enemy.hp -= appliedDmg;
                recordEnemyHit(enemy, appliedDmg);
                if (statsRef.current.classType === 'Assassin') {
                  applyAssassinPassiveTrueDamage(enemy, appliedDmg);
                }
                enemy.hurtFlashTime = 0.12;

                if (proj.projectileType === 'stone') {
                  spawnParticles(proj.x, proj.y, '#94a3b8', 5, 2.2);
                  spawnParticles(proj.x, proj.y, '#64748b', 4, 1.8);
                }

                // Xạ thủ gồng full lực: đẩy lùi cực mạnh và xa (70px) kèm sóng xung kích nổ bung tại mục tiêu
                if ((proj as any).knockbackDist) {
                  const kb = (proj as any).knockbackDist;
                  const pAngle = Math.atan2(proj.vy, proj.vx);
                  enemy.x += Math.cos(pAngle) * kb;
                  enemy.y += Math.sin(pAngle) * kb;
                  enemy.vx += Math.cos(pAngle) * 450;
                  enemy.vy += Math.sin(pAngle) * 450;
                  addScreenShake(5.5);
                  spawnParticles(enemy.x, enemy.y, '#ffffff', 8, 3.2);
                  spawnParticles(enemy.x, enemy.y, '#94a3b8', 6, 2.5);
                  // Vòng sóng xung kích tròn lan tỏa khi viên đá siêu thanh va chạm (Pooled)
                  for (let r = 0; r < 12; r++) {
                    const rAng = (r / 12) * Math.PI * 2;
                    const rSpd = 4.2 + Math.random() * 0.8;
                    emitPooledParticle({
                      x: proj.x + Math.cos(rAng) * 4,
                      y: proj.y + Math.sin(rAng) * 4,
                      vx: Math.cos(rAng) * rSpd,
                      vy: Math.sin(rAng) * rSpd,
                      color: r % 2 === 0 ? '#ffffff' : '#e2e8f0',
                      size: 2.5,
                      alpha: 0.95,
                      life: 0,
                      maxLife: 0.24,
                      drag: 0.90,
                    });
                  }
                } else if (proj.projectileType === 'giant_shuriken') {
                  // Phi Tiêu Dấu Ấn (Sát Thủ Chiêu 2): Không gây đẩy lùi (No knockback)
                } else {
                  // Hiệu ứng đẩy lùi thông thường
                  const knockAngle = Math.atan2(enemy.y - p.y, enemy.x - p.x);
                  enemy.vx += Math.cos(knockAngle) * 240;
                  enemy.vy += Math.sin(knockAngle) * 240;
                }

                spawnDamageText(
                  enemy.x,
                  enemy.y,
                  `${appliedDmg}`,
                  proj.projectileType === 'light_orb' || activeClass === 'Mage',
                  proj.isCrit,
                  15
                );
              }
            }
          });
        }
      });
      projectilesRef.current = projectilesRef.current.filter((p) => p.age < p.maxLifetime && p.pierce > 0);

      // Xử lý nổ Dấu Ấn Sát Thủ (Phi Tiêu Dấu Ấn - Chiêu 2): Sau 5s phát nổ gây 50% ST chuẩn và hồi 30% sát thương thành máu
      const nowMsMark = performance.now();
      assassinMarksRef.current.forEach((mark, enemyId) => {
        const enemy = enemiesRef.current.find((e) => e.id === enemyId);
        if (!enemy || enemy.hp <= 0) {
          assassinMarksRef.current.delete(enemyId);
          return;
        }
        const markElapsed = (nowMsMark - mark.startTime) / 1000;
        if (markElapsed >= 5.0) {
          // Phát nổ sau 5s!
          const trueDmg = Math.max(1, Math.round(mark.accumulatedDamage * 0.5));
          enemy.hp -= trueDmg;
          recordEnemyHit(enemy, trueDmg);
          enemy.hurtFlashTime = 0.25;

          // Sát thương chuẩn màu trắng, KHÔNG có chữ "chuẩn"
          spawnFloatingText(enemy.x, enemy.y, `${trueDmg}`, '#ffffff', 22, true);

          // Hồi 30% sát thương thành máu cho Sát Thủ (chỉ hiện số xanh không cần + và HP)
          const healHp = Math.max(1, Math.round(trueDmg * 0.3));
          setStats((prev) => ({
            ...prev,
            currentHp: Math.min(prev.maxHp, prev.currentHp + healHp),
          }));
          spawnFloatingText(p.x, p.y - 30, `${healHp}`, '#22c55e', 18, true);

          sounds.playExplosion();
          addScreenShake(6.0);
          spawnParticles(enemy.x, enemy.y, '#c084fc', 22, 4.0);
          spawnParticles(enemy.x, enemy.y, '#ffffff', 14, 3.0);

          assassinMarksRef.current.delete(enemyId);
        }
      });

      // Update Enemies với culling quái vật ngoài tầm nhìn
      enemiesRef.current.forEach((enemy) => {
        if (enemy.hp <= 0) {
          if (lockedTargetIdRef.current === enemy.id) {
            lockedTargetIdRef.current = null;
            currentTargetEnemyRef.current = null;
          }
          sounds.playHit(true);

          // Tính toán Luck (tỉ lệ rơi đồ - full 100%)
          const curEq = equippedRef.current;
          const curAttr = attributesRef.current;
          const eqLuck = (curEq.necklace?.luckBonus || 0) + (curEq.ring?.luckBonus || 0);
          const effectiveLuck = Math.min(1.0, 0.05 + (curAttr.luckPoints || 0) * 0.01 + eqLuck);

          // Tăng lượng vàng nhận theo Luck
          const bonusGoldRate = Math.random() < effectiveLuck ? Math.ceil(enemy.goldDrop * (0.5 + effectiveLuck * 0.5)) : 0;
          const finalGoldDrop = enemy.goldDrop + bonusGoldRate;

          const redDropChance = Math.min(1.0, 0.45 + effectiveLuck * 0.55);
          const shouldDropRed = enemy.type === 'brute' || enemy.type === 'spitter' || Math.random() < redDropChance;
          let gainedRed = 0;
          if (shouldDropRed) {
            gainedRed = enemy.type === 'brute' ? 3 : enemy.type === 'spitter' ? 2 : 1;
            if (effectiveLuck >= 0.5 && Math.random() < effectiveLuck) {
              gainedRed += 1;
            }
          }

          // EXP & Level Up System (Nội tại Pháp Sư cộng dồn vĩnh viễn: tăng 5% + 2%/cấp kinh nghiệm nhận vào)
          const baseExpGain = enemy.type === 'brute' ? 60 : enemy.type === 'scout' ? 35 : enemy.type === 'spitter' ? 45 : 25;
          const hasMageExpPassive = skillSystemRef.current.unlockedClasses.includes('Mage');
          const mageExpMult = hasMageExpPassive
            ? 1.05 + (skillSystemRef.current.passiveLevels.Mage || 0) * 0.02
            : 1.0;
          const expGain = Math.round(baseExpGain * mageExpMult);

          // 1. Cộng trực tiếp EXP cho người chơi ngay khi tiêu diệt quái
          awardExp(expGain);

          // 2. Sinh thêm các viên ngọc kinh nghiệm xanh lam văng ra rực rỡ và tự động bay về phía người chơi
          spawnExpOrbs(enemy.x, enemy.y, Math.round(expGain * 0.5));

          setStats((prev) => ({
            ...prev,
            killCount: prev.killCount + 1,
            gold: prev.gold + finalGoldDrop,
            redCurrency: (prev.redCurrency ?? 0) + gainedRed,
          }));

          return;
        }

        if (enemy.hurtFlashTime > 0) enemy.hurtFlashTime -= dt;

        // Xử lý riêng cho Nhân Vật Đầu Trọc (Test Sát Thương & DPS - Không di chuyển, không tấn công, tự hồi máu)
        if (enemy.isDummy || enemy.type === 'dummy') {
          enemy.vx = 0;
          enemy.vy = 0;
          enemy.hp = enemy.maxHp;

          if (enemy.wobbleTimer && enemy.wobbleTimer > 0) {
            enemy.wobbleTimer -= dt;
          }

          // 1. Tự động Reset sát thương: ngừng nhận sát thương quá 10 giây -> Reset về 0
          const timeSinceLastHit = (now - (enemy.lastDamageTakenTime || now)) / 1000;
          if (enemy.totalDamageTaken && enemy.totalDamageTaken > 0 && timeSinceLastHit >= 10.0) {
            enemy.totalDamageTaken = 0;
            enemy.dps = 0;
            enemy.recentDamageHistory = [];
            spawnFloatingText(enemy.x, enemy.y - 75, '🔄 Đã Reset Sát Thương (10s)', '#cbd5e1', 13, false);
          } else if (enemy.recentDamageHistory && enemy.recentDamageHistory.length > 0) {
            enemy.recentDamageHistory = enemy.recentDamageHistory.filter((item) => now - item.time <= 3000);
            const sumDmg = enemy.recentDamageHistory.reduce((acc, curr) => acc + curr.damage, 0);
            enemy.dps = Math.round(sumDmg / 3.0);
          } else {
            enemy.dps = 0;
          }

          return;
        }

        // Tạm đóng băng AI / Pathfinding trong 0.5 giây đầu khi bấm Chơi
        if (aiFreezeTimerRef.current > 0) {
          enemy.vx = 0;
          enemy.vy = 0;
          return;
        }

        const edx = p.x - enemy.x;
        const edy = p.y - enemy.y;

        // Bỏ qua tính toán AI và đòn đánh phức tạp nếu quái ở quá xa màn hình
        if (Math.abs(edx) > 1200 || Math.abs(edy) > 900) {
          enemy.x += enemy.vx * dt;
          enemy.y += enemy.vy * dt;
          return;
        }

        const distSq = edx * edx + edy * edy;
        const distToPlayer = Math.sqrt(distSq);

        if (distToPlayer > 18) {
          enemy.vx += ((edx / distToPlayer) * enemy.speed - enemy.vx) * 0.1;
          enemy.vy += ((edy / distToPlayer) * enemy.speed - enemy.vy) * 0.1;
        } else {
          enemy.vx *= 0.8;
          enemy.vy *= 0.8;
        }

        enemy.x += enemy.vx * dt;
        enemy.y += enemy.vy * dt;

        const touchReach = p.radius + enemy.radius;
        if (distSq < touchReach * touchReach) {
          // Giảm tốc đánh quái vật: mỗi quái vật có thời gian hồi đòn đánh (1.2s - 1.6s mỗi đòn) thay vì rút máu liên tục mỗi frame
          const enemyAttackInterval = enemy.type === 'brute' ? 1600 : enemy.type === 'scout' ? 1200 : 1400;
          if (!enemy.lastShootTime) {
            enemy.lastShootTime = now - enemyAttackInterval * 0.65;
          }
          if (now - enemy.lastShootTime >= enemyAttackInterval) {
            enemy.lastShootTime = now;
            if (!p.shieldActive && !deathStateRef.current.isDead) {
              setStats((prev) => {
                // Nội tại Đỡ Đòn cộng dồn vĩnh viễn khi đã học (10% + 1.5%/cấp), không cần đổi class
                const hasTankPassive = skillSystemRef.current.unlockedClasses.includes('Tank');
                const dmgReduct = hasTankPassive
                  ? 0.10 + (skillSystemRef.current.passiveLevels.Tank || 0) * 0.015
                  : 0;
                const rawIncoming = enemy.damage * (1 - dmgReduct);
                const defReduct = Math.max(0.15, 1 - ((prev.defense || 10) + (prev.attributes?.defPoints || 0) * 2) * 0.008);
                let appliedIncoming = Math.max(1, Math.round(rawIncoming * defReduct));

                // Giáp ảo hấp thụ sát thương (dùng được cho mọi class nếu kích hoạt Kim Cương Thể)
                if (p.tankShieldTimer > 0 && p.tankShieldHp > 0) {
                  const absorb = Math.min(p.tankShieldHp, appliedIncoming);
                  p.tankShieldHp = Math.max(0, p.tankShieldHp - absorb);
                  appliedIncoming -= absorb;
                  if (p.tankShieldHp <= 0) {
                    p.tankShieldTimer = 0; // mất giáp hoàn toàn
                  }
                }

                const newHp = Math.max(0, prev.currentHp - appliedIncoming);
                if (newHp <= 0 && !deathStateRef.current.isDead) {
                  triggerPlayerDeath();
                }
                return { ...prev, currentHp: newHp, shieldHp: p.tankShieldHp };
              });
              addScreenShake(1.5);
            } else if (p.shieldActive) {
              enemy.hp -= enemy.damage * 0.8;
              spawnParticles(p.x, p.y, '#38bdf8', 5, 2);
            }
          }
        }
      });
      enemiesRef.current = enemiesRef.current.filter((e) => e.hp > 0);

      // ================= 3. CƠ CHẾ VA CHẠM THEO BÓNG ĐỔ (SHADOW-BASED COLLISION PUSHBACK) =================
      // Sử dụng vòng tròn bóng đổ dưới chân nhân vật và mục tiêu (người chơi, quái vật, nhân vật trọc) làm hộp va chạm.
      // Khi 2 bóng dưới chân va chạm/đè lên nhau, tự động đẩy nhẹ 2 entity ra hai hướng ngược nhau để khoảng cách giữa 2 tâm bóng không bị chồng lấn.
      // Lưu ý: Chỉ đẩy xa vừa đủ ra khỏi phạm vi bóng dưới chân, KHÔNG gây khống chế, KHÔNG gây choáng (stun), và không kích hoạt hiệu ứng hình ảnh phụ.
      const pFootX = p.x;
      const pFootY = p.y + 13.5;
      const pFootR = 15;

      enemiesRef.current.forEach((enemy) => {
        if (enemy.hp <= 0) return;
        const isTargetDummy = enemy.isDummy || enemy.type === 'dummy';
        const eFootX = enemy.x;
        const eFootY = isTargetDummy ? enemy.y + 13.5 : enemy.y + enemy.radius * 0.82;
        const eFootR = isTargetDummy ? 15 : enemy.radius * 0.70;

        const dx = pFootX - eFootX;
        const dy = pFootY - eFootY;
        const distSq = dx * dx + dy * dy;
        const minFootDist = pFootR + eFootR;

        // Trạng thái di chuyển của người chơi & đối tượng
        const pIsMoving = Math.hypot(moveX, moveY) > 0.08 || Math.hypot(p.vx, p.vy) > 15 || p.isDashing || tankRamRef.current.active;
        const eIsMoving = !isTargetDummy && Math.hypot(enemy.vx, enemy.vy) > 10;

        if (distSq < minFootDist * minFootDist && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const overlap = minFootDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;

          if (pIsMoving && !eIsMoving) {
            // Người chơi di chuyển đâm vào đối tượng đứng im: Đối tượng đứng im không bị đẩy lùi, người chơi bị bật ra
            p.x += nx * overlap;
            p.y += ny * overlap;
          } else if (!pIsMoving && eIsMoving) {
            // Đối tượng di chuyển đâm vào người chơi đứng im: Người chơi đứng im không bị đẩy lùi, đối tượng bị bật ra
            enemy.x -= nx * overlap;
            enemy.y -= ny * overlap;
          } else {
            // Cả hai cùng di chuyển hoặc cùng đứng im: chia đôi khoảng cách đẩy lùi
            p.x += nx * overlap * 0.5;
            p.y += ny * overlap * 0.5;
            enemy.x -= nx * overlap * 0.5;
            enemy.y -= ny * overlap * 0.5;
          }
        } else if (distSq <= 0.0001) {
          if (pIsMoving) {
            p.x += 1;
          } else {
            enemy.x -= 1;
          }
        }
        if (!Number.isFinite(enemy.x) || !Number.isFinite(enemy.y)) {
          enemy.x = 0;
          enemy.y = 0;
        }
      });

      // Va chạm giữa các quái vật thường với nhau để không dẫm đè bóng lên nhau
      for (let i = 0; i < enemiesRef.current.length; i++) {
        const e1 = enemiesRef.current[i];
        if (e1.hp <= 0 || e1.isDummy || e1.type === 'dummy') continue;
        const e1FootY = e1.y + e1.radius * 0.82;
        const e1FootR = e1.radius * 0.70;

        for (let j = i + 1; j < enemiesRef.current.length; j++) {
          const e2 = enemiesRef.current[j];
          if (e2.hp <= 0 || e2.isDummy || e2.type === 'dummy') continue;
          const e2FootY = e2.y + e2.radius * 0.82;
          const e2FootR = e2.radius * 0.70;

          const edx = e1.x - e2.x;
          const edy = e1FootY - e2FootY;
          const edistSq = edx * edx + edy * edy;
          const minEDist = e1FootR + e2FootR;

          if (edistSq < minEDist * minEDist && edistSq > 0.0001) {
            const edist = Math.sqrt(edistSq);
            const eOverlap = minEDist - edist;
            const enx = edx / edist;
            const eny = edy / edist;

            const e1IsMoving = Math.hypot(e1.vx, e1.vy) > 10;
            const e2IsMoving = Math.hypot(e2.vx, e2.vy) > 10;

            if (e1IsMoving && !e2IsMoving) {
              e1.x += enx * eOverlap;
              e1.y += eny * eOverlap;
            } else if (!e1IsMoving && e2IsMoving) {
              e2.x -= enx * eOverlap;
              e2.y -= eny * eOverlap;
            } else {
              e1.x += enx * eOverlap * 0.5;
              e1.y += eny * eOverlap * 0.5;
              e2.x -= enx * eOverlap * 0.5;
              e2.y -= eny * eOverlap * 0.5;
            }
          }
        }
      }

      // ================= CẬP NHẬT & HÚT NAM CHÂM VỚI NGỌC EXP / VẬT PHẨM =================
      const nowMsGems = performance.now();
      const pLocX = p.x;
      const pLocY = p.y;

      for (let gIdx = goldGemsRef.current.length - 1; gIdx >= 0; gIdx--) {
        const gem = goldGemsRef.current[gIdx];
        const age = (nowMsGems - gem.createdTime) / 1000;

        // Ma sát làm chậm chuyển động nảy văng ban đầu
        gem.vx *= 0.90;
        gem.vy *= 0.90;
        gem.x += gem.vx * dt;
        gem.y += gem.vy * dt;

        // Độ nảy nổ trên mặt đất
        if (gem.bounceHeight > 0) {
          gem.bounceHeight = Math.max(0, gem.bounceHeight - dt * 25);
        }

        // Khoảng cách tới người chơi
        const gdx = pLocX - gem.x;
        const gdy = pLocY - gem.y;
        const distToPlayer = Math.hypot(gdx, gdy);

        // BÁN KÍNH HÚT NAM CHÂM (Vacuum Magnet Pull): Ngọc EXP hút từ xa 360px, vàng/đá hút từ 220px
        const magnetRadius = gem.currencyType === 'exp' ? 360 : 220;
        if (distToPlayer < magnetRadius) {
          const pullForce = (gem.currencyType === 'exp' ? 480 : 380) + (magnetRadius - distToPlayer) * 4.2;
          const pullAngle = Math.atan2(gdy, gdx);
          gem.x += Math.cos(pullAngle) * pullForce * dt;
          gem.y += Math.sin(pullAngle) * pullForce * dt;
        }

        // BÁN KÍNH NHẶT VẬT PHẨM (Pickup Range <= 28px)
        if (distToPlayer <= 28) {
          if (gem.currencyType === 'exp' || !gem.currencyType) {
            awardExp(gem.value);
            spawnParticles(gem.x, gem.y, '#00ffff', 6, 2.5);
            spawnParticles(gem.x, gem.y, '#ffffff', 4, 1.8);
          } else if (gem.currencyType === 'gold') {
            setStats((s) => ({ ...s, gold: s.gold + gem.value }));
          } else if (gem.currencyType === 'red') {
            setStats((s) => ({ ...s, redCurrency: (s.redCurrency || 0) + gem.value }));
            spawnFloatingText(gem.x, gem.y - 18, `+${gem.value}`, '#ef4444', 12);
          }
          goldGemsRef.current.splice(gIdx, 1);
        } else if (age > 60) {
          // Tự biến mất sau 60 giây nếu không nhặt
          goldGemsRef.current.splice(gIdx, 1);
        }
      }

      // ================= 4b. CẬP NHẬT KHU VỰC SINH QUÁI (5M) & HIỆU ỨNG TỤ HẠT TRẮNG - ĐỎ =================
      const spawner = spawnerZoneRef.current;
      const distToSpawner = Math.hypot(p.x - spawner.x, p.y - spawner.y);
      const isPlayerInSpawnerRange = distToSpawner <= spawner.triggerRadius;

      if (isPlayerInSpawnerRange && !deathStateRef.current.isDead && playerSpawnTimerRef.current <= 0) {
        const livingMonsters = enemiesRef.current.filter((e) => e.hp > 0 && !e.isDummy).length;
        const pendingCount = monsterSpawnAnimsRef.current.length;
        const totalMonsters = livingMonsters + pendingCount;

        // Tổng số lượng quái trong cùng 1 thời điểm không quá 15 con
        if (totalMonsters < spawner.maxMonsters && (now - spawner.lastSpawnTime) >= spawner.spawnCooldown * 1000) {
          spawner.lastSpawnTime = now;
          // Triệu hồi 1-2 con mỗi lần
          const canSpawn = Math.min(spawner.maxMonsters - totalMonsters, Math.floor(Math.random() * 2) + 1);
          for (let s = 0; s < canSpawn; s++) {
            const ang = Math.random() * Math.PI * 2;
            const d = 40 + Math.random() * 85;
            const targetMx = spawner.x + Math.cos(ang) * d;
            const targetMy = spawner.y + Math.sin(ang) * (d * 0.65);
            triggerMonsterSpawnInPlace(targetMx, targetMy);
          }
        }
      }

      // Cập nhật hoạt ảnh tụ hạt trắng - đỏ tại chỗ của quái vật
      for (let i = monsterSpawnAnimsRef.current.length - 1; i >= 0; i--) {
        const anim = monsterSpawnAnimsRef.current[i];
        anim.timer += dt;
        if (anim.timer >= anim.duration) {
          // Hoàn thành tụ hạt: Quái vật xuất hiện chính thức
          enemiesRef.current.push({
            id: anim.id,
            type: anim.enemyType,
            name: anim.name,
            x: anim.x,
            y: anim.y,
            vx: 0,
            vy: 0,
            radius: anim.radius,
            hp: anim.hp,
            maxHp: anim.maxHp,
            speed: anim.speed,
            damage: anim.damage,
            color: anim.color,
            goldDrop: anim.goldDrop,
            hurtFlashTime: 0,
          });

          // Bùng nổ hạt trắng đỏ nhẹ tại chỗ
          spawnParticles(anim.x, anim.y, '#ffffff', 8, 2.5);
          spawnParticles(anim.x, anim.y, '#ef4444', 8, 2.5);

          monsterSpawnAnimsRef.current.splice(i, 1);
        }
      }


      // ================= 5. CẬP NHẬT ĐÁM MÂY ĐỔ BÓNG NỀN ĐẤT =================
      cloudShadowsRef.current.forEach((c) => {
        c.x += c.speedX * dt;
        c.y += c.speedY * dt;
        if (c.x > 3000) c.x = -3000;
        if (c.y > 3000) c.y = -3000;
      });

      // ================= 6. CẬP NHẬT CHU KỲ THỜI TIẾT (2% TỈ LỆ KÍCH HOẠT MỖI CHU KỲ 20 PHÚT) =================
      const nowSec = now / 1000;
      const current20MinCycle = Math.floor(nowSec / 1200);
      if (current20MinCycle !== weatherCycleIndexRef.current) {
        weatherCycleIndexRef.current = current20MinCycle;
        // Tỉ lệ kích hoạt ngẫu nhiên 2% cho mỗi chu kỳ ngày - đêm (20 phút)
        const nextStorm = Math.random() < 0.02;
        if (nextStorm !== weatherStateRef.current.isStormActive) {
          weatherStateRef.current.isStormActive = nextStorm;
          if (nextStorm) {
            weatherStateRef.current.lightningTimer = 4 + Math.random() * 6;
            weatherStateRef.current.stormDurationTimer = 60.0; // Mưa rơi tối đa trong 1 phút (60s)
            sounds.startRainAndWind();
          } else {
            sounds.stopRainAndWind();
          }
        }
      }

      // Cập nhật mưa và sấm sét khi giông bão đang hoạt động trong không gian bản đồ thế giới (toàn map)
      const weather = weatherStateRef.current;
      if (weather.isStormActive) {
        // Tăng dần độ đậm của lớp layer tối khi trời mưa: Khiến trời mưa tối hơn ban đêm (max alpha 0.85 vs đêm 0.78)
        weather.darkOverlayAlpha = Math.min(0.85, weather.darkOverlayAlpha + dt * 0.45);

        // Đếm ngược thời gian mưa tối đa trong 1 phút (60 giây)
        weather.stormDurationTimer -= dt;

        // Tính toán giai đoạn tạnh mưa trong 15 giây cuối cùng (từ 15s -> 0s)
        let targetMaxDrops = 38; // Giảm xuống 38 hạt mưa để tối ưu hiệu năng tuyệt đối, loại bỏ hoàn toàn giật lag
        if (weather.stormDurationTimer <= 15) {
          // Tiến độ tạnh mưa từ 0.0 -> 1.0
          const clearingProgress = Math.max(0, Math.min(1, 1 - (weather.stormDurationTimer / 15)));

          // 1. Tiếng mưa dần dần biến mất theo tiến độ tạnh mưa
          const rainVolumeFactor = Math.max(0, 1.0 - clearingProgress);
          sounds.setRainVolumeFactor(rainVolumeFactor);

          // 2. Những hạt mưa sẽ thưa thớt dần
          targetMaxDrops = Math.max(0, Math.round(38 * (1 - clearingProgress)));
        } else {
          sounds.setRainVolumeFactor(1.0);
        }

        // Mưa tạnh hẳn sau khi hết thời gian 1 phút
        if (weather.stormDurationTimer <= 0) {
          weather.isStormActive = false;
          weather.stormDurationTimer = 0;
          weather.rainDrops = [];
          weather.rainSplashes = [];
          sounds.stopRainAndWind();
          weather.lightningStrike = null;
          weather.lightningFlashAlpha = 0;
          weather.isClearingDarkLayer = true; // Bắt đầu làm lớp layer tối dần dần biến mất sau khi mưa đã tạnh hẳn
        }

        const camX = cameraRef.current.x || p.x || 0;
        const camY = cameraRef.current.y || p.y || 0;
        const worldW = (window.innerWidth || 1920) + 400;
        const worldH = (window.innerHeight || 1080) + 400;
        const wMinX = camX - worldW / 2;
        const wMaxX = camX + worldW / 2;
        const wMinY = camY - worldH / 2;
        const wMaxY = camY + worldH / 2;

        // Khởi tạo hạt mưa có tọa độ chạm đất trong tầm nhìn nếu còn thiếu (Tối đa 38 hạt nhẹ nhàng)
        while (weather.rainDrops.length < targetMaxDrops) {
          const gx = wMinX + Math.random() * worldW;
          const gy = wMinY + Math.random() * worldH;
          const speed = 780 + Math.random() * 260;
          const fallDist = 160 + Math.random() * 240;
          const currentFall = fallDist * Math.random();
          weather.rainDrops.push({
            x: gx + (currentFall / speed) * 200,
            y: gy - currentFall,
            groundX: gx,
            groundY: gy,
            length: 16 + Math.random() * 16,
            speed,
            alpha: 0.45 + Math.random() * 0.35,
          });
        }

        // Cập nhật hạt mưa: Hạt mưa rơi nghiêng và CHẠM XUỐNG ĐẤT, thưa thớt dần khi sắp tạnh
        for (let i = weather.rainDrops.length - 1; i >= 0; i--) {
          const drop = weather.rainDrops[i];
          drop.x -= 200 * dt;
          drop.y += drop.speed * dt;

          // Khi hạt mưa chạm xuống mặt đất (drop.y >= drop.groundY):
          if (drop.y >= drop.groundY) {
            // Tạo gợn sóng nước vỡ tan ngay tại điểm chạm đất trên map (giới hạn tối đa 12 gợn sóng)
            if (weather.rainSplashes.length < 12 && targetMaxDrops > 0) {
              weather.rainSplashes.push({
                x: drop.groundX,
                y: drop.groundY,
                r: 0.8,
                maxR: 4.5 + Math.random() * 5.5,
                alpha: 0.65,
              });
            }

            // Nếu số lượng hạt mưa hiện tại nhiều hơn targetMaxDrops (đang thưa thớt dần), loại bỏ hạt mưa này luôn
            if (weather.rainDrops.length > targetMaxDrops) {
              weather.rainDrops.splice(i, 1);
              continue;
            }

            // Tái tạo hạt mưa mới bắt đầu rơi xuống một vị trí đất khác trong tầm nhìn
            const newGx = wMinX + Math.random() * worldW;
            const newGy = wMinY + Math.random() * worldH;
            const speed = 780 + Math.random() * 260;
            const fallDist = 160 + Math.random() * 240;
            drop.groundX = newGx;
            drop.groundY = newGy;
            drop.speed = speed;
            drop.length = 16 + Math.random() * 16;
            drop.alpha = 0.45 + Math.random() * 0.35;
            drop.x = newGx + (fallDist / speed) * 200;
            drop.y = newGy - fallDist;
          } else if (drop.x < wMinX - 300 || drop.x > wMaxX + 300 || drop.y < wMinY - 400 || drop.y > wMaxY + 300) {
            // Khi camera di chuyển, đưa hạt mưa về lại trong tầm nhìn
            const newGx = wMinX + Math.random() * worldW;
            const newGy = wMinY + Math.random() * worldH;
            const speed = 780 + Math.random() * 260;
            const fallDist = 160 + Math.random() * 240;
            drop.groundX = newGx;
            drop.groundY = newGy;
            drop.speed = speed;
            drop.x = newGx + (fallDist / speed) * 200;
            drop.y = newGy - fallDist;
          }
        }

        // Tạo thêm gợn sóng nước tự nhiên rải rác khắp bề mặt map trong tầm nhìn
        if (targetMaxDrops > 10 && weather.rainSplashes.length < 10 && Math.random() < 0.20) {
          weather.rainSplashes.push({
            x: wMinX + Math.random() * worldW,
            y: wMinY + Math.random() * worldH,
            r: 1,
            maxR: 5 + Math.random() * 6,
            alpha: 0.55 + Math.random() * 0.25,
          });
        }

        // Cập nhật gợn sóng nước trên mặt đất
        for (let i = weather.rainSplashes.length - 1; i >= 0; i--) {
          const s = weather.rainSplashes[i];
          s.r += dt * 24;
          s.alpha -= dt * 2.2;
          if (s.alpha <= 0 || s.r >= s.maxR) {
            weather.rainSplashes.splice(i, 1);
          }
        }

        // Đếm ngược xuất hiện sấm sét: Giảm bớt tần suất sấm (tăng khoảng cách 22 - 38 giây)
        weather.lightningTimer -= dt;
        if (weather.lightningTimer <= 0) {
          weather.lightningTimer = 22 + Math.random() * 16; // 22 - 38 giây mỗi lần sấm sét

          weather.lightningStrike = {
            active: true,
            timer: 0,
            thunderDelay: 0,
            thunderTriggered: false,
          };
        }
      }

      // Sau khi mưa tạnh hẳn: Lớp layer tối dần dần biến mất (tan biến trong ~3 giây) & dọn sạch mảng hạt mưa
      if (!weather.isStormActive) {
        if (weather.darkOverlayAlpha > 0) {
          weather.darkOverlayAlpha = Math.max(0, weather.darkOverlayAlpha - dt * 0.28);
          if (weather.darkOverlayAlpha <= 0) {
            weather.isClearingDarkLayer = false;
          }
        }
        // Dọn dẹp hoàn toàn mảng hạt mưa và gợn nước để tuyệt đối không có hạt mưa nào dừng/đọng lại trên màn hình
        weather.rainDrops = [];
        weather.rainSplashes = [];
      }

      // Xử lý chớp sáng & âm thanh sấm sét + chấn động mặt đất (ÂM THANH SẤM & HIỆU ỨNG RUNG ĐẾN CÙNG 1 LÚC 100%)
      if (weather.lightningStrike && weather.lightningStrike.active) {
        const strike = weather.lightningStrike;
        strike.timer += dt;

        // Phát âm thanh sấm nổ rền & chấn động mặt đất ĐỒNG THỜI CÙNG LÚC 100% (t=0) ngay khi cú sấm sét giáng xuống
        if (!strike.thunderTriggered) {
          strike.thunderTriggered = true;
          // 1. Kích hoạt âm thanh sấm sét ngay lập tức
          sounds.playRandomThunder();
          // 2. Chấn động mặt đất mạnh mẽ ngay lập tức ở cùng khung hình (t=0)
          thunderShakeRef.current = {
            active: true,
            intensity: 15.0, // Chấn động sấm sét cực mạnh tức thì
            duration: 1.85,  // Duy trì nhịp rung rền chấn động mặt đất kéo dài 1.85s đồng bộ 100% với âm thanh sấm
            elapsed: 0,
          };
        }

        // Chớp sáng màn hình diễn ra đồng thời tại thời điểm cú sấm sét nổ
        if (strike.timer < 0.04) {
          weather.lightningFlashAlpha = 0.38;
        } else if (strike.timer < 0.08) {
          weather.lightningFlashAlpha = Math.max(0.04, 0.38 - ((strike.timer - 0.04) / 0.04) * 0.34);
        } else if (strike.timer < 0.13) {
          weather.lightningFlashAlpha = 0.32;
        } else if (strike.timer < 0.22) {
          weather.lightningFlashAlpha = Math.max(0, 0.32 - ((strike.timer - 0.13) / 0.09) * 0.32);
        } else {
          weather.lightningFlashAlpha = 0;
        }

        // Kết thúc sự kiện sấm sét khi âm thanh sấm & chấn động mặt đất kết thúc
        if (strike.timer >= 1.85) {
          weather.lightningStrike = null;
          weather.lightningFlashAlpha = 0;
        }
      }

      // Update Gold & Red Gems
      goldGemsRef.current.forEach((gem) => {
        const gdx = p.x - gem.x;
        const gdy = p.y - gem.y;
        const dist = Math.hypot(gdx, gdy);

        if (dist < 140) {
          gem.vx += (gdx / dist) * 450 * dt;
          gem.vy += (gdy / dist) * 450 * dt;
        } else {
          gem.vx *= 0.95;
          gem.vy *= 0.95;
        }

        gem.x += gem.vx * dt;
        gem.y += gem.vy * dt;

        if (dist < p.radius + 12) {
          sounds.playCoin();
          if (gem.currencyType === 'red') {
            setStats((prev) => ({ ...prev, redCurrency: (prev.redCurrency ?? 0) + gem.value }));
            spawnFloatingText(gem.x, gem.y, `+${gem.value}`, '#f87171', 13);
            spawnParticles(gem.x, gem.y, '#ef4444', 6, 2.2);
          } else {
            setStats((prev) => ({ ...prev, gold: prev.gold + gem.value }));
            spawnFloatingText(gem.x, gem.y, `+${gem.value}`, '#fbbf24', 13);
            spawnParticles(gem.x, gem.y, '#fbbf24', 6, 2.2);
          }
          gem.value = 0;
        }
      });
      goldGemsRef.current = goldGemsRef.current.filter((g) => g.value > 0);

      // Floating Texts update - Zero-allocation Object Pool (Tối đa 32 chữ nhảy sát thương, không tạo mảng rác GC)
      floatingTextsPoolRef.current.forEach((ft) => {
        if (ft.opacity <= 0) return;
        ft.elapsed += dt;
        ft.y += ft.vy;
        ft.opacity = Math.max(0, 1 - ft.elapsed / ft.duration);
      });

      // Particles update - Zero-allocation Object Pool (Tối đa 36 hạt, không tạo mảng rác GC)
      const pool = particlePoolRef.current;
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const pt = pool[i];
        if (pt.alpha <= 0 || pt.life >= pt.maxLife) continue;
        pt.life += dt;
        if (pt.life >= pt.maxLife) {
          pt.alpha = 0;
          continue;
        }
        pt.x += pt.vx;
        pt.y += pt.vy;
        if (pt.gravity) {
          pt.vy += pt.gravity * dt;
        }
        if (pt.drag) {
          const factor = Math.pow(pt.drag, dt * 60);
          pt.vx *= factor;
          pt.vy *= factor;
        }
        pt.alpha = Math.max(0, 1 - pt.life / pt.maxLife);
      }
      }

      // ================= RENDER PASS (SẮC NÉT PIXEL ART TRÊN MÀN HÌNH RETINA / HIGH-DPI) =================
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const logicalW = window.innerWidth;
      const logicalH = window.innerHeight;
      if (canvas.width !== Math.round(logicalW * dpr) || canvas.height !== Math.round(logicalH * dpr)) {
        canvas.width = Math.round(logicalW * dpr);
        canvas.height = Math.round(logicalH * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, logicalW, logicalH);

      ctx.save();
      const halfW = logicalW / 2;
      const halfH = logicalH / 2;
      // Mở rộng diện tích tổng thể màn hình trên điện thoại (Zoom out nhẹ trên màn hình nhỏ để tầm nhìn rộng rãi, bao quát hơn)
      const isMobileScreen = Math.min(logicalW, logicalH) < 768;
      const cameraZoom = isMobileScreen ? 0.76 : 1.0;
      const viewHalfW = halfW / cameraZoom;
      const viewHalfH = halfH / cameraZoom;

      // Hiệu ứng rung màn hình khi va đập (Normal Screen Shake) & Chấn động mặt đất khi sấm nổ (Thunder Earthquake Shake - Đến cùng 1 lúc với âm thanh sấm)
      let shakeOffsetX = 0;
      let shakeOffsetY = 0;
      if (screenShakeRef.current.intensity > 0.05) {
        shakeOffsetX += (Math.random() - 0.5) * screenShakeRef.current.intensity * 2.4;
        shakeOffsetY += (Math.random() - 0.5) * screenShakeRef.current.intensity * 2.4;
        screenShakeRef.current.intensity = Math.max(0, screenShakeRef.current.intensity - dt * 26);
      }

      // Rung chấn động mặt đất khi sấm nổ: Bắt đầu ĐÚNG CÙNG 1 LÚC VỚI ÂM THANH SẤM và duy trì nhịp rung rền 1.85s
      if (thunderShakeRef.current.active) {
        const ts = thunderShakeRef.current;
        ts.elapsed += dt;
        if (ts.elapsed >= ts.duration) {
          ts.active = false;
        } else {
          const prog = ts.elapsed / ts.duration; // 0.0 -> 1.0
          let currentInt = 0;
          if (prog < 0.15) {
            // Đợt chấn động mạnh đầu tiên (Khớp 100% với cú nổ âm thanh sấm đanh)
            currentInt = ts.intensity * (1.0 - (prog / 0.15) * 0.32); // 13.5 -> 9.2
          } else {
            // Nhịp gầm rền chấn động mặt đất kéo dài theo âm đuôi tiếng sấm rền
            const decay = 1.0 - (prog - 0.15) / 0.85;
            const rumbleFreq = 0.8 + Math.sin(ts.elapsed * 38) * 0.35; // Dao động 38Hz mặt đất rung chuyển
            currentInt = 8.5 * decay * rumbleFreq;
          }
          shakeOffsetX += (Math.random() - 0.5) * currentInt * 2.6;
          shakeOffsetY += (Math.random() - 0.5) * currentInt * 2.6;
        }
      }

      ctx.translate(halfW, halfH);
      if (cameraZoom !== 1.0) {
        ctx.scale(cameraZoom, cameraZoom);
      }
      ctx.translate(-cameraRef.current.x + shakeOffsetX, -cameraRef.current.y + shakeOffsetY);

      // 1. NỀN ĐẤT & THẢM CỎ LIỀN MẠCH TOÀN BẢN ĐỒ:
      // - Toàn bộ bản đồ là nền đất/thảm cỏ tự nhiên (#81a345) liền mạch, không còn viền xanh
      // - Ranh giới di chuyển được bao bọc bởi tường sương mù dày đặc (càng ra xa sương càng dày)
      const tileW = 84;
      const tileH = 46; // 2.5D isometric tilt ratio
      const halfTileW = tileW / 2;
      const halfTileH = tileH / 2;

      const camX = cameraRef.current.x;
      const camY = cameraRef.current.y;

      const minX = camX - viewHalfW - tileW * 2;
      const maxX = camX + viewHalfW + tileW * 2;
      const minY = camY - viewHalfH - tileH * 2;
      const maxY = camY + viewHalfH + tileH * 2;

      // 1a. Tô màu nền đất cơ bản toàn bộ khung nhìn
      ctx.fillStyle = '#81a345';
      ctx.fillRect(minX - tileW, minY - tileH, (maxX - minX) + tileW * 2, (maxY - minY) + tileH * 2);

      // Define drawForestLayer function for 3D parallax layering forest border
      const zoomFactor = cameraZoom || 1.0;
      const frustumW = viewHalfW / zoomFactor;
      const frustumH = viewHalfH / zoomFactor;
      const fMinX = camX - frustumW - 120;
      const fMaxX = camX + frustumW + 120;
      const fMinY = camY - frustumH - 150;
      const fMaxY = camY + frustumH + 150;

      // Helper vẽ bóng đổ chuẩn xác dưới chân vật thể: càng vào trung tâm màu càng đậm, nhạt dần ra rìa
      function drawCenteredSoftShadow(
        sx: number,
        sy: number,
        rx: number,
        ry: number,
        centerAlpha = 0.62,
        midAlpha = 0.32
      ) {
        if (!ctx) return;
        if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(rx) || !Number.isFinite(ry)) return;
        if (rx <= 0.5 || ry <= 0.5) return;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(1, Math.max(0.01, ry / rx));
        const safeRx = Math.max(0.5, rx);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, safeRx);
        const cA = Math.max(0, Math.min(1, centerAlpha));
        const mA = Math.max(0, Math.min(1, midAlpha));
        grad.addColorStop(0, `rgba(10, 18, 8, ${cA.toFixed(3)})`);
        grad.addColorStop(0.45, `rgba(15, 25, 10, ${mA.toFixed(3)})`);
        grad.addColorStop(0.8, `rgba(20, 32, 12, ${(mA * 0.35).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(20, 32, 12, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, safeRx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 1b. Render hình ảnh mặt đất trong khu vực người chơi theo chunks, các khu vực khác giảm tải (khi người chơi đến mới load)
      const maxChunkIdx = NUM_CHUNKS_PER_AXIS - 1; // 6
      const minCx = Math.max(0, Math.min(maxChunkIdx, Math.floor((minX + MAP_BOUND) / CHUNK_SIZE)));
      const maxCx = Math.max(0, Math.min(maxChunkIdx, Math.floor((maxX + MAP_BOUND) / CHUNK_SIZE)));
      const minCy = Math.max(0, Math.min(maxChunkIdx, Math.floor((minY + MAP_BOUND) / CHUNK_SIZE)));
      const maxCy = Math.max(0, Math.min(maxChunkIdx, Math.floor((maxY + MAP_BOUND) / CHUNK_SIZE)));

      for (let cy = minCy; cy <= maxCy; cy++) {
        for (let cx = minCx; cx <= maxCx; cx++) {
          const chunkCanvas = getOrLoadMapChunk(cx, cy);
          const chunkWorldX = cx * CHUNK_SIZE - MAP_BOUND;
          const chunkWorldY = cy * CHUNK_SIZE - MAP_BOUND;
          ctx.drawImage(chunkCanvas, chunkWorldX, chunkWorldY);
        }
      }

      // Vẽ tầng sương mù mờ ảo phía sau nhân vật (Y-Sorting: Back pass)
      drawMistLayer(ctx, cameraRef.current, playerRef.current.y, 'back');

      // Giảm tải các khu vực khác: Định kỳ giải phóng các chunk cách xa người chơi khỏi bộ nhớ (khi người chơi đến mới load)
      if (now - lastChunkCleanupTimeRef.current > 2000) {
        lastChunkCleanupTimeRef.current = now;
        const p = playerRef.current;
        mapChunksRef.current.forEach((_, key) => {
          const [kcx, kcy] = key.split('_').map(Number);
          const centerWorldX = (kcx + 0.5) * CHUNK_SIZE - MAP_BOUND;
          const centerWorldY = (kcy + 0.5) * CHUNK_SIZE - MAP_BOUND;
          const dist = Math.hypot(centerWorldX - p.x, centerWorldY - p.y);
          if (dist > 1850) {
            mapChunksRef.current.delete(key);
          }
        });
      }

      // ================= 5. ĐÁM MÂY ĐỔ BÓNG NỀN ĐẤT (CLOUD SHADOWS TRÔI CHẬM TỰ NHIÊN) =================
      // Yêu cầu: 10s đầu game không xuất hiện mây, sau đó mờ nhẹ nhàng; ban đêm mờ dần và biến mất
      const elapsedSec = (performance.now() - gameStartTimeRef.current) / 1000;
      if (elapsedSec >= 10) {
        const cloudTimeFactor = Math.min(1, Math.max(0, (elapsedSec - 10) / 3));
        const dayNightNow = getDayNightLighting(dayNightTimeOffsetRef.current, performance.now());
        const cloudNightFactor = Math.max(0, 1 - (dayNightNow.curA / 0.15));

        if (cloudNightFactor > 0.01 && cloudTimeFactor > 0.01) {
          cloudShadowsRef.current.forEach((c) => {
            if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) return;
            if (c.x + c.width < minX || c.x - c.width > maxX || c.y + c.height < minY || c.y - c.height > maxY) return;
            ctx.save();
            ctx.translate(c.x, c.y);

            // Tăng độ đậm bóng mây vừa đủ nhìn rõ nét hơn trên nền đất (center opacity ~ 0.14 - 0.22)
            const baseOpacity = Math.max(0.12, Math.min(0.22, (c.opacity || 0.18) * 0.95)) * cloudNightFactor * cloudTimeFactor;
            const maxCloudRadius = Math.max(1, Math.max(c.width, c.height) * 0.5);

            c.circles.forEach((circ) => {
              if (!Number.isFinite(circ.r) || circ.r <= 1) return;
              const safeR = Math.max(1, circ.r);

              // Càng ra rìa đám mây thì phần bóng càng nhạt nhẹ
              const distFromCenter = Math.hypot(circ.dx, circ.dy);
              const cloudEdgeFactor = Math.max(0.40, 1 - (distFromCenter / maxCloudRadius) * 0.60);
              const safeOpacity = baseOpacity * cloudEdgeFactor;

              // Radial Gradient tông xanh tím than sẫm tự nhiên (R:12, G:22, B:45) cho bóng mây rõ nét mà không làm quá tối
              const grad = ctx.createRadialGradient(circ.dx, circ.dy, 0, circ.dx, circ.dy, safeR);
              grad.addColorStop(0, `rgba(12, 22, 45, ${(safeOpacity * 1.15).toFixed(3)})`);
              grad.addColorStop(0.40, `rgba(12, 22, 45, ${(safeOpacity * 0.78).toFixed(3)})`);
              grad.addColorStop(0.75, `rgba(12, 22, 45, ${(safeOpacity * 0.35).toFixed(3)})`);
              grad.addColorStop(0.92, `rgba(12, 22, 45, ${(safeOpacity * 0.10).toFixed(3)})`);
              grad.addColorStop(1, 'rgba(12, 22, 45, 0)');

              ctx.fillStyle = grad;
              ctx.beginPath();
              ctx.arc(circ.dx, circ.dy, safeR, 0, Math.PI * 2);
              ctx.fill();
            });
            ctx.restore();
          });
        }
      }

      // 3. CÂN BẰNG BÓNG ĐỔ:
      // - Bóng đổ dưới chân người chơi: Hiện dần đồng bộ với quá trình nhân vật fade-in sau khi hạt tụ lại
      {
        let playerShadowFactor = 1.0;
        if (playerSpawnTimerRef.current > 0) {
          const spawnElapsed = SPAWN_TOTAL_DURATION - playerSpawnTimerRef.current;
          if (spawnElapsed <= SPAWN_GATHER_END) {
            playerShadowFactor = 0;
          } else if (spawnElapsed <= SPAWN_FADEIN_END) {
            playerShadowFactor = (spawnElapsed - SPAWN_GATHER_END) / (SPAWN_FADEIN_END - SPAWN_GATHER_END);
          }
        }
        if (playerShadowFactor > 0.01) {
          drawCenteredSoftShadow(
            p.x,
            p.y + 13.5,
            p.radius * 1.35,
            p.radius * 0.58,
            0.90 * playerShadowFactor,
            0.52 * playerShadowFactor
          );
        }
      }

      // - Bóng đổ dưới chân mục tiêu (quái vật & nhân vật đầu trọc): Chỉnh NHẠT ĐI một chút (centerAlpha 0.38, midAlpha 0.16)
      enemiesRef.current.forEach((enemy) => {
        if (enemy.hp <= 0 || enemy.x < minX - 60 || enemy.x > maxX + 60 || enemy.y < minY - 60 || enemy.y > maxY + 60) return;
        const isTargetDummy = enemy.isDummy || enemy.type === 'dummy';
        const shadowY = isTargetDummy ? enemy.y + 13.5 : enemy.y + enemy.radius * 0.82;
        const rx = isTargetDummy ? p.radius * 1.35 : enemy.radius * 1.3;
        const ry = isTargetDummy ? p.radius * 0.58 : enemy.radius * 0.55;
        drawCenteredSoftShadow(
          enemy.x,
          shadowY,
          rx,
          ry,
          0.38, // Nhạt đi để cân bằng thị giác chung
          0.16
        );
      });

      // Gold Gems Drop Shadows
      goldGemsRef.current.forEach((gem) => {
        if (gem.x < minX - 45 || gem.x > maxX + 45 || gem.y < minY - 45 || gem.y > maxY + 45) return;
        drawCenteredSoftShadow(gem.x, gem.y + 7, 8, 4, 0.6, 0.3);
      });

      // ================= 3b. VẼ KHỐI ĐÁNH DẤU KHU VỰC SINH QUÁI (MONSTER SPAWNER BLOCK) =================
      const spawnerBlock = spawnerZoneRef.current;
      if (spawnerBlock.x >= minX - 100 && spawnerBlock.x <= maxX + 100 && spawnerBlock.y >= minY - 100 && spawnerBlock.y <= maxY + 100) {
        ctx.save();
        const distToSpawner = Math.hypot(p.x - spawnerBlock.x, p.y - spawnerBlock.y);
        const isInRange = distToSpawner <= spawnerBlock.triggerRadius;

        // 1. Bóng đổ chân bệ đá / khối
        drawCenteredSoftShadow(spawnerBlock.x, spawnerBlock.y + 14, 42, 20, 0.7, 0.35);

        // 2. Vòng ma trận triệu hồi quái vật dưới chân (Runic Circle)
        const runePulse = Math.sin(now * 0.005) * 0.2 + 0.8;
        const auraAlpha = isInRange ? 0.45 * runePulse : 0.18;
        
        ctx.save();
        ctx.translate(spawnerBlock.x, spawnerBlock.y + 10);
        ctx.scale(1, 0.55); // Góc nghiêng Isometric
        
        ctx.beginPath();
        ctx.arc(0, 0, 48, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(239, 68, 68, ${(auraAlpha * 0.4).toFixed(3)})`;
        ctx.fill();

        ctx.strokeStyle = `rgba(254, 242, 242, ${(auraAlpha * 0.9).toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, 36, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(239, 68, 68, ${(auraAlpha * 0.8).toFixed(3)})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Các ký tự Rune ma thuật xoay nhẹ quanh bệ
        const runeCount = 6;
        for (let r = 0; r < runeCount; r++) {
          const rAng = (r / runeCount) * Math.PI * 2 + now * 0.0008;
          const rx = Math.cos(rAng) * 42;
          const ry = Math.sin(rAng) * 42;
          ctx.fillStyle = r % 2 === 0 ? '#ffffff' : '#ef4444';
          ctx.fillRect(rx - 2, ry - 2, 4, 4);
        }
        ctx.restore();

        // 3. Khối sinh quái (Spawner Block) - Nếu có ảnh sẵn sẽ vẽ ảnh, nếu chưa có sẽ vẽ khối đá Isometric ma thuật
        const customSpawnerImg = partImagesRef.current.spawnerBlock;
        if (customSpawnerImg && (customSpawnerImg.naturalWidth || customSpawnerImg.width)) {
          ctx.drawImage(customSpawnerImg, spawnerBlock.x - 30, spawnerBlock.y - 35, 60, 60);
        } else {
          // Vẽ khối đá Isometric 2.5D Obsidian Runic Spawner Block
          ctx.save();
          ctx.translate(spawnerBlock.x, spawnerBlock.y - 6);

          const bw = 24; // nửa chiều rộng mặt trên
          const bh = 13; // nửa chiều cao mặt trên
          const bDepth = 26; // chiều cao khối trụ đứng

          // Mặt bên trái (Left Face - Tối hơn)
          ctx.fillStyle = '#1e1b4b'; // Dark obsidian/indigo
          ctx.beginPath();
          ctx.moveTo(-bw, 0);
          ctx.lineTo(0, bh);
          ctx.lineTo(0, bh + bDepth);
          ctx.lineTo(-bw, bDepth);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Ký tự cổ ngữ mặt trái
          ctx.strokeStyle = isInRange ? '#f87171' : '#7f1d1d';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(-bw * 0.6, bh * 0.5 + bDepth * 0.3);
          ctx.lineTo(-bw * 0.2, bh * 0.8 + bDepth * 0.6);
          ctx.lineTo(-bw * 0.4, bh * 0.3 + bDepth * 0.7);
          ctx.stroke();

          // Mặt bên phải (Right Face - Trung tính)
          ctx.fillStyle = '#312e81';
          ctx.beginPath();
          ctx.moveTo(0, bh);
          ctx.lineTo(bw, 0);
          ctx.lineTo(bw, bDepth);
          ctx.lineTo(0, bh + bDepth);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Ký tự cổ ngữ mặt phải
          ctx.strokeStyle = isInRange ? '#fca5a5' : '#991b1b';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(bw * 0.3, bh * 0.8 + bDepth * 0.4);
          ctx.lineTo(bw * 0.6, bh * 0.4 + bDepth * 0.3);
          ctx.lineTo(bw * 0.4, bh * 0.6 + bDepth * 0.7);
          ctx.stroke();

          // Mặt trên cùng (Top Face - Sáng)
          ctx.fillStyle = '#4338ca';
          ctx.beginPath();
          ctx.moveTo(0, -bh);
          ctx.lineTo(bw, 0);
          ctx.lineTo(0, bh);
          ctx.lineTo(-bw, 0);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = isInRange ? '#ffffff' : '#f87171';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          // Viên pha lê ma thuật lơ lửng trên đỉnh bệ khối (Hovering Red-White Core Crystal)
          const floatY = -bh - 14 + Math.sin(now * 0.004) * 4;
          const crysSize = 8;
          ctx.save();
          ctx.translate(0, floatY);
          ctx.rotate(Math.PI / 4 + now * 0.001);

          ctx.fillStyle = isInRange ? '#ffffff' : '#fee2e2';
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = isInRange ? 16 : 8;
          ctx.fillRect(-crysSize, -crysSize, crysSize * 2, crysSize * 2);

          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(-crysSize, -crysSize, crysSize * 2, crysSize * 2);
          ctx.restore();

          ctx.restore();
        }

        ctx.restore();
      }

      // ================= 3c. VẼ HIỆU ỨNG QUÁI XUẤT HIỆN TỤ HẠT TẠI CHỖ (CHẤM MÀU TRẮNG - ĐỎ) =================
      monsterSpawnAnimsRef.current.forEach((anim) => {
        if (anim.x < minX - 80 || anim.x > maxX + 80 || anim.y < minY - 80 || anim.y > maxY + 80) return;
        ctx.save();
        const progress = Math.min(1, anim.timer / anim.duration); // 0 -> 1

        // 1. Vòng tròn năng lượng triệu hồi dưới chân (Convergence Circle)
        const circleR = (anim.radius + 6) * (1 - progress * 0.3);
        const grad = ctx.createRadialGradient(anim.x, anim.y, 0, anim.x, anim.y, circleR);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
        grad.addColorStop(0.45, 'rgba(239, 68, 68, 0.45)');
        grad.addColorStop(0.85, 'rgba(185, 28, 28, 0.20)');
        grad.addColorStop(1, 'rgba(185, 28, 28, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(anim.x, anim.y, circleR, 0, Math.PI * 2);
        ctx.fill();

        // 2. Các hạt triệu hồi hình tam giác (Triangular Summoning Particles) màu Trắng & Đỏ tại chỗ xoáy tụ dần vào trung tâm vị trí quái
        anim.particles.forEach((pt) => {
          // Khoảng cách co dần về tâm theo tiến độ xuất hiện
          const curDist = pt.dist * (1 - progress * 0.85);
          const curAng = pt.angle + anim.timer * pt.speed * 4;
          const px = anim.x + Math.cos(curAng) * curDist;
          const py = anim.y + Math.sin(curAng) * (curDist * 0.65) - (1 - progress) * pt.height;

          const pAlpha = progress < 0.2 ? progress / 0.2 : progress > 0.85 ? (1 - progress) / 0.15 : 1;
          const pSize = pt.size * (1.1 + Math.sin(anim.timer * 12 + pt.dist) * 0.3);
          const spinAngle = curAng * 2 + anim.timer * 8;

          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(spinAngle);
          ctx.fillStyle = pt.color;
          ctx.globalAlpha = Math.max(0, Math.min(1, pAlpha));
          ctx.shadowColor = pt.color === '#ffffff' ? '#ffffff' : '#ef4444';
          ctx.shadowBlur = 5;

          // Vẽ hạt hình tam giác (Triangle Particle)
          ctx.beginPath();
          ctx.moveTo(0, -pSize * 1.35);
          ctx.lineTo(pSize * 1.0, pSize * 0.85);
          ctx.lineTo(-pSize * 1.0, pSize * 0.85);
          ctx.closePath();
          ctx.fill();

          ctx.restore();
        });

        // 3. Bóng mờ của quái vật hiện rõ dần (fade-in) khi gần hoàn thành tụ hạt
        if (progress > 0.45) {
          const bodyFadeAlpha = (progress - 0.45) / 0.55;
          ctx.globalAlpha = bodyFadeAlpha * 0.6;
          ctx.fillStyle = anim.color;
          ctx.beginPath();
          ctx.arc(anim.x, anim.y, anim.radius * progress, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      // 2. Gold, Red Currency Gems & EXP Orbs
      goldGemsRef.current.forEach((gem) => {
        if (gem.x < minX - 45 || gem.x > maxX + 45 || gem.y < minY - 45 || gem.y > maxY + 45) return;
        ctx.save();
        ctx.translate(gem.x, gem.y);
        if (gem.currencyType === 'exp') {
          // Ngọc Kinh Nghiệm xanh lam phát sáng rực rỡ
          ctx.fillStyle = '#06b6d4';
          ctx.shadowColor = '#00ffff';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(-1.5, -1.5, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else if (gem.currencyType === 'red') {
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = '#ef4444';
          ctx.shadowColor = '#dc2626';
          ctx.shadowBlur = 10;
          ctx.fillRect(-6, -6, 12, 12);
          ctx.strokeStyle = '#fca5a5';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(-6, -6, 12, 12);
        } else {
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = '#fbbf24';
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = 10;
          ctx.fillRect(-7, -7, 14, 14);
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(-7, -7, 14, 14);
        }
        ctx.restore();
      });

      // 4. Enemies (Viewport Frustum Culling)
      enemiesRef.current.forEach((enemy) => {
        if (enemy.x < minX - 60 || enemy.x > maxX + 60 || enemy.y < minY - 60 || enemy.y > maxY + 60) {
          return;
        }

        if (enemy.isDummy || enemy.type === 'dummy') {
          // ================= 2. MÔ HÌNH NHÂN VẬT ĐẦU TRỌC (THAY THẾ HOÀN TOÀN HÌNH NỘM) =================
          ctx.save();

          // Cơ chế rung lắc đàn hồi (elastic/spring recoil wobble) khi bị đánh trúng:
          let wobbleAngle = 0;
          let wobbleShiftX = 0;
          let wobbleScaleY = 1.0;
          let wobbleScaleX = 1.0;
          const wobbleT = enemy.wobbleTimer || 0;
          if (wobbleT > 0) {
            const prog = wobbleT / 0.45; // Từ 1 về 0
            const decay = Math.pow(prog, 1.4);
            const intensity = enemy.wobbleIntensity || 0.85;
            wobbleAngle = Math.sin((1 - prog) * Math.PI * 7) * 0.18 * decay * intensity;
            const hitDir = enemy.x >= p.x ? 1 : -1;
            wobbleShiftX = hitDir * Math.sin((1 - prog) * Math.PI * 5) * 4.2 * decay * intensity;
            wobbleScaleY = 1.0 - Math.sin((1 - prog) * Math.PI * 6) * 0.10 * decay * intensity;
            wobbleScaleX = 1.0 + Math.sin((1 - prog) * Math.PI * 6) * 0.08 * decay * intensity;
          }

          // Nhịp thở tự nhiên (idle breathing) khi không bị tấn công
          const idleBreathY = wobbleT <= 0 ? Math.sin(now * 0.0035) * 0.7 : 0;

          // Trọng tâm neo tại chân đế tiếp đất (enemy.x + wobbleShiftX, enemy.y + 13.5)
          ctx.translate(enemy.x + wobbleShiftX, enemy.y + 13.5);
          ctx.rotate(wobbleAngle);
          ctx.scale(wobbleScaleX, wobbleScaleY);
          ctx.translate(0, -13.5 + idleBreathY);

          // Hướng mặt quay về phía người chơi
          const facingRight = p.x > enemy.x;
          const clusterScale = 1.26; // Tỷ lệ đồng bộ 100% với người chơi
          ctx.scale((facingRight ? 1 : -1) * clusterScale, clusterScale);

          // Chớp sáng nhẹ khi nhận sát thương
          if (enemy.hurtFlashTime > 0) {
            ctx.filter = 'brightness(1.8) contrast(1.15)';
          }

          const chanTraiImg = partImagesRef.current.chanTrai;
          const chanPhaiImg = partImagesRef.current.chanPhai;
          const baseTayImg = partImagesRef.current.tay;
          const baseThanImg = partImagesRef.current.than;
          const baseDauImg = partImagesRef.current.dau;

          // 1. Chân trái (chân sau)
          if (chanTraiImg) {
            ctx.save();
            ctx.translate(-4.53, 3);
            ctx.drawImage(chanTraiImg, -4.53, -1.5, 9.06, 12.87);
            ctx.restore();
          }

          // 2. Tay trái (tay sau thân - Layer 2)
          if (baseTayImg) {
            ctx.save();
            ctx.translate(-14, -6);
            ctx.rotate(0.08);
            ctx.drawImage(baseTayImg, -24.6, -34.8, 64.8, 64.8);
            ctx.restore();
          }

          // 3. Thân người (Torso - Layer 3)
          if (baseThanImg) {
            ctx.save();
            ctx.translate(0, -4);
            ctx.drawImage(baseThanImg, -13, -6.5, 26, 14.4);
            ctx.restore();
          }

          // 4. Chân phải (chân trước - Layer 4)
          if (chanPhaiImg) {
            ctx.save();
            ctx.translate(3.5, 3);
            ctx.drawImage(chanPhaiImg, -4.53, -1.5, 9.06, 14.67);
            ctx.restore();
          }

          // 5. Tay phải (tay trước thân - Layer 5)
          if (baseTayImg) {
            ctx.save();
            ctx.translate(13, -5);
            ctx.rotate(-0.08);
            ctx.drawImage(baseTayImg, -24.6, -34.8, 64.8, 64.8);
            ctx.restore();
          }

          // 6. ĐẦU TRỌC (Hoàn toàn KHÔNG vẽ tóc - Bald head đồng bộ 100% kích thước & tỉ lệ người chơi!)
          if (baseDauImg) {
            ctx.save();
            ctx.translate(-4, -21.5);
            const baseBox = 66;
            const dW = (baseDauImg as HTMLImageElement).naturalWidth || baseDauImg.width || 1280;
            const dH = (baseDauImg as HTMLImageElement).naturalHeight || baseDauImg.height || 1472;
            let rawHeadW = baseBox;
            let rawHeadH = baseBox;
            if (dW > dH) {
              rawHeadH = baseBox * (dH / dW);
            } else {
              rawHeadW = baseBox * (dW / dH);
            }
            const headScale = 1.02;
            const headW = rawHeadW * headScale;
            const headH = rawHeadH * headScale;
            ctx.drawImage(baseDauImg, -headW / 2, -headH / 2, headW, headH);
            ctx.restore();
          }

          if (enemy.hurtFlashTime > 0) {
            ctx.filter = 'none';
          }

          ctx.restore();

          // 1. TỐI ƯU BẢNG THÔNG TIN SÁT THƯƠNG:
          // - XÓA HUD DPS CỐ ĐỊNH Ở GÓC NGOÀI MÀN HÌNH (không dùng bất kỳ HUD dính góc nào)
          // - Tự động Reset về 0 sau 10s không bị đánh
          ctx.save();
          const dpsVal = enemy.dps || 0;
          const totalDmgVal = enemy.totalDamageTaken || 0;
          const timeSinceLastHit = Math.max(0, (now - (enemy.lastDamageTakenTime || now)) / 1000);
          const resetCountdown = totalDmgVal > 0 ? Math.max(0, Math.ceil(10 - timeSinceLastHit)) : 0;

          if (totalDmgVal > 0) {
            const infoText = `DPS: ${dpsVal.toLocaleString()} | Tổng ST: ${totalDmgVal.toLocaleString()}`;
            const labelTitle = `🎯 NHÂN VẬT THỬ SÁT THƯƠNG`;

            ctx.font = 'bold 11px Inter, sans-serif';
            const textWidth = Math.max(ctx.measureText(infoText).width, ctx.measureText(labelTitle).width) + 20;
            const boxX = enemy.x - textWidth / 2;
            const boxY = enemy.y - 110;
            const boxH = 34;

            // Banner background phát sáng nhẹ
            ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 1.5;
            ctx.shadowColor = 'rgba(245, 158, 11, 0.35)';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, textWidth, boxH, 6);
            ctx.fill();
            ctx.stroke();

            // Header Title
            ctx.shadowBlur = 0;
            ctx.textAlign = 'center';
            ctx.fillStyle = '#fde047';
            ctx.font = 'bold 10px Inter, sans-serif';
            ctx.fillText(labelTitle, enemy.x, boxY + 13);

            // DPS & Total Damage text
            ctx.fillStyle = '#38bdf8';
            ctx.font = '900 11px Inter, sans-serif';
            ctx.fillText(infoText, enemy.x, boxY + 27);
          } else {
            // Khi sát thương đã reset về 0 (hoặc chưa đánh), chỉ hiển thị thẻ tên thanh thoát gọn gàng
            const labelTitle = `🎯 NHÂN VẬT THỬ SÁT THƯƠNG`;
            ctx.font = 'bold 10px Inter, sans-serif';
            const textWidth = ctx.measureText(labelTitle).width + 16;
            const boxX = enemy.x - textWidth / 2;
            const boxY = enemy.y - 95;
            const boxH = 20;

            ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, textWidth, boxH, 4);
            ctx.fill();
            ctx.stroke();

            ctx.textAlign = 'center';
            ctx.fillStyle = '#fbbf24';
            ctx.fillText(labelTitle, enemy.x, boxY + 14);
          }

          ctx.restore();

          // 4. Hiển thị Dấu Ấn Sát Thủ trên thân Nhân Vật Đầu Trọc
          if (assassinMarksRef.current.has(enemy.id)) {
            const mark = assassinMarksRef.current.get(enemy.id)!;
            const markNow = performance.now();
            const remSec = 5.0 - (markNow - mark.startTime) / 1000;
            const isNearExplode = remSec <= 1.0;
            const isBlinkInvisible = isNearExplode && Math.floor(markNow / 120) % 2 === 0;

            if (!isBlinkInvisible) {
              ctx.save();
              // Đặt ngay giữa thân nhân vật
              ctx.translate(enemy.x, enemy.y - 2);

              const pulseSpeed = isNearExplode ? 0.022 : 0.007;
              const pulseAmp = isNearExplode ? 0.35 : 0.25;
              const pulseScale = 1.0 + Math.sin(markNow * pulseSpeed) * pulseAmp;
              ctx.scale(pulseScale, pulseScale);

              const auraGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 32);
              auraGrad.addColorStop(0, 'rgba(168, 85, 247, 0.55)');
              auraGrad.addColorStop(0.65, 'rgba(147, 51, 234, 0.28)');
              auraGrad.addColorStop(1, 'rgba(147, 51, 234, 0)');
              ctx.fillStyle = auraGrad;
              ctx.beginPath();
              ctx.arc(0, 0, 32, 0, Math.PI * 2);
              ctx.fill();

              ctx.shadowColor = '#c084fc';
              ctx.shadowBlur = 18;

              ctx.fillStyle = '#e9d5ff';
              ctx.font = 'bold 28px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('💀', 0, -1);

              const prog = Math.max(0, remSec / 5.0);
              ctx.beginPath();
              ctx.arc(0, 0, 21, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog);
              ctx.strokeStyle = '#f3e8ff';
              ctx.lineWidth = 2.5;
              ctx.stroke();

              ctx.restore();
            }
          }

          return;
        }

        if (enemy.isBot || enemy.type === 'bot') {
          // ================= MÔ HÌNH BOT CHIẾN BINH / BOT ĐẤU SĨ =================
          ctx.save();

          // Cơ chế rung lắc đàn hồi khi bị đánh trúng
          let botWobbleAngle = 0;
          let botWobbleShiftX = 0;
          const bWobbleT = enemy.wobbleTimer || 0;
          if (bWobbleT > 0) {
            const prog = bWobbleT / 0.35;
            const decay = Math.pow(prog, 1.4);
            const intensity = enemy.wobbleIntensity || 0.8;
            botWobbleAngle = Math.sin((1 - prog) * Math.PI * 6) * 0.14 * decay * intensity;
            const hitDir = enemy.x >= p.x ? 1 : -1;
            botWobbleShiftX = hitDir * Math.sin((1 - prog) * Math.PI * 4) * 3.5 * decay * intensity;
          }

          // Nhịp thở tự nhiên
          const botIdleY = Math.sin(now * 0.004 + enemy.x * 2) * 0.6;

          // Bóng đổ dưới chân bot
          ctx.save();
          ctx.translate(enemy.x + botWobbleShiftX, enemy.y + 13.5);
          ctx.scale(1, 0.35);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
          ctx.beginPath();
          ctx.arc(0, 0, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Thân và các bộ phận nhân vật bot
          ctx.translate(enemy.x + botWobbleShiftX, enemy.y + 13.5);
          ctx.rotate(botWobbleAngle);
          ctx.translate(0, -13.5 + botIdleY);

          const facingRight = enemy.facingRight !== false;
          const botScale = 1.22;
          ctx.scale((facingRight ? 1 : -1) * botScale, botScale);

          if (enemy.hurtFlashTime > 0) {
            ctx.filter = 'brightness(2.2) contrast(1.2)';
          }

          const bParts = partImagesRef.current;
          if (bParts) {
            // 1. Chân trái (sau)
            if (bParts.chanTrai) {
              ctx.drawImage(bParts.chanTrai, -5.5, 3, 8.5, 12.5);
            }
            // 2. Tay trái (sau)
            if (bParts.tay) {
              ctx.save();
              ctx.translate(-13, -5);
              ctx.rotate(0.08);
              ctx.drawImage(bParts.tay, -24, -34, 62, 62);
              ctx.restore();
            }
            // 3. Thân người (Torso)
            if (bParts.than) {
              ctx.save();
              ctx.translate(0, -4);
              ctx.drawImage(bParts.than, -13, -6.5, 26, 14.4);
              ctx.restore();
            }
            // 4. Chân phải (trước)
            if (bParts.chanPhai) {
              ctx.drawImage(bParts.chanPhai, 3, 3, 8.5, 14);
            }
            // 5. Tay phải (trước) - có hoạt ảnh vung đấm khi tấn công
            if (bParts.tay) {
              const isAttacking = (enemy.attackTimer || 0) > 1.1;
              const punchRot = isAttacking ? Math.sin((1.5 - (enemy.attackTimer || 0)) * 8) * 0.45 : -0.08;
              const punchShiftX = isAttacking ? 5 : 0;
              ctx.save();
              ctx.translate(13 + punchShiftX, -5);
              ctx.rotate(punchRot);
              ctx.drawImage(bParts.tay, -24, -34, 62, 62);
              ctx.restore();
            }
            // 6. Đầu
            if (bParts.dau) {
              ctx.save();
              ctx.translate(-4, -21.5);
              ctx.drawImage(bParts.dau, -33, -33, 66, 66);
              ctx.restore();
            }
            // 7. Tóc
            const botHair = enemy.botClass === 'Assassin' ? bParts.hair_silver : enemy.botClass === 'Tank' ? bParts.hair_black : bParts.hair_red;
            if (botHair) {
              ctx.save();
              ctx.translate(-4, -23);
              ctx.drawImage(botHair, -35, -35, 70, 70);
              ctx.restore();
            }
          }

          if (enemy.hurtFlashTime > 0) {
            ctx.filter = 'none';
          }
          ctx.restore();

          // HUD trên đầu Bot: Thẻ tên viền cam & Thanh Máu
          ctx.save();
          const barW = 38;
          const barH = 3.5;
          const hpRatio = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));

          // Thẻ tên Bot
          const nameText = enemy.name || '🤖 BOT LUYỆN TẬP';
          ctx.font = 'bold 9px Inter, sans-serif';
          const nameW = ctx.measureText(nameText).width + 10;
          const nameBoxX = enemy.x - nameW / 2;
          const nameBoxY = enemy.y - 48;

          ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
          ctx.strokeStyle = 'rgba(249, 115, 22, 0.75)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(nameBoxX, nameBoxY, nameW, 14, 3);
          ctx.fill();
          ctx.stroke();

          ctx.textAlign = 'center';
          ctx.fillStyle = '#fb923c';
          ctx.fillText(nameText, enemy.x, nameBoxY + 10.5);

          // Thanh Máu Bot
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.fillRect(enemy.x - barW / 2, enemy.y - 31, barW, barH);
          ctx.fillStyle = hpRatio > 0.4 ? '#22c55e' : '#ef4444';
          ctx.fillRect(enemy.x - barW / 2, enemy.y - 31, barW * hpRatio, barH);
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
          ctx.lineWidth = 0.8;
          ctx.strokeRect(enemy.x - barW / 2, enemy.y - 31, barW, barH);

          // Dấu Ấn Sát Thủ nếu có trên Bot
          if (assassinMarksRef.current.has(enemy.id)) {
            const mark = assassinMarksRef.current.get(enemy.id)!;
            const markNow = performance.now();
            const remSec = 5.0 - (markNow - mark.startTime) / 1000;
            const isNearExplode = remSec <= 1.0;
            const isBlinkInvisible = isNearExplode && Math.floor(markNow / 120) % 2 === 0;

            if (!isBlinkInvisible) {
              ctx.save();
              ctx.translate(enemy.x, enemy.y - 2);
              const pulseSpeed = isNearExplode ? 0.022 : 0.007;
              const pulseAmp = isNearExplode ? 0.35 : 0.25;
              const pulseScale = 1.0 + Math.sin(markNow * pulseSpeed) * pulseAmp;
              ctx.scale(pulseScale, pulseScale);

              const auraGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 32);
              auraGrad.addColorStop(0, 'rgba(168, 85, 247, 0.55)');
              auraGrad.addColorStop(0.65, 'rgba(147, 51, 234, 0.28)');
              auraGrad.addColorStop(1, 'rgba(147, 51, 234, 0)');
              ctx.fillStyle = auraGrad;
              ctx.beginPath();
              ctx.arc(0, 0, 32, 0, Math.PI * 2);
              ctx.fill();

              ctx.shadowColor = '#c084fc';
              ctx.shadowBlur = 18;
              ctx.fillStyle = '#e9d5ff';
              ctx.font = 'bold 28px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('💀', 0, -1);

              const prog = Math.max(0, remSec / 5.0);
              ctx.beginPath();
              ctx.arc(0, 0, 21, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog);
              ctx.strokeStyle = '#f3e8ff';
              ctx.lineWidth = 2.5;
              ctx.stroke();
              ctx.restore();
            }
          }

          ctx.restore();
          return;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        ctx.fillStyle = enemy.hurtFlashTime > 0 ? '#ffffff' : enemy.color;
        ctx.shadowColor = enemy.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.strokeStyle = '#ffffff44';
        ctx.lineWidth = 2;
        ctx.stroke();

        const barW = enemy.radius * 2;
        const barH = 4;
        const hpPercent = Math.max(0, enemy.hp / enemy.maxHp);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(enemy.x - barW / 2, enemy.y - enemy.radius - 9, barW, barH);
        ctx.fillStyle = enemy.color;
        ctx.fillRect(enemy.x - barW / 2, enemy.y - enemy.radius - 9, barW * hpPercent, barH);

        // Hiển thị Dấu Ấn Sát Thủ (Đầu lâu tím hiện rõ trên phần thân mục tiêu, có hiệu ứng phóng to thu nhỏ nhịp nhàng để người chơi chú ý)
        if (assassinMarksRef.current.has(enemy.id)) {
          const mark = assassinMarksRef.current.get(enemy.id)!;
          const markNow = performance.now();
          const remSec = 5.0 - (markNow - mark.startTime) / 1000;
          const isNearExplode = remSec <= 1.0; // Khi còn khoảng 1 giây (sắp nổ), icon Đầu lâu tím sẽ nhấp nháy
          const isBlinkInvisible = isNearExplode && Math.floor(markNow / 120) % 2 === 0;

          if (!isBlinkInvisible) {
            ctx.save();
            // Hiển thị trực tiếp ngay trên phần thân của mục tiêu
            ctx.translate(enemy.x, enemy.y);

            // Hiệu ứng phóng to thu nhỏ nhịp nhàng (Pulsing / Breathing Scale Effect)
            const pulseSpeed = isNearExplode ? 0.022 : 0.007;
            const pulseAmp = isNearExplode ? 0.35 : 0.25;
            const pulseScale = 1.0 + Math.sin(markNow * pulseSpeed) * pulseAmp;
            ctx.scale(pulseScale, pulseScale);

            // Quầng hào quang tím ma thuật bao quanh phần thân dưới dấu ấn
            const auraGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 32);
            auraGrad.addColorStop(0, 'rgba(168, 85, 247, 0.55)');
            auraGrad.addColorStop(0.65, 'rgba(147, 51, 234, 0.28)');
            auraGrad.addColorStop(1, 'rgba(147, 51, 234, 0)');
            ctx.fillStyle = auraGrad;
            ctx.beginPath();
            ctx.arc(0, 0, 32, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowColor = '#c084fc';
            ctx.shadowBlur = 18;

            // Biểu tượng Đầu Lâu Tím sắc nét ngay giữa thân
            ctx.fillStyle = '#e9d5ff';
            ctx.font = 'bold 28px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('💀', 0, -1);

            // Vòng tiến trình đếm ngược màu tím phát sáng quanh đầu lâu
            const prog = Math.max(0, remSec / 5.0);
            ctx.beginPath();
            ctx.arc(0, 0, 21, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog);
            ctx.strokeStyle = '#f3e8ff';
            ctx.lineWidth = 2.5;
            ctx.stroke();

            ctx.restore();
          }
        }

        ctx.restore();
      });

      // 6. Projectiles
      projectilesRef.current.forEach((proj) => {
        if (proj.x < minX - 50 || proj.x > maxX + 50 || proj.y < minY - 50 || proj.y > maxY + 50) return;
        ctx.save();
        if (proj.projectileType === 'light_orb') {
          // ================= QUẢ CẦU ÁNH SÁNG (RADIANT LIGHT ORB) =================
          const nowMs = performance.now();
          const r = proj.radius;
          const pulse = Math.sin(nowMs * 0.02 + proj.x * 0.05) * 1.5;
          const curR = Math.max(4, r + pulse);

          // 1. Quầng hào quang ánh sáng thuần khiết tỏa rộng (Radiant Light Halo)
          const grad = ctx.createRadialGradient(proj.x, proj.y, curR * 0.2, proj.x, proj.y, curR * 2.2);
          grad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
          grad.addColorStop(0.35, 'rgba(254, 240, 138, 0.7)');
          grad.addColorStop(0.7, 'rgba(224, 242, 254, 0.35)');
          grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, curR * 2.2, 0, Math.PI * 2);
          ctx.fill();

          // 2. Vệt đuôi sao chổi ánh sáng kéo dài theo hướng bay (Light Trail Tail)
          const speed = Math.hypot(proj.vx, proj.vy);
          if (speed > 10) {
            const normVx = proj.vx / speed;
            const normVy = proj.vy / speed;
            const tailLen = curR * 2.5;

            const tailGrad = ctx.createLinearGradient(
              proj.x, proj.y,
              proj.x - normVx * tailLen, proj.y - normVy * tailLen
            );
            tailGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
            tailGrad.addColorStop(0.4, 'rgba(254, 240, 138, 0.55)');
            tailGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

            ctx.strokeStyle = tailGrad;
            ctx.lineWidth = curR * 1.3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(proj.x, proj.y);
            ctx.lineTo(proj.x - normVx * tailLen, proj.y - normVy * tailLen);
            ctx.stroke();
          }

          // 3. Khối cầu ánh sáng trắng tinh nguyên bản (Solid White Core)
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 18;
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, curR, 0, Math.PI * 2);
          ctx.fill();

          // 4. Các hạt ánh sáng lấp lánh xoay quanh quả cầu (Orbiting Light Motes)
          const moteCount = 4;
          for (let m = 0; m < moteCount; m++) {
            const moteAngle = (nowMs * 0.012 * (m % 2 === 0 ? 1 : -1)) + (m * Math.PI * 2 / moteCount);
            const dist = curR * 1.45;
            const mx = proj.x + Math.cos(moteAngle) * dist;
            const my = proj.y + Math.sin(moteAngle) * dist;

            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(mx, my, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (proj.projectileType === 'stone') {
          // ================= VIÊN ĐÁ XÁM CÓ ĐỘ VỒNG 2.5D & SÓNG XUNG KÍCH KHI FULL LỰC =================
          const isSonicStone = !!(proj as any).isFullChargeStone;
          const arcProg = Math.min(1.0, proj.age / proj.maxLifetime);
          const visualArcOffsetY = isSonicStone ? 0 : -Math.sin(arcProg * Math.PI) * 10;
          ctx.translate(proj.x, proj.y + visualArcOffsetY);

          // Khi full lực: Vẽ nón sóng xung kích siêu thanh (Sonic Boom Shockwave Cone & Rings) bao quanh viên đá
          if (isSonicStone) {
            const flyAngle = Math.atan2(proj.vy, proj.vx);
            ctx.save();
            ctx.rotate(flyAngle);

            // 1. Vệt luồng khí siêu thanh kéo dài phía sau
            const trailGrad = ctx.createLinearGradient(4, 0, -48, 0);
            trailGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
            trailGrad.addColorStop(0.4, 'rgba(226, 232, 240, 0.55)');
            trailGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.strokeStyle = trailGrad;
            ctx.lineWidth = proj.radius * 1.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(2, 0);
            ctx.lineTo(-48, 0);
            ctx.stroke();

            // 2. Nón sóng xung kích chữ V phá vỡ bức tường âm thanh ở mũi đá
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 8;
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.moveTo(-14, -13);
            ctx.quadraticCurveTo(4, -4, 9, 0);
            ctx.quadraticCurveTo(4, 4, -14, 13);
            ctx.stroke();

            // 3. Vòng sóng xung kích nén khí phía sau viên đá
            ctx.strokeStyle = 'rgba(241, 245, 249, 0.8)';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.ellipse(-8, 0, 3.5, 11, 0, 0, Math.PI * 2);
            ctx.stroke();

            ctx.beginPath();
            ctx.strokeStyle = 'rgba(226, 232, 240, 0.5)';
            ctx.lineWidth = 1.2;
            ctx.ellipse(-20, 0, 4.5, 14, 0, 0, Math.PI * 2);
            ctx.stroke();

            ctx.restore();
          }

          ctx.rotate(proj.age * (isSonicStone ? 24 : 12));

          // Thân viên đá xám góc cạnh (giữ nguyên kích thước chuẩn)
          ctx.fillStyle = '#94a3b8';
          ctx.strokeStyle = isSonicStone ? '#f8fafc' : '#334155';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(0, 0, proj.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Mảng sáng và tối trên bề mặt viên đá
          ctx.fillStyle = '#cbd5e1';
          ctx.beginPath();
          ctx.arc(-proj.radius * 0.28, -proj.radius * 0.28, proj.radius * 0.38, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#64748b';
          ctx.beginPath();
          ctx.arc(proj.radius * 0.25, proj.radius * 0.25, proj.radius * 0.32, 0, Math.PI * 2);
          ctx.fill();
        } else if (proj.projectileType === 'giant_shuriken') {
          // ================= ĐẠI PHI TIÊU KHỔNG LỒ XOAY 4 CÁNH (SÁT THỦ CHIÊU 2) =================
          ctx.translate(proj.x, proj.y);
          ctx.rotate(proj.age * 22);
          const r = proj.radius;

          ctx.shadowColor = '#a855f7';
          ctx.shadowBlur = 16;

          // Vòng hào quang lưỡi cắt xoay ngoài
          ctx.strokeStyle = 'rgba(192, 132, 252, 0.7)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2);
          ctx.stroke();

          // 4 cánh phi tiêu sắc bén
          for (let b = 0; b < 4; b++) {
            ctx.save();
            ctx.rotate((b * Math.PI) / 2);
            ctx.fillStyle = b % 2 === 0 ? '#e9d5ff' : '#c084fc';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(0, -4);
            ctx.lineTo(r * 1.15, 0);
            ctx.lineTo(4, 6);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }

          // Tâm phi tiêu rỗng viền trắng
          ctx.fillStyle = '#0f172a';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
          ctx.fillStyle = proj.color;
          ctx.shadowColor = proj.trailColor;
          ctx.shadowBlur = 12;
          ctx.fill();
        }
        ctx.restore();
      });

      // 7.5 Hiệu Ứng Vệt Xé Gió Khi Lướt (Sonic Wind Streaks trailing behind when dashing)
      afterimagesRef.current.forEach((img) => {
        img.alpha -= dt * (img.maxAlpha / img.duration);
        if (img.alpha > 0) {
          ctx.save();
          ctx.translate(img.x, img.y);
          ctx.globalAlpha = Math.max(0, img.alpha);

          const dirX = Math.cos(img.angle);
          const dirY = Math.sin(img.angle);
          const perpX = -dirY;
          const perpY = dirX;

          // Xé gió: Các tia khí nén siêu thanh vuốt dài ngược chiều lướt (KHÔNG vẽ vòng tròn chân màu xanh/trắng)
          ctx.lineCap = 'round';
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 8;

          // 5 vệt gió xé dài vuốt nhọn song song với hướng lướt
          const offsets = [-14, -7, 0, 7, 14];
          for (let k = 0; k < offsets.length; k++) {
            const off = offsets[k];
            const startX = perpX * off + dirX * 14;
            const startY = perpY * off + dirY * 14;
            const streakLen = 48 + Math.abs(off) * 2.5;
            const endX = perpX * off - dirX * streakLen;
            const endY = perpY * off - dirY * streakLen;

            const grad = ctx.createLinearGradient(startX, startY, endX, endY);
            grad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(1.0, img.alpha * 0.95)})`);
            grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

            ctx.strokeStyle = grad;
            ctx.lineWidth = k === 2 ? 2.4 : (k % 2 === 0 ? 1.6 : 1.2);
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
          }

          ctx.restore();
        }
      });
      afterimagesRef.current = afterimagesRef.current.filter((img) => img.alpha > 0.02);

      // 8. Player & Weapon Rendering (Logic Trái/Phải & Lớp Vẽ Trước/Sau)
      ctx.save();

      const drawWeaponShape = (wx: number, wy: number, angle: number, isRight: boolean) => {
        ctx.save();
        ctx.translate(wx, wy);
        ctx.rotate(angle);

        // Giữ vũ khí đúng chiều khi quay sang trái
        if (!isRight) {
          ctx.scale(1, -1);
        }

        if (activeClass === 'Fighter') {
          // Kiếm lớn (Greatsword)
          // Chuôi kiếm (nằm bên trong hoặc lấp sau thân)
          ctx.fillStyle = '#78350f';
          ctx.fillRect(-8, -2.5, 9, 5);
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(-8, 0, 3, 0, Math.PI * 2);
          ctx.fill();

          // Chuôi kiếm ngang (Crossguard)
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(-1, -8, 5, 16);
          ctx.fillStyle = '#fca5a5';
          ctx.fillRect(0, -6, 3, 12);

          // Lưỡi kiếm sáng bạc
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.moveTo(4, -4.5);
          ctx.lineTo(24, -2.5);
          ctx.lineTo(28, 0); // Mũi kiếm
          ctx.lineTo(24, 2.5);
          ctx.lineTo(4, 4.5);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Sống kiếm ở giữa
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(6, 0);
          ctx.lineTo(22, 0);
          ctx.stroke();
        } else if (activeClass === 'Tank') {
          // Warhammer
          ctx.fillStyle = '#64748b';
          ctx.fillRect(-6, -2.5, 22, 5);
          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(14, -10, 11, 20);
          ctx.strokeStyle = '#93c5fd';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(14, -10, 11, 20);
        } else if (activeClass === 'Assassin') {
          // Dao găm bóng đêm
          ctx.fillStyle = '#581c87';
          ctx.fillRect(-5, -2, 6, 4);
          ctx.fillStyle = '#c084fc';
          ctx.beginPath();
          ctx.moveTo(1, -3);
          ctx.lineTo(18, 0);
          ctx.lineTo(1, 3);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#e9d5ff';
          ctx.lineWidth = 1;
          ctx.stroke();
        } else if (activeClass === 'Marksman') {
          // Cung tên
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(0, 0, 14, -Math.PI / 2.2, Math.PI / 2.2);
          ctx.stroke();
          ctx.strokeStyle = '#ffffffaa';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, -13);
          ctx.lineTo(-6, 0);
          ctx.lineTo(0, 13);
          ctx.stroke();
        } else if (activeClass === 'Mage') {
          // Pháp trượng
          ctx.fillStyle = '#d97706';
          ctx.fillRect(-6, -2.5, 26, 5);
          ctx.beginPath();
          ctx.arc(23, 0, 8, 0, Math.PI * 2);
          ctx.fillStyle = '#facc15';
          ctx.shadowColor = '#facc15';
          ctx.shadowBlur = 12;
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        ctx.restore();
      };

      // Helper: Vẽ Khung Xương Nhân Vật 2D Chibi (Skeletal Rigging Model)
      const drawPlayerModel = () => {
        ctx.save();

        let characterOpacity = 1.0;
        let spawnGlowStrength = 0.0;
        if (playerSpawnTimerRef.current > 0) {
          const elapsed = SPAWN_TOTAL_DURATION - playerSpawnTimerRef.current;
          if (elapsed <= SPAWN_GATHER_END) {
            // Giai đoạn 1 (0.00s -> 0.70s): Các hạt từ khắp nơi trên màn hình đang tụ lại đúng hình dáng người chơi
            characterOpacity = 0;
            spawnGlowStrength = 0;
          } else if (elapsed <= SPAWN_FADEIN_END) {
            // Giai đoạn 2 (0.70s -> 1.25s): Sau khi tụ lại đầy đủ, nhân vật phát sáng và từ từ hiện rõ lên (fade in)
            const fadeProg = (elapsed - SPAWN_GATHER_END) / (SPAWN_FADEIN_END - SPAWN_GATHER_END);
            characterOpacity = fadeProg;
            spawnGlowStrength = Math.sin(fadeProg * Math.PI * 0.75) * 1.15;
          } else {
            // Giai đoạn 3 (1.25s -> 1.65s): Nhân vật đã hiện rõ hoàn toàn, ánh sáng dịu dần khi hạt bùng nổ ra xung quanh
            const burstProg = Math.min(1.0, (elapsed - SPAWN_FADEIN_END) / (SPAWN_TOTAL_DURATION - SPAWN_FADEIN_END));
            characterOpacity = 1.0;
            spawnGlowStrength = (1.0 - burstProg) * 0.85;
          }
        }
        if (characterOpacity <= 0.005) {
          ctx.restore();
          return;
        }
        ctx.globalAlpha = characterOpacity;

        // Quầng hào quang nhẹ quanh cơ thể nhân vật trong lúc hiện rõ dần (đã tắt ctx.filter = 'blur/drop-shadow' để tối ưu GPU)
        if (spawnGlowStrength > 0.02) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const glowRadius = 40 + spawnGlowStrength * 12;
          const auraGrad = ctx.createRadialGradient(p.x, p.y - 12, 2, p.x, p.y - 12, glowRadius);
          auraGrad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(0.9, spawnGlowStrength * 0.7).toFixed(3)})`);
          auraGrad.addColorStop(0.5, `rgba(0, 255, 255, ${Math.min(0.75, spawnGlowStrength * 0.45).toFixed(3)})`);
          auraGrad.addColorStop(1, 'rgba(0, 255, 255, 0)');
          ctx.fillStyle = auraGrad;
          ctx.beginPath();
          ctx.arc(p.x, p.y - 12, Math.max(0, glowRadius), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        const moveSpeed = Math.hypot(p.vx, p.vy);
        const isMoving = moveSpeed > 10 || p.isDashing;
        const now = performance.now();

        // 1. LOGIC TỐC ĐỘ: Tính dtAnim và tần số guồng chân tỉ lệ thuận với vận tốc di chuyển
        const dtAnim = Math.min(0.05, Math.max(0.001, (now - runAnimRef.current.lastTime) / 1000));
        runAnimRef.current.lastTime = now;

        // Tần số guồng chân (cadence): Tăng tốc độ bước chân nhanh nhẹn, guồng chân dứt khoát hơn
        const cadence = p.isDashing ? 36 : Math.max(14, Math.min(30, (moveSpeed / 160) * 24));
        if (isMoving) {
          const prevPhase = runAnimRef.current.phase;
          const nextPhase = prevPhase + cadence * dtAnim;
          runAnimRef.current.phase = nextPhase;

          // Phát âm thanh bước chân khớp chính xác với nhịp chạm đất của mỗi bên chân (mỗi nửa chu kỳ PI radian)
          if (!deathStateRef.current.isDead) {
            const prevStepCount = Math.floor(prevPhase / Math.PI);
            const nextStepCount = Math.floor(nextPhase / Math.PI);
            if (nextStepCount > prevStepCount) {
              const isRunningFast = p.isDashing || moveSpeed >= 135;
              const footSide: 'left' | 'right' = nextStepCount % 2 === 0 ? 'left' : 'right';
              sounds.playFootstep(isRunningFast, footSide);
            }
          }
        }

        // Chuyển tiếp mượt mà giữa đứng yên và chạy (smooth weight blend)
        const targetWeight = isMoving ? 1.0 : 0.0;
        runAnimRef.current.weight += (targetWeight - runAnimRef.current.weight) * Math.min(1.0, dtAnim * 16);
        const runWeight = runAnimRef.current.weight;

        // Hiệu ứng thở dịu nhẹ khi đứng yên (triệt tiêu dần khi chạy)
        const idleBob = Math.sin(now * 0.003) * 0.6 * (1 - runWeight);

        // 2. LOGIC ĐÁ CHÂN CHÉO NHAU (Scissor kick):
        // Chu kỳ sin: khi cycle > 0 -> chân phải đá về phía trước, chân trái đá về phía sau (và ngược lại)
        const runPhase = runAnimRef.current.phase;
        const cycle = Math.sin(runPhase);

        // kickL > 0: Chân trái (chân dài) vươn đá về phía trước; kickL < 0: Chân trái duỗi đá về phía sau
        const kickL = cycle * runWeight;
        // kickR ngược pha hoàn toàn với kickL: luôn đá chéo nhau đối xứng
        const kickR = -cycle * runWeight;

        // Vị trí khớp hông trên thân và mặt đất (chân dài đưa ra trước phần thân)
        const hipL_X = 5.2;
        const hipR_X = -4.5;
        const groundY = 1.5;

        // 3. GÓC ĐÁ CHÂN & QUỸ ĐẠO ĐÁ CHÂN (Áp dụng nguyên lý của tay vào: biên độ vừa phải, chuyển động mượt mà):
        // - Giảm biên độ vung từ 7.5px xuống 3.8px
        // - Góc xoay mềm mại theo nguyên lý vung tay (-k * 0.28 rad)
        // - Nhấc chân tự nhiên khi bước tới (1.8px), lướt sát đất khi duỗi sau
        const calcLegKick = (k: number, hipX: number) => {
          const dispX = k * 3.8;
          const liftY = k > 0 ? k * 1.8 : -k * 0.6;
          const kickAngle = -k * 0.28;

          return {
            x: hipX + dispX,
            y: groundY - liftY,
            angle: kickAngle,
          };
        };

        const legRightPos = calcLegKick(kickR, hipR_X);
        const legLeftPos = calcLegKick(kickL, hipL_X);

        // Trọng tâm thân người: Nhấp nhô nhịp nhàng vừa phải theo nhịp chạy (khi chết giữ nguyên tỉ lệ khung xương chuẩn torsoY = -4 để chân không bị thụt ngắn)
        const isDeadNow = deathStateRef.current.isDead;
        const stepBounce = isDeadNow ? 0 : Math.abs(Math.sin(runPhase)) * -1.0 * runWeight;
        const effectiveIdleBob = isDeadNow ? 0 : idleBob;
        const torsoY = -4 + stepBounce + effectiveIdleBob;
        let headY = -21.5 + stepBounce + effectiveIdleBob;
        let headX = -4; // Điểm neo đầu chuẩn (luôn được cập nhật gắn chặt với thân)

        // ================= VÒNG BUFF DƯỚI CHÂN (GROUND BUFF AURA RINGS) =================
        const feetY = p.y + 11.5;
        const drawGroundBuffRing = (
          color: string,
          secondaryColor: string,
          rx: number,
          ry: number,
          pulseSpeed: number,
          rotSpeed: number,
          type: 'battle_cry' | 'shield' | 'fighter_buff' | 'tank_shield' | 'mage_buff' | 'assassin_buff' | 'marksman_buff'
        ) => {
          ctx.save();
          const pulse = Math.sin(now * pulseSpeed) * 1.5;
          const curRx = rx + pulse;
          const curRy = ry + pulse * (ry / rx);

          // 1. Quầng sáng nền dịu tỏa trên mặt đất dưới chân (Soft Ground Ambient Light)
          const grad = ctx.createRadialGradient(p.x, feetY, 2, p.x, feetY, curRx * 1.25);
          const isRedGold = type === 'battle_cry' || type === 'fighter_buff' || type === 'mage_buff';
          const isGreen = type === 'marksman_buff';
          const ambientColor1 = isRedGold ? 'rgba(249, 115, 22, 0.35)' : isGreen ? 'rgba(16, 185, 129, 0.35)' : 'rgba(56, 189, 248, 0.35)';
          const ambientColor2 = isRedGold ? 'rgba(250, 204, 21, 0.18)' : isGreen ? 'rgba(52, 211, 153, 0.18)' : 'rgba(14, 165, 233, 0.18)';
          grad.addColorStop(0, ambientColor1);
          grad.addColorStop(0.5, ambientColor2);
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.ellipse(p.x, feetY, curRx * 1.25, curRy * 1.25, 0, 0, Math.PI * 2);
          ctx.fill();

          // 2. Vành tròn ma trận ngoài xoay tròn theo chiều kim đồng hồ
          ctx.save();
          ctx.translate(p.x, feetY);
          const rotAngle = (now * rotSpeed) % (Math.PI * 2);

          // Vòng chính ngoài cùng
          ctx.beginPath();
          ctx.ellipse(0, 0, curRx, curRy, 0, 0, Math.PI * 2);
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.4;
          ctx.shadowColor = color;
          ctx.shadowBlur = 12;
          ctx.setLineDash([8, 5]);
          ctx.lineDashOffset = -rotAngle * 25;
          ctx.stroke();

          // Vòng phụ bên trong xoay ngược chiều
          ctx.beginPath();
          ctx.ellipse(0, 0, curRx * 0.72, curRy * 0.72, 0, 0, Math.PI * 2);
          ctx.strokeStyle = secondaryColor;
          ctx.lineWidth = 1.6;
          ctx.shadowColor = secondaryColor;
          ctx.shadowBlur = 8;
          ctx.setLineDash([5, 4]);
          ctx.lineDashOffset = rotAngle * 20;
          ctx.stroke();

          // 3. Các nút ngọc năng lượng / ký hiệu ma pháp phân bố đều quanh vòng
          const nodeCount = type === 'shield' ? 6 : 4;
          for (let i = 0; i < nodeCount; i++) {
            const nodeAngle = rotAngle + (i * Math.PI * 2) / nodeCount;
            const nx = Math.cos(nodeAngle) * curRx;
            const ny = Math.sin(nodeAngle) * curRy;

            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(nx, ny, type === 'shield' ? 2.4 : 2.6, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();

          // 4. Các tia sáng / đốm năng lượng bay lượn từ vòng dưới chân bốc lên
          const sparkCount = 4;
          for (let s = 0; s < sparkCount; s++) {
            const seed = s * 1.57;
            const sparkAge = ((now * 0.0018 + seed) % 1);
            const sparkAngle = (now * 0.0012 + seed * 2) % (Math.PI * 2);
            const sx = p.x + Math.cos(sparkAngle) * (curRx * 0.85);
            // Bay từ chân lên ngang hông
            const sy = feetY + Math.sin(sparkAngle) * (curRy * 0.85) - sparkAge * 24;
            const alpha = Math.sin(sparkAge * Math.PI) * 0.85;

            ctx.fillStyle = type === 'battle_cry' ? `rgba(254, 240, 138, ${alpha})` : `rgba(186, 230, 253, ${alpha})`;
            ctx.shadowColor = color;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(sx, sy, 1.8 * (1 - sparkAge * 0.4), 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        };

        // Kích hoạt vòng buff dưới chân cho từng Class:
        if (activeClass === 'Fighter' && p.fighterBuffActive) {
          drawGroundBuffRing('#ef4444', '#f87171', 33, 15.5, 0.005, 0.0018, 'fighter_buff');
        }
        if (activeClass === 'Tank' && p.tankShieldTimer > 0 && p.tankShieldHp > 0) {
          drawGroundBuffRing('#3b82f6', '#60a5fa', 35, 16.5, 0.004, -0.0016, 'tank_shield');
        }
        if (activeClass === 'Mage' && p.mageBuffActive) {
          // Vòng màu vàng rực rỡ cho Pháp Sư hồi mana
          drawGroundBuffRing('#eab308', '#facc15', 33, 15.5, 0.005, 0.0018, 'mage_buff');
        }
        if (activeClass === 'Assassin' && p.assassinBuffActive) {
          drawGroundBuffRing('#a855f7', '#c084fc', 33, 15.5, 0.005, 0.0018, 'assassin_buff');
        }
        if (activeClass === 'Marksman' && p.marksmanBuffActive) {
          drawGroundBuffRing('#10b981', '#34d399', 33, 15.5, 0.005, 0.0018, 'marksman_buff');
        }

        // ================= HIỆU ỨNG LẬT MÔ HÌNH KHI ĐI TRÁI / PHẢI, NHẢY LƠ LỬNG VUNG TAY CHÂN & GẬP NGƯỜI ĐẬP ĐẤT (TANK) =================
        const swingForJump = swingAnimRef.current;
        const nowMs = performance.now();
        let tankJumpHeight = 0;
        let isTankJumpSlam = false;
        let isTankStandingSlam = false;
        let assassinScaleX = 1.0;
        let assassinScaleY = 1.0;
        let tankSlamFoldAngle = 0;
        let tankAirFlailWeight = 0;
        let tankAirElapsed = 0;
        let tankCurlTuckWeight = 0; // Độ co chân & cong người khi nhảy ở mức 1m
        let tankFallWindAlpha = 0;  // Cường độ vạch gió khi rơi từ mức >= 2m
        const currentJumpMeters = swingForJump.jumpMeters || 0;
        const isOneMeterJump = currentJumpMeters < 1.95;
        const elapsedJump = swingForJump.active ? (nowMs - swingForJump.startTime) / 1000 : 0;

        if (swingForJump.active && activeClass === 'Tank') {
          if (swingForJump.tankMode === 'jump_slam') {
            isTankJumpSlam = true;
            tankAirElapsed = elapsedJump;
            const airDur = swingForJump.airDuration || 0.83;
            const maxH = swingForJump.maxJumpHeight || 32;

            if (elapsedJump < airDur) {
              const airProg = Math.min(1.0, elapsedJump / airDur);
              if (isOneMeterJump) {
                // Mức 1 mét: KHÔNG có hiệu ứng vung chân; đổi thành hiệu ứng cong người (uỡn lấy đà rồi cuộn cong người đập mạnh xuống)
                tankAirFlailWeight = 0;
                tankJumpHeight = Math.sin(airProg * Math.PI) * maxH;
                tankCurlTuckWeight = Math.sin(airProg * Math.PI);
                if (airProg < 0.42) {
                  // Nửa đầu: bật lên đồng thời uỡn cong người ra sau lấy đà
                  const tArch = airProg / 0.42;
                  tankSlamFoldAngle = -Math.sin(tArch * (Math.PI / 2)) * 0.34;
                } else {
                  // Nửa sau: cuộn cong gập người mạnh về phía trước để đập xuống đất
                  const tCurl = (airProg - 0.42) / 0.58;
                  const easeCurl = tCurl * tCurl * (3 - 2 * tCurl);
                  tankSlamFoldAngle = -0.34 + easeCurl * 1.04;
                }
              } else {
                // Mức >= 2 mét (2m - 3m): Có vung tay chân khi lơ lửng và thêm vạch gió khi rơi xuống
                const fallStart = 0.55;
                if (airProg < fallStart) {
                  // Pha 1: Nhảy vút lên cao và lơ lửng vung tay chân
                  const tRise = airProg / fallStart;
                  const riseArc = Math.sin(tRise * (Math.PI / 2));
                  tankJumpHeight = Math.pow(Math.max(0, riseArc), 0.72) * maxH;
                  tankAirFlailWeight = Math.sin(tRise * Math.PI * 0.85);
                  tankSlamFoldAngle = Math.sin(elapsedJump * 16) * 0.14 * tankAirFlailWeight;
                } else {
                  // Pha 2: Rơi từ độ cao >= 2m xuống đất (kích hoạt vạch gió khi rơi + gập người đập xuống)
                  const tFall = (airProg - fallStart) / (1.0 - fallStart);
                  const easeFallDive = tFall * tFall;
                  tankJumpHeight = (1 - easeFallDive) * maxH;
                  // Vung tay chân giảm dần ở đầu pha rơi rồi chuyển hẳn sang gập người lao xuống
                  tankAirFlailWeight = tFall < 0.35 ? (1 - tFall / 0.35) * 0.5 : 0;
                  tankSlamFoldAngle = -0.12 + easeFallDive * 0.78;
                  // Cường độ vạch gió khi đang rơi từ >= 2m
                  tankFallWindAlpha = Math.sin(tFall * Math.PI) * Math.min(1.0, 0.75 + (currentJumpMeters - 2) * 0.25);
                }
              }
            } else {
              // Pha 3: Đã tiếp đất đập xuống, giữ tư thế gập người rồi từ từ nâng người dậy
              tankJumpHeight = 0;
              tankAirFlailWeight = 0;
              tankCurlTuckWeight = 0;
              tankFallWindAlpha = 0;
              const recDur = Math.max(0.1, swingForJump.duration - airDur);
              const tRec = Math.min(1.0, (elapsedJump - airDur) / recDur);
              const remain = 1 - tRec * tRec;
              tankSlamFoldAngle = 0.66 * remain;
            }
          } else if (swingForJump.tankMode === 'standing_slam') {
            // Đòn đánh thường thứ 3: Đập 2 tay tại chỗ (KHÔNG nhảy)
            isTankStandingSlam = true;
            tankJumpHeight = 0;
            const prog = Math.min(1.0, elapsedJump / swingForJump.duration);
            const raiseEnd = 0.36;
            const slamLand = 0.58;
            if (prog < raiseEnd) {
              const tUp = prog / raiseEnd;
              tankSlamFoldAngle = -Math.sin(tUp * (Math.PI / 2)) * 0.16;
            } else if (prog < slamLand) {
              const tDown = (prog - raiseEnd) / (slamLand - raiseEnd);
              const easeDown = tDown * tDown;
              tankSlamFoldAngle = -0.16 + easeDown * 0.74;
            } else {
              const tRec = (prog - slamLand) / (1.0 - slamLand);
              const remain = 1 - tRec * tRec;
              tankSlamFoldAngle = 0.58 * remain;
            }
          } else if (swingForJump.tankMode === 'ram_charge') {
            // Đòn gồng lao về phía trước của Tank: Thân chúi về trước, không nhảy
            isTankStandingSlam = false;
            tankJumpHeight = 0;
            const prog = Math.min(1.0, elapsedJump / swingForJump.duration);
            tankSlamFoldAngle = Math.sin(prog * Math.PI) * 0.18;
          } else if (swingForJump.tankMode === 'normal_punch') {
            // Đòn đấm thường 1 (Trái) & 2 (Phải) của Đỡ Đòn: Thân thẳng đứng chính diện, KHÔNG hướng/gập về đằng trước khi tap đấm
            isTankStandingSlam = false;
            tankJumpHeight = 0;
            tankSlamFoldAngle = 0;
          }
        } else if (swingForJump.active && activeClass === 'Assassin') {
          if (swingForJump.tankMode === 'ram_charge') {
            // Đòn gồng lao về phía trước của Sát Thủ: Thân chúi về trước lướt nhanh
            isTankStandingSlam = false;
            tankJumpHeight = 0;
            const prog = Math.min(1.0, elapsedJump / swingForJump.duration);
            tankSlamFoldAngle = Math.sin(prog * Math.PI) * 0.20;
          } else {
            // Khi tap đấm thường: Thân giữ thẳng đứng chính diện, KHÔNG hướng/gập về đằng trước
            tankSlamFoldAngle = 0;
          }
        }

        // Tính độ chuyển tiếp ngồi xuống & thu 2 tay về hông khi Tank giữ nút:
        // Đòn gồng của Đỡ Đòn chỉ có 1 animation là đòn đấm thứ 1 của Đấu Sĩ (không ngồi xuống thu tay ở hông)
        const heldMsNow = isChargingRef.current && !hasSwordRef.current ? nowMs - attackHoldStartTimeRef.current : 0;
        const isCharging =
          isChargingRef.current &&
          !hasSwordRef.current &&
          heldMsNow >= (activeClass === 'Tank' ? 750 : activeClass === 'Assassin' ? 180 : 250);
        const chargeProg = hasSwordRef.current ? 0 : chargeProgressRef.current;
        const tankCrouchBlend = 0;
        const tankCrouchDipY = 0;
        const tankCrouchFoldAngle = 0;

        // Vẽ bóng dưới mặt đất khi Tank đang bật nhảy trên không trung (càng vào tâm càng đậm)
        if (tankJumpHeight > 0.5) {
          const shadowScale = Math.max(0.38, 1 - tankJumpHeight / 160);
          drawCenteredSoftShadow(
            p.x,
            feetY,
            18 * shadowScale,
            8 * shadowScale,
            0.65 * shadowScale,
            0.32 * shadowScale
          );
        }

        ctx.save();
        ctx.translate(p.x, p.y - tankJumpHeight);
        // Phóng to toàn cụm nhân vật (x1.26) để nhân vật nổi bật và sắc nét như trong bảng xem trước
        const characterClusterScale = 1.26;
        ctx.scale((p.facingRight ? 1 : -1) * assassinScaleX * characterClusterScale, assassinScaleY * characterClusterScale);

        const isDead = deathStateRef.current.isDead;
        const deathElapsed = deathStateRef.current.elapsed;
        const deathAirH = deathStateRef.current.airHeight;
        const fallProg = isDead ? Math.min(1.0, deathElapsed / 0.34) : 0;
        const easeFall = isDead ? 1 - Math.pow(1 - fallProg, 2.4) : 0;

        if (isDead) {
          // Bay văng lên không trung rồi ngã ngửa (-90 độ = -Math.PI / 2) để thân áp sát mặt đất (offset Y = 12.5 chạm sát mặt đất)
          const supineAngle = -easeFall * (Math.PI / 2);
          ctx.translate(0, 12.5 * easeFall - deathAirH);
          ctx.rotate(supineAngle);
        }

        // THỨ TỰ XẾP LAYER THEO YÊU CẦU:
        // ĐẦU (Trên cùng) -> TAY BÊN PHẢI CỦA TÔI NẾU HƯỚNG TRÁI (NGƯỢC LẠI) -> THÂN -> 2 CHÂN (Dưới cùng)
        // Trong Canvas 2D (Painter's Algorithm): Vẽ từ dưới lên trên:
        // 1. 2 CHÂN (Dưới cùng)
        // 2. THÂN (Đè lên phía trên 2 chân)
        // 3. TAY (Đè lên phía trên thân, dưới đầu)
        // 4. ĐẦU (Trên cùng)

        // 1. LAYER 2 CHÂN (DƯỚI CÙNG):
        // - Có hiệu ứng bước chân (bước tấn tới + trụ chân sau) và phối hợp xoay hông cho mọi đòn đánh của các hệ trừ Pháp Sư & Xạ Thủ
        // - Có hiệu ứng vung chân đạp liên hoàn khi Tank đang lơ lửng trên không
        const chanTraiImg = partImagesRef.current.chanTrai;
        const chanPhaiImg = partImagesRef.current.chanPhai;
        const jumpLegTuckY = tankJumpHeight > 1 ? -Math.min(2.5, tankJumpHeight * 0.04) : 0;
        const crouchKneeSpreadX = tankCrouchBlend * 1.4;

        const chargeHand = activeClass === 'Tank' ? 'left' : chargeHandRef.current;
        const swing = swingAnimRef.current;
        const activePunchedHand = swing.activeHand || (swing.isCharged ? chargeHand : (swing.comboStep === 0 ? 'right' : 'left'));
        const isMeleeStepClass = true; // Khung xương bước chân và xoay hông áp dụng cho Đấu Sĩ, Sát Thủ, Tank, Pháp Sư & Xạ Thủ

        // Tính toán bước chân (Foot Step) & xoay hông (Hip Rotation) cho mọi đòn đánh của Đấu Sĩ, Đỡ Đòn, Sát Thủ
        let attackStepL_X = 0;
        let attackStepL_Y = 0;
        let attackStepL_Rot = 0;
        let attackStepR_X = 0;
        let attackStepR_Y = 0;
        let attackStepR_Rot = 0;
        let hipTwistRot = 0;
        let hipTwistScaleX = 1.0;
        let hipLungeShiftX = 0;

        if (isMeleeStepClass) {
          if (swing.active) {
            const elapsedStep = (nowMs - swing.startTime) / 1000;
            const progStep = Math.min(1.0, elapsedStep / swing.duration);
            const stepCurve = Math.sin(progStep * Math.PI); // 0 -> 1 -> 0
            const cLevelStep = swing.chargeLevel || 0;
            // Nhấc bàn chân lên theo vòng cung khi bước tới rồi dậm chắc xuống mặt đất
            const stepLift = progStep < 0.55 ? Math.sin((progStep / 0.55) * Math.PI) * 3.0 : 0;

            if (activeClass === 'Tank' && swing.tankMode === 'ram_charge') {
              // Đòn lao về phía trước của Tank: Guồng chân sải bước dũng mãnh đẩy lực về trước
              const ramStride = Math.sin(progStep * Math.PI * 4.5);
              attackStepR_X = ramStride * 7.0 + 3.5;
              attackStepL_X = -ramStride * 7.0 - 3.5;
              attackStepR_Rot = -ramStride * 0.32;
              attackStepL_Rot = ramStride * 0.32;
              hipTwistRot = 0.16;
              hipTwistScaleX = 0.95;
              hipLungeShiftX = 8.5 * Math.sin(progStep * Math.PI);
            } else if (activeClass === 'Tank' && swing.tankMode === 'jump_slam') {
              // Đòn nhảy đập đất của Tank: khi tiếp đất bước tấn rộng và xoay hông giáng lực
              const airDur = swing.airDuration || 0.83;
              if (elapsedStep >= airDur) {
                const recDur = Math.max(0.1, swing.duration - airDur);
                const tRec = Math.min(1.0, (elapsedStep - airDur) / recDur);
                const landHold = 1.0 - tRec * tRec;
                attackStepR_X = 5.6 * landHold;
                attackStepR_Rot = -0.32 * landHold;
                attackStepL_X = -4.2 * landHold;
                attackStepL_Rot = 0.25 * landHold;
                hipTwistRot = 0.24 * landHold;
                hipTwistScaleX = 1.0 - 0.10 * landHold;
                hipLungeShiftX = 4.2 * landHold;
              } else if (isOneMeterJump) {
                // Ở mức 1 mét: co gối gọn về sau khi uỡn người và duỗi tấn xuống khi cuộn cong người đập xuống (không vung chân)
                const airProg = Math.min(1.0, elapsedStep / airDur);
                attackStepR_X = -2.2 * tankCurlTuckWeight + (airProg > 0.5 ? (airProg - 0.5) * 6.5 : 0);
                attackStepR_Y = -3.6 * tankCurlTuckWeight;
                attackStepR_Rot = 0.32 * tankCurlTuckWeight - (airProg > 0.5 ? (airProg - 0.5) * 0.5 : 0);

                attackStepL_X = -3.4 * tankCurlTuckWeight;
                attackStepL_Y = -3.2 * tankCurlTuckWeight;
                attackStepL_Rot = 0.38 * tankCurlTuckWeight;

                hipTwistRot = airProg < 0.42 ? -0.16 * tankCurlTuckWeight : 0.26 * tankCurlTuckWeight;
                hipTwistScaleX = 1.0 - 0.10 * tankCurlTuckWeight;
                hipLungeShiftX = airProg < 0.42 ? -1.8 * tankCurlTuckWeight : 3.8 * tankCurlTuckWeight;
              } else {
                // Đang trên không (2m - 3m): xoay hông nhịp nhàng theo nhịp vung tay chân và gập người
                const airProg = Math.min(1.0, elapsedStep / airDur);
                hipTwistRot = airProg < 0.65 ? Math.sin(elapsedStep * 22) * 0.16 : 0.24;
                hipTwistScaleX = 1.0 - Math.abs(Math.sin(elapsedStep * 22)) * 0.08;
              }
            } else if (activeClass === 'Tank' && swing.tankMode === 'standing_slam') {
              // Đòn thứ 3 đập 2 tay tại chỗ của Tank: bước chân trụ tấn rộng + xoay hông gập mạnh
              const slamLift = progStep < 0.48 ? Math.sin((progStep / 0.48) * Math.PI) * 3.2 : 0;
              attackStepR_X = 5.8 * stepCurve;
              attackStepR_Y = -slamLift;
              attackStepR_Rot = -0.35 * stepCurve;
              attackStepL_X = -4.0 * stepCurve;
              attackStepL_Rot = 0.26 * stepCurve;
              hipTwistRot = (progStep < 0.36 ? -0.14 : 0.25) * stepCurve;
              hipTwistScaleX = 1.0 - 0.11 * stepCurve;
              hipLungeShiftX = 4.5 * stepCurve;
            } else {
              // Đòn đánh thường / gồng đấm (Đấu Sĩ, Sát Thủ, Tank đấm thường, Pháp Sư, Xạ Thủ):
              // Luân phiên 2 đòn:
              // - Đòn 1 (tay trái): Chân ngắn (chân trái) vươn ra trước, chân dài (chân phải) đưa ra sau 1 chút
              // - Đòn 2 (tay phải): Chân ngắn đưa ra sau 1 chút, chân dài đưa ra phía trước (tỉ lệ tọa độ và góc như đòn 1)
              const strikeDur = swing.strikeDuration || (activeClass === 'Assassin' ? 0.12 : activeClass === 'Tank' ? 0.15 : 0.14);
              const retractDur = swing.retractDuration || 0.40;
              let fastCurve = 0;
              if (elapsedStep < strikeDur) {
                const tDrive = elapsedStep / strikeDur;
                fastCurve = Math.sin(tDrive * (Math.PI / 2));
              } else {
                const tRec = Math.min(1.0, (elapsedStep - strikeDur) / retractDur);
                fastCurve = 1 - tRec * tRec;
              }
              const fastLift = elapsedStep < strikeDur * 1.5 ? Math.sin((elapsedStep / (strikeDur * 1.5)) * Math.PI) * 3.0 : 0;
              const rearPivotLift = elapsedStep < strikeDur * 1.8 ? Math.sin((elapsedStep / (strikeDur * 1.8)) * Math.PI) * 2.2 : 0;

              const strideFwd = (6.2 + cLevelStep * 2.8) * fastCurve;
              const braceBack = (4.0 + cLevelStep * 1.6) * fastCurve;
              const hipSocketTwist = 2.2 * fastCurve;

              if (activePunchedHand === 'right') {
                // ĐÒN 1 (ĐÒN LÚC CHƯA THÊM ĐÒN 2 - GIỮ NGUYÊN):
                attackStepR_X = (5.4 + cLevelStep * 2.4) * fastCurve + hipSocketTwist * 0.85;
                attackStepR_Y = -fastLift * 0.9;
                attackStepR_Rot = -0.34 * fastCurve;

                attackStepL_X = -(4.4 + cLevelStep * 1.8) * fastCurve - hipSocketTwist * 0.85;
                attackStepL_Y = -rearPivotLift;
                attackStepL_Rot = 0.34 * fastCurve;

                hipTwistRot = 0.22 * fastCurve;
                hipTwistScaleX = 1.0 - 0.13 * fastCurve;
                hipLungeShiftX = (5.5 + cLevelStep * 2.2) * fastCurve;
              } else {
                // ĐÒN 2 (MỚI THÊM):
                // - Chân dài bước dấn lên phía trước với góc xoay nhẹ -0.22 rad
                attackStepR_X = (11.5 + cLevelStep * 3.0) * fastCurve + hipSocketTwist;
                attackStepR_Y = -fastLift;
                attackStepR_Rot = -0.22 * fastCurve; // Xoay nhẹ -0.22 rad

                // - Chân ngắn lùi ra sau với góc xoay nhẹ +0.22 rad
                attackStepL_X = -(9.0 + cLevelStep * 2.5) * fastCurve - hipSocketTwist;
                attackStepL_Y = -rearPivotLift;
                attackStepL_Rot = 0.22 * fastCurve; // Xoay nhẹ +0.22 rad

                // - Thân người bị bóp vào theo đường dọc (scaleX giảm), không thay đổi độ cao, vẫn ngửa ra trước như đòn 1
                hipTwistRot = 0.22 * fastCurve;
                hipTwistScaleX = 1.0 - 0.28 * fastCurve; // Bóp dọc tạo cảm giác hông xoay
                hipLungeShiftX = (5.5 + cLevelStep * 2.2) * fastCurve;
              }
            }
          } else if (isCharging) {
            // Khi đang gồng lực (Đấu Sĩ, Sát Thủ, Tank): chân trước và chân sau mở rộng hạ trọng tâm lấy đà, không đan chéo chân
            if (chargeHand !== 'left') {
              // Đòn 2: Phục hồi dáng gồng cũ vặn xoay ngược về phía sau
              attackStepR_X = 1.6 * chargeProg;
              attackStepR_Rot = -0.12 * chargeProg;
              attackStepL_X = -2.8 * chargeProg;
              attackStepL_Rot = 0.18 * chargeProg;
              hipTwistRot = 0.28 * chargeProg;
              hipTwistScaleX = 1.0 - 0.30 * chargeProg;
              hipLungeShiftX = -1.2 * chargeProg;
            } else {
              // Đòn 1: Chân phải bước hẳn ra trước, chân trái lùi hẳn ra sau, thân xoay ra phần lưng cực kỳ dũng mãnh
              attackStepR_X = -8.2 * chargeProg; // Chân trái lùi hẳn ra sau sâu hơn nữa
              attackStepR_Rot = 0.22 * chargeProg;
              attackStepL_X = 6.2 * chargeProg; // Chân phải bước hẳn ra trước xa hơn nữa
              attackStepL_Rot = -0.18 * chargeProg;
              hipTwistRot = -0.42 * chargeProg; // Xoay ngược kim đồng hồ ~24 độ ra phần lưng
              hipTwistScaleX = 1.0 - 0.45 * chargeProg; // Co hẹp thân ngang tạo cảm giác xoắn nghiêng lưng 3D cực mạnh
              hipLungeShiftX = 1.0 * chargeProg;
            }
          }
        }

        // Hiệu ứng vung chân qua lại khi đang lơ lửng trên không trung
        const flailLegWave = tankAirFlailWeight > 0 ? Math.sin(tankAirElapsed * 24) * tankAirFlailWeight : 0;
        const flailLegCos = tankAirFlailWeight > 0 ? Math.cos(tankAirElapsed * 24) * tankAirFlailWeight : 0;

        const legL_FinalX = legLeftPos.x - crouchKneeSpreadX - flailLegWave * 6.2 + attackStepR_X;
        const legL_FinalY = legLeftPos.y + jumpLegTuckY - Math.max(0, -flailLegCos) * 2.8 + attackStepR_Y;
        const legL_FinalRot = legLeftPos.angle + tankCrouchBlend * 0.12 + flailLegWave * 0.55 + attackStepR_Rot;

        const legR_FinalX = legRightPos.x + crouchKneeSpreadX + flailLegWave * 6.2 + attackStepL_X;
        const legR_FinalY = legRightPos.y + jumpLegTuckY - Math.max(0, flailLegCos) * 2.8 + attackStepL_Y;
        const legR_FinalRot = legRightPos.angle - tankCrouchBlend * 0.14 - flailLegWave * 0.55 + attackStepL_Rot;

        // Chân trái (Left Leg - Chân ngắn vẽ dưới phần thân)
        ctx.save();
        ctx.translate(legL_FinalX, legL_FinalY);
        if (legL_FinalRot !== 0) {
          ctx.rotate(legL_FinalRot);
        }
        // Hiệu ứng co nhỏ nhẹ chân trái khi gồng Đòn 1 để tạo chiều sâu phối cảnh
        if (isCharging && chargeHand === 'left') {
          const legLScale = 1.0 - 0.12 * chargeProg;
          ctx.scale(legLScale, legLScale);
        }
        if (chanTraiImg) {
          const legL_Height = (isCharging && chargeHand === 'left') ? 12.87 - 3.0 * chargeProg : 12.87;
          ctx.drawImage(chanTraiImg, -4.53, -1.5, 9.06, legL_Height);
        }
        ctx.restore();

        // ================= HIỆU ỨNG ĐÁNH TAY & GỒNG (TANK: VUNG TAY KHI LƠ LỬNG, GẬP NGƯỜI ĐẬP ĐẤT, HOẶC ĐẤM 1 TRÁI - 1 PHẢI - 1 ĐẬP TẠI CHỖ) =================
        let punchR_X = 0;
        let punchR_Y = 0;
        let punchR_Rot = 0;
        let punchL_X = 0;
        let punchL_Y = 0;
        let punchL_Rot = 0;
        let isPunchCharged = false;
        let punchCurve = 0;
        let tankSlamDipY = 0;

        if (swing.active) {
          const elapsed = (nowMs - swing.startTime) / 1000;
          if (elapsed >= swing.duration) {
            swing.active = false;
          }
          const prog = Math.min(1.0, elapsed / swing.duration);
          punchCurve = Math.sin(prog * Math.PI); // 0 -> 1 -> 0
          isPunchCharged = !!swing.isCharged;

          const cLevel = swing.chargeLevel || 0;

          if (activeClass === 'Tank' && swing.tankMode === 'ram_charge') {
            // Đỡ đòn gồng lao về phía trước húc đổ đối thủ (Battering Ram Charge)
            // Thân và vai chúi mạnh về phía trước, hai tay gập thủ chắc chắn đón lực va chạm
            punchR_X = 26 + 12 * punchCurve;
            punchR_Y = -1;
            punchR_Rot = -0.25;

            punchL_X = -12 + 8 * punchCurve;
            punchL_Y = -2;
            punchL_Rot = 0.32;
            tankSlamDipY = 0;
          } else if (activeClass === 'Tank' && swing.tankMode === 'standing_slam') {
            // Đòn đánh thường thứ 3 của Tank: Đập 2 tay tại chỗ, không nhảy (thu tay về khoảng 0.4s)
            const strikeDur = swing.strikeDuration || 0.20;
            const retractDur = swing.retractDuration || 0.40;
            const raiseDur = strikeDur * 0.48;
            if (elapsed < raiseDur) {
              const tRaise = elapsed / raiseDur;
              const raiseFactor = Math.sin(tRaise * (Math.PI / 2));
              punchR_X = -4 * raiseFactor;
              punchR_Y = -14 * raiseFactor;
              punchR_Rot = -0.65 * raiseFactor;

              punchL_X = 14 * raiseFactor;
              punchL_Y = -14 * raiseFactor;
              punchL_Rot = -0.65 * raiseFactor;
              tankSlamDipY = -1.5 * raiseFactor;
            } else if (elapsed < strikeDur) {
              const tSlam = (elapsed - raiseDur) / (strikeDur - raiseDur);
              const easeSlam = tSlam * tSlam;
              punchR_X = -4 + easeSlam * 24;
              punchR_Y = -14 + easeSlam * 29;
              punchR_Rot = -0.65 + easeSlam * 1.22;

              punchL_X = 14 + easeSlam * 24;
              punchL_Y = -14 + easeSlam * 29;
              punchL_Rot = -0.65 + easeSlam * 1.22;
              tankSlamDipY = -1.5 + easeSlam * 6.5;
            } else {
              const tRec = Math.min(1.0, (elapsed - strikeDur) / retractDur);
              const remain = 1.0 - tRec;
              punchR_X = 20 * remain;
              punchR_Y = 15 * remain;
              punchR_Rot = 0.57 * remain;

              punchL_X = 38 * remain;
              punchL_Y = 15 * remain;
              punchL_Rot = 0.57 * remain;
              tankSlamDipY = 5.0 * remain;
            }
          } else if (activeClass === 'Tank' && swing.tankMode === 'normal_punch') {
            // Đòn đấm 1 (Tay trái) và Đòn đấm 2 (Tay phải) của Tank:
            // Hoạt ảnh khung xương 3 pha uy lực (Thu nắm đấm lấy đà -> Quăng vai & gập người tung cú đấm ngàn cân -> Rút tay về khoảng 0.4s)
            const strikeDur = swing.strikeDuration || 0.15;
            const retractDur = swing.retractDuration || 0.40;
            const coilDur = strikeDur * 0.38;
            if (activePunchedHand === 'left') {
              // Đòn 1 (Tay trái): Rút sâu nắm đấm trái về hông, tay phải giơ chắn trước mặt -> lao người tung cú đấm móc/thẳng cực nặng
              if (elapsed < coilDur) {
                const tCoil = elapsed / coilDur;
                const coilSin = Math.sin(tCoil * (Math.PI / 2));
                punchL_X = -16 * coilSin;
                punchL_Y = 3.5 * coilSin;
                punchL_Rot = 0.36 * coilSin;

                punchR_X = 12 * coilSin;
                punchR_Y = -7 * coilSin;
                punchR_Rot = -0.35 * coilSin;
                tankSlamDipY = -1.5 * coilSin;
              } else if (elapsed < strikeDur) {
                const tDrive = (elapsed - coilDur) / (strikeDur - coilDur);
                const easeDrive = tDrive * tDrive;
                punchL_X = -16 + easeDrive * 60; // -> +44px
                punchL_Y = 3.5 - easeDrive * 5.5; // -> -2.0px
                punchL_Rot = 0.36 - easeDrive * 0.70; // -> -0.34 rad

                punchR_X = 12 - easeDrive * 24; // -> -12px (giật ngược tay phải về sau tạo đối trọng xoay vai)
                punchR_Y = -7 + easeDrive * 10; // -> +3.0px
                punchR_Rot = -0.35 + easeDrive * 0.75; // -> +0.40 rad
                tankSlamDipY = -1.5 + easeDrive * 5.7; // -> +4.2px
              } else {
                // Thời gian rụt tay về khoảng 0.4s
                const tRec = Math.min(1.0, (elapsed - strikeDur) / retractDur);
                const remain = 1 - tRec * tRec;
                punchL_X = 44 * remain;
                punchL_Y = -2.0 * remain;
                punchL_Rot = -0.34 * remain;

                punchR_X = -12 * remain;
                punchR_Y = 3.0 * remain;
                punchR_Rot = 0.40 * remain;
                tankSlamDipY = 4.2 * remain;
              }
            } else {
              // Đòn 2 (Tay phải): Mở rộng vai phải kéo sâu ra sau, tay trái vươn căn mục tiêu -> quăng toàn thân bổ cú đấm phải uy lực
              if (elapsed < coilDur) {
                const tCoil = elapsed / coilDur;
                const coilSin = Math.sin(tCoil * (Math.PI / 2));
                punchR_X = -20 * coilSin;
                punchR_Y = -10 * coilSin;
                punchR_Rot = -0.55 * coilSin;

                punchL_X = 18 * coilSin;
                punchL_Y = -5 * coilSin;
                punchL_Rot = -0.25 * coilSin;
                tankSlamDipY = -1.5 * coilSin;
              } else if (elapsed < strikeDur) {
                const tDrive = (elapsed - coilDur) / (strikeDur - coilDur);
                const easeDrive = tDrive * tDrive;
                punchR_X = -20 + easeDrive * 62; // -> +42px
                punchR_Y = -10 + easeDrive * 8.5; // -> -1.5px
                punchR_Rot = -0.55 + easeDrive * 0.20; // -> -0.35 rad

                punchL_X = 18 - easeDrive * 30; // -> -12px (giật mạnh tay trái về hông tạo lực vặn)
                punchL_Y = -5 + easeDrive * 8; // -> +3.0px
                punchL_Rot = -0.25 + easeDrive * 0.65; // -> +0.40 rad
                tankSlamDipY = -1.5 + easeDrive * 5.7; // -> +4.2px
              } else {
                // Thời gian rụt tay về khoảng 0.4s
                const tRec = Math.min(1.0, (elapsed - strikeDur) / retractDur);
                const remain = 1 - tRec * tRec;
                punchR_X = 42 * remain;
                punchR_Y = -1.5 * remain;
                punchR_Rot = -0.35 * remain;

                punchL_X = -12 * remain;
                punchL_Y = 3.0 * remain;
                punchL_Rot = 0.40 * remain;
                tankSlamDipY = 4.2 * remain;
              }
            }
          } else if (activeClass === 'Fighter' || activeClass === 'Assassin' || activeClass === 'Mage' || activeClass === 'Marksman') {
            // Đấu Sĩ, Sát Thủ, Pháp Sư & Xạ Thủ: Hoạt ảnh 3 pha khung xương chuẩn xác & mượt mà (Lấy đà -> Quăng đấm -> Thời gian rụt tay về khoảng 0.4s)
            const strikeDur = swing.strikeDuration || (activeClass === 'Assassin' ? 0.12 : 0.14);
            const retractDur = swing.retractDuration || 0.40; // 0.4s thời gian rụt về
            const coilDur = activeClass === 'Assassin' ? strikeDur * 0.35 : strikeDur * 0.38;

            if (activePunchedHand === 'left') {
              // Tay trái đánh: Rút sâu tay trái về sau lấy đà, xoay vai
              if (elapsed < coilDur) {
                const tCoil = elapsed / coilDur;
                const coilSin = Math.sin(tCoil * (Math.PI / 2));
                punchL_X = -14 * coilSin;
                punchL_Y = -3 * coilSin;
                punchL_Rot = 0.28 * coilSin;

                punchR_X = 10 * coilSin;
                punchR_Y = -5 * coilSin;
                punchR_Rot = -0.25 * coilSin;
              } else if (elapsed < strikeDur) {
                const tDrive = (elapsed - coilDur) / (strikeDur - coilDur);
                const easeDrive = tDrive * tDrive;
                punchL_X = -14 + easeDrive * 54; // -> +40px
                punchL_Y = -3 + easeDrive * 1.5;
                punchL_Rot = 0.28 - easeDrive * 0.62; // -> -0.34 rad

                punchR_X = 10 - easeDrive * 20; // Giật tay đối trọng
                punchR_Y = -5 + easeDrive * 8;
                punchR_Rot = -0.25 + easeDrive * 0.55;
              } else {
                // Thời gian rụt tay về khoảng 0.4s
                const tRec = Math.min(1.0, (elapsed - strikeDur) / retractDur);
                const remain = 1 - tRec * tRec;
                punchL_X = 40 * remain;
                punchL_Y = -1.5 * remain;
                punchL_Rot = -0.34 * remain;

                punchR_X = -10 * remain;
                punchR_Y = 3.0 * remain;
                punchR_Rot = 0.30 * remain;
              }
            } else {
              // Tay phải đánh: Mở vai rút sâu tay phải về sau lấy đà
              if (elapsed < coilDur) {
                const tCoil = elapsed / coilDur;
                const coilSin = Math.sin(tCoil * (Math.PI / 2));
                punchR_X = -18 * coilSin;
                punchR_Y = -8 * coilSin;
                punchR_Rot = -0.45 * coilSin;

                punchL_X = 14 * coilSin;
                punchL_Y = -4 * coilSin;
                punchL_Rot = -0.20 * coilSin;
              } else if (elapsed < strikeDur) {
                const tDrive = (elapsed - coilDur) / (strikeDur - coilDur);
                const easeDrive = tDrive * tDrive;
                punchR_X = -18 + easeDrive * 56; // -> +38px
                punchR_Y = -8 + easeDrive * 6.5;
                punchR_Rot = -0.45 + easeDrive * 0.12; // -> -0.33 rad

                punchL_X = 14 - easeDrive * 24;
                punchL_Y = -4 + easeDrive * 7;
                punchL_Rot = -0.20 + easeDrive * 0.52;
              } else {
                // Thời gian rụt tay về khoảng 0.4s
                const tRec = Math.min(1.0, (elapsed - strikeDur) / retractDur);
                const remain = 1 - tRec * tRec;
                punchR_X = 38 * remain;
                punchR_Y = -1.5 * remain;
                punchR_Rot = -0.33 * remain;

                punchL_X = -10 * remain;
                punchL_Y = 3.0 * remain;
                punchL_Rot = 0.32 * remain;
              }
            }
          } else {
            // Các hệ còn lại (Xạ Thủ, Pháp Sư): tung đòn và rụt tay về khoảng 0.4s
            const strikeDur = swing.strikeDuration || 0.12;
            const retractDur = swing.retractDuration || 0.40;
            let effectiveCurve = 0;
            if (elapsed < strikeDur) {
              const tDrive = elapsed / strikeDur;
              effectiveCurve = Math.sin(tDrive * (Math.PI / 2));
            } else {
              const tRec = Math.min(1.0, (elapsed - strikeDur) / retractDur);
              effectiveCurve = 1 - tRec * tRec;
            }
            const strikeX = effectiveCurve * 38;
            const guardX = -effectiveCurve * 8;
            const guardY = -effectiveCurve * 1.5;
            const guardRot = effectiveCurve * 0.18;

            if (activePunchedHand === 'right') {
              punchR_X = strikeX;
              punchR_Y = -effectiveCurve * 2.0;
              punchR_Rot = -effectiveCurve * 0.42;
              punchL_X = guardX;
              punchL_Y = guardY;
              punchL_Rot = guardRot;
            } else {
              punchL_X = effectiveCurve * 40;
              punchL_Y = -effectiveCurve * 2.5;
              punchL_Rot = -effectiveCurve * 0.32;
              punchR_X = guardX;
              punchR_Y = guardY;
              punchR_Rot = guardRot;
            }
          }
        }

        // Độ rung chuyển động khi tụ khí gồng sức
        const chargeTremble = isCharging ? (Math.random() - 0.5) * 1.6 * chargeProg : 0;

        // Tính góc nghiêng tay theo mục tiêu quái vật trong hệ tọa độ cục bộ của nhân vật (không nhìn vào quái khi lướt và 0.25s sau khi lướt)
        const isPostDashNoLookNow = postDashNoLookTimerRef.current > 0;
        const targetEnemy = isPostDashNoLookNow ? null : currentTargetEnemyRef.current;
        let aimLocalAngle = 0;
        if (isPostDashNoLookNow) {
          // GIỮ NGUYÊN HƯỚNG TAY SAU KHI LƯỚT
          aimLocalAngle = lastDashHandAngleRef.current;
        } else if (targetEnemy && targetEnemy.hp > 0) {
          const dy = targetEnemy.y - p.y;
          const dx = Math.abs(targetEnemy.x - p.x);
          aimLocalAngle = Math.atan2(dy, Math.max(1, dx));
          // Giới hạn góc nghiêng tự nhiên từ -65° đến +65°
          aimLocalAngle = Math.max(-1.15, Math.min(1.15, aimLocalAngle));
        }

        const cosAim = Math.cos(aimLocalAngle);
        const sinAim = Math.sin(aimLocalAngle);

        // Xoay hướng vung đấm theo hướng quái vật
        const rotPunchR_X = punchR_X * cosAim - punchR_Y * sinAim;
        const rotPunchR_Y = punchR_X * sinAim + punchR_Y * cosAim;

        const rotPunchL_X = punchL_X * cosAim - punchL_Y * sinAim;
        const rotPunchL_Y = punchL_X * sinAim + punchL_Y * cosAim;

        // Vị trí 2 cánh tay:
        let armR_X = -15 - kickR * 5.0 + rotPunchR_X;
        let armR_Y = torsoY - 2 + Math.abs(kickR) * -0.8 + rotPunchR_Y + sinAim * 3.5;
        let chargeRotR = 0;

        let armL_X = 14 - kickL * 5.0 + rotPunchL_X;
        let armL_Y = torsoY - 1 + Math.abs(kickL) * -0.8 + rotPunchL_Y + sinAim * 3.5;
        let chargeRotL = 0;
        const baseRestArmL_X = armL_X;
        const baseRestArmL_Y = armL_Y;

        // Hiệu ứng hạt trắng văng ngược ra phía sau trực tiếp tại bàn tay đang đấm (luân phiên 2 tay) của Sát Thủ:
        // Càng gồng mạnh càng ra nhiều hạt và độ tỏa ra sau to hơn chút
        if (swing.active && activeClass === 'Assassin' && punchCurve > 0.4) {
          const cLevel = swing.chargeLevel || 0;
          const flipX = p.facingRight ? 1 : -1;
          const punchBackwardAngle = p.facingRight ? Math.PI : 0;
          const activeHandLocalX = activePunchedHand === 'right' ? armR_X + 6 : armL_X + 6;
          const activeHandLocalY = activePunchedHand === 'right' ? armR_Y + 2 : armL_Y - 1;
          const fistWorldX = p.x + activeHandLocalX * flipX;
          const fistWorldY = p.y + activeHandLocalY;
          const extraCount = 1 + Math.floor(cLevel * 2.5);
          const spreadWidth = 0.45 + cLevel * 0.8;
          for (let k = 0; k < extraCount; k++) {
            const spread = (Math.random() - 0.5) * spreadWidth;
            const speed = (Math.random() * 2.2 + 1.4) * (1 + cLevel * 0.45);
            particlesRef.current.push({
              id: Math.random().toString(),
              x: fistWorldX + (Math.random() - 0.5) * 3,
              y: fistWorldY + (Math.random() - 0.5) * 3,
              vx: Math.cos(punchBackwardAngle + spread) * speed,
              vy: Math.sin(punchBackwardAngle + spread) * speed,
              color: '#ffffff',
              size: Math.random() * (2.5 + cLevel * 1.2) + 1.5,
              alpha: 0.95,
              life: 0,
              maxLife: 0.22 + cLevel * 0.06,
            });
          }
        }

        if (isCharging) {
          if (chargeHand === 'left') {
            // ĐÒN GỒNG THỨ 1 (TAY TRÁI GỒNG - TẤT CẢ CLASS):
            // - Tay phải (lộ ra - Layer 5 - bên trái của người chơi) từ từ di chuyển tiến sâu ra phần chân:
            armR_X = -15 + chargeProg * 18.5 + chargeTremble;
            armR_Y = torsoY - 1 + chargeProg * 4.5 + chargeTremble;
            chargeRotR = -0.35 * chargeProg;

            // - Tay trái (bị che - Layer 2 - bên phải của người chơi) từ từ di chuyển từ vị trí chuẩn sang vị trí gồng ở sau đầu (không nhảy vào sẵn tư thế từ đầu):
            const startArmL_X = armL_X;
            const startArmL_Y = armL_Y;
            const targetArmL_X = -15 + 7.5;
            const targetArmL_Y = torsoY - 2 - 12;
            armL_X = startArmL_X + (targetArmL_X - startArmL_X) * chargeProg + chargeTremble;
            armL_Y = startArmL_Y + (targetArmL_Y - startArmL_Y) * chargeProg + chargeTremble;
            chargeRotL = -0.5 * chargeProg;
          } else {
            // ĐÒN GỒNG THỨ 2 (TAY PHẢI GỒNG) - PHỤC HỒI LẠI:
            // - Tay phải đặt ở hông giữa thân và chân:
            armR_X = 14 - chargeProg * 14 + chargeTremble;
            armR_Y = torsoY - 1 + chargeProg * 5.5 + chargeTremble;
            chargeRotR = 0.62 * chargeProg;

            // - Tay trái thu về cùng thân người và ở phần vai giữa mặt và thân:
            const startArmL_X = armL_X;
            const startArmL_Y = armL_Y;
            const targetArmL_X = -15 + 10.5;
            const targetArmL_Y = torsoY - 2 - 4.5;
            armL_X = startArmL_X + (targetArmL_X - startArmL_X) * chargeProg + chargeTremble;
            armL_Y = startArmL_Y + (targetArmL_Y - startArmL_Y) * chargeProg + chargeTremble;
            chargeRotL = -0.45 * chargeProg;
          }
        }

        // Khối thân trên (Tay phải, Thân, Đầu, Tay trái):
        // Hạ thấp trọng tâm khi Tank ngồi xuống tụ lực ở hông và xoay gập người về phía trước khi đập xuống đất
        const isAnyTankSlam = isTankJumpSlam || isTankStandingSlam;
        const upperBodyDipY = tankCrouchDipY + (isAnyTankSlam ? tankSlamDipY * 0.65 : 0);
        const upperBodyFoldAngle = tankCrouchFoldAngle + tankSlamFoldAngle;
        ctx.save();
        if (upperBodyDipY !== 0) {
          ctx.translate(0, upperBodyDipY);
        }
        if (upperBodyFoldAngle !== 0) {
          // Xoay gập thân trên quanh khớp hông (0, 0)
          ctx.rotate(upperBodyFoldAngle);
        }

        if (!cachedTayImgRef.current || !cachedThanImgRef.current || !cachedDauImgRef.current) {
          updateCachedCharacterImages();
        }
        const tayImg = cachedTayImgRef.current;

        // Aura trên tay của Pháp Sư khi gồng chiêu: 2 quả cầu ở 2 tay bằng nhau và kích thước vừa phải khi full gồng
        const drawMageHandAura = (_isMainHand: boolean, scaleCompensation = 1.0) => {
          if (!isCharging || activeClass !== 'Mage') return;

          ctx.save();
          if (scaleCompensation !== 1.0) {
            ctx.scale(scaleCompensation, scaleCompensation);
          }
          // Kích thước 2 quả cầu ở 2 tay bằng nhau hoàn toàn (từ 5.0 lên 11.0 khi full gồng, nhỏ gọn hơn so với 16.0 trước đây)
          const sphereRadius = 5.0 + chargeProg * 6.0;
          const pulse = Math.sin(nowMs * 0.018) * 0.9;
          const currentRadius = Math.max(3.8, sphereRadius + pulse);

          // 1. Quầng sáng trắng dịu nhẹ bao quanh (Soft white glow)
          const glowGrad = ctx.createRadialGradient(0, 0, currentRadius * 0.5, 0, 0, currentRadius * 1.7);
          glowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
          glowGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.25)');
          glowGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.arc(0, 0, currentRadius * 1.7, 0, Math.PI * 2);
          ctx.fill();

          // 2. Khối tròn trắng sáng rực nguyên bản (Pure white sphere)
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 10 + chargeProg * 8;
          ctx.beginPath();
          ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
          ctx.fill();

          // 3. Các hạt trắng phát sáng bay xoay quanh khối tròn (White orbiting particles)
          const moteCount = 5;
          for (let m = 0; m < moteCount; m++) {
            const moteSpeed = 0.009 * (m % 2 === 0 ? 1 : -1);
            const moteAngle = (nowMs * moteSpeed) + (m * (Math.PI * 2 / moteCount));
            const orbitDist = currentRadius * (1.3 + Math.sin(nowMs * 0.012 + m * 2) * 0.35);
            const mx = Math.cos(moteAngle) * orbitDist;
            const my = Math.sin(moteAngle) * orbitDist;

            const particleSize = 1.5 + (m % 3) * 0.5 + chargeProg * 0.6;
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(mx, my, particleSize, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        };

        // Hiệu ứng đòn đánh thường của Sát Thủ (Dagger-Precise Assassination Strike):
        // 1. Cố định tuyệt đối tọa độ (không di chuyển theo góc quay của tay, cổ tay hay độ nghiêng thân)
        // 2. Chân hiệu ứng cố định ở tọa độ gồng full (-17 cho tay phải, -31 cho tay trái)
        // 3. Có độ trễ cho đường đi của đòn đánh và gồng càng lâu thì hiệu ứng càng to, càng dài hơn
        const drawAssassinHandChevron = (handSide: 'right' | 'left') => {
          const eff = assassinChevronRef.current[handSide];
          if (!eff.active || activeClass !== 'Assassin') return;
          const elapsed = (nowMs - eff.startTime) / 1000;
          if (elapsed >= eff.duration) {
            eff.active = false;
            return;
          }
          const cLevel = eff.chargeLevel || 0;

          // Độ trễ đường đi của đòn đánh (Travel delay): mũi hình thoi phóng từ chân cố định tới điểm cuối trong khoảng travelDuration
          const travelDuration = 0.13 + cLevel * 0.04;
          const rawTravelProg = Math.min(1.0, elapsed / travelDuration);
          // Ease-out mượt mà nhưng vẫn rõ hành trình phóng đòn
          const travelEase = 1 - Math.pow(1 - rawTravelProg, 1.85);

          // Chỉ bắt đầu mờ dần sau khi đòn đánh đã đi gần hết hành trình
          const fadeStart = travelDuration * 0.82;
          const fadeProg = elapsed <= fadeStart ? 0 : Math.min(1.0, (elapsed - fadeStart) / (eff.duration - fadeStart));
          const alpha = Math.max(0, 1 - fadeProg);

          // 1. Tọa độ X & Y cố định tuyệt đối (không phụ thuộc vào armX, armY, rotR/rotL hay nhịp nhún thân):
          // Khi là đòn gồng lướt: lùi hiệu ứng về sau nhiều chút để ôm dọc theo thân và kéo dài đuôi về phía sau
          const isRush = !!eff.isExtendedRush;
          const backShift = isRush ? 110 : (cLevel > 0 ? 32 : 0);
          const dLeftX = (handSide === 'right' ? -17 : -31) - backShift;
          const baseMaxEndX = isRush ? (handSide === 'right' ? 56 : 38) : (handSide === 'right' ? 48 : 26);
          const maxRightX = isRush ? (baseMaxEndX + 24 + cLevel * 20) : (baseMaxEndX + cLevel * 44);
          const fullSpan = maxRightX - dLeftX;

          // Vị trí mũi hiện tại đang di chuyển theo độ trễ đường đi
          const dRightX = dLeftX + Math.max(8, fullSpan * travelEase);
          const currentLen = dRightX - dLeftX;
          // Cho đầu của đòn đánh ngắn lại phía trước, phần đuôi kéo dài hơn về phía sau
          const headSplitRatio = isRush ? 0.78 : 0.82;
          const dMidX = dLeftX + currentLen * headSplitRatio;

          // 3. Gồng càng lâu thì hiệu ứng càng to hơn
          const baseHalfH = isRush ? (3.4 + cLevel * 3.8) : (2.2 + cLevel * 4.0);
          const dHalfH = baseHalfH * (0.35 + 0.65 * travelEase) * (0.6 + 0.4 * alpha);

          // Tọa độ Y cố định tuyệt đối theo tầm ngang vai chuẩn (-9.0 cho tay phải, -10.5 cho tay trái)
          const fistCenterY = handSide === 'right' ? -9.0 : -10.5;

          ctx.save();
          // Loại bỏ hoàn toàn mọi góc nghiêng/nhún của thân trên để hiệu ứng đứng yên cố định tọa độ, không xoay theo tay hay thân
          if (upperBodyFoldAngle !== 0) {
            ctx.rotate(-upperBodyFoldAngle);
          }
          if (upperBodyDipY !== 0) {
            ctx.translate(0, -upperBodyDipY);
          }

          // Xoay toàn bộ hiệu ứng hình thoi & tia chém quanh vị trí tay hướng thẳng về phía quái vật
          const handAnchorX = handSide === 'right' ? 14 : 2;
          ctx.translate(handAnchorX, fistCenterY);
          ctx.rotate(aimLocalAngle);
          ctx.translate(-handAnchorX, -fistCenterY);

          // 0. Ánh sáng tập trung (Focused strike lighting glow) mở rộng theo độ dài và kích thước đòn gồng
          const lightCenterX = dLeftX + currentLen * 0.6;
          const lightGrad = ctx.createRadialGradient(
            dMidX,
            fistCenterY,
            2,
            lightCenterX,
            fistCenterY,
            Math.max(12, currentLen * 0.65)
          );
          lightGrad.addColorStop(0, `rgba(56, 189, 248, ${(0.26 + cLevel * 0.14) * alpha})`);
          lightGrad.addColorStop(0.5, `rgba(14, 165, 233, ${(0.12 + cLevel * 0.08) * alpha})`);
          lightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = lightGrad;
          ctx.beginPath();
          ctx.ellipse(
            lightCenterX,
            fistCenterY,
            Math.max(12, currentLen * 0.65),
            (14 + cLevel * 12) * (0.5 + 0.5 * travelEase),
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();

          // 1. Đường dây xoắn mảnh phụ ("Coiled string" thinner trailing line) chạy dọc theo đuôi dài & đầu ngắn
          const coilAlpha = Math.max(0, 1 - Math.min(1, fadeProg * 1.55));
          if (coilAlpha > 0.02) {
            ctx.save();
            ctx.globalAlpha = coilAlpha * 0.92;
            ctx.strokeStyle = '#7dd3fc';
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 8 + cLevel * 6;
            ctx.lineWidth = 1.1 + cLevel * 0.85;
            ctx.beginPath();
            const steps = 28;
            const coilFreq = 3.0 + cLevel * 2.0;
            const coilAmp = (3.0 + cLevel * 3.6) * coilAlpha * (0.4 + 0.6 * travelEase);
            const phaseOffset = elapsed * 32;
            for (let i = 0; i <= steps; i++) {
              const t = i / steps;
              const cx = dLeftX + currentLen * t;
              // Biên độ ôm theo tỉ lệ đuôi dài (0 -> 0.82) và đầu ngắn (0.82 -> 1.0)
              const envelope = t < headSplitRatio ? Math.pow(t / headSplitRatio, 0.75) : (1 - t) / (1 - headSplitRatio);
              const cy = fistCenterY + Math.sin(t * Math.PI * 2 * coilFreq - phaseOffset) * coilAmp * envelope;
              if (i === 0) ctx.moveTo(cx, cy);
              else ctx.lineTo(cx, cy);
            }
            ctx.stroke();

            // Sợi xoắn đối xứng mảnh hơn màu trắng
            ctx.globalAlpha = coilAlpha * 0.7;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 0.75 + cLevel * 0.5;
            ctx.beginPath();
            for (let i = 0; i <= steps; i++) {
              const t = i / steps;
              const cx = dLeftX + currentLen * t;
              const envelope = t < headSplitRatio ? Math.pow(t / headSplitRatio, 0.75) : (1 - t) / (1 - headSplitRatio);
              const cy = fistCenterY - Math.sin(t * Math.PI * 2 * coilFreq - phaseOffset) * (coilAmp * 0.72) * envelope;
              if (i === 0) ctx.moveTo(cx, cy);
              else ctx.lineTo(cx, cy);
            }
            ctx.stroke();
            ctx.restore();
          }

          // 2. Hình thoi bất đối xứng (Đầu ngắn gọn sắc bén, đuôi vuốt dài về phía sau)
          ctx.save();
          ctx.globalAlpha = alpha;
          // Lớp hào quang xanh lam sắc lẹm bên ngoài
          ctx.fillStyle = '#38bdf8';
          ctx.shadowColor = '#0ea5e9';
          ctx.shadowBlur = 12 + cLevel * 8;
          ctx.beginPath();
          ctx.moveTo(dLeftX, fistCenterY);
          ctx.lineTo(dMidX, fistCenterY - dHalfH * 1.38);
          ctx.lineTo(dRightX, fistCenterY);
          ctx.lineTo(dMidX, fistCenterY + dHalfH * 1.38);
          ctx.closePath();
          ctx.fill();

          // Lõi hình thoi trắng tinh khiết sắc nhọn bên trong
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 8 + cLevel * 4;
          ctx.beginPath();
          ctx.moveTo(dLeftX + currentLen * 0.03, fistCenterY);
          ctx.lineTo(dMidX, fistCenterY - dHalfH * 0.76);
          ctx.lineTo(dRightX - 0.5, fistCenterY);
          ctx.lineTo(dMidX, fistCenterY + dHalfH * 0.76);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          ctx.restore();
        };

        // 2. LAYER TAY BỊ CHE KHUẤT (VẼ DƯỚI THÂN - TAY TRÁI KHI SCALE > 0):
        ctx.save();
        ctx.translate(armL_X, armL_Y);
        const rotL_L2 = (kickL !== 0 ? kickL * 0.35 : 0) + punchL_Rot + chargeRotL + aimLocalAngle;
        if (rotL_L2 !== 0) ctx.rotate(rotL_L2);
        if (tayImg) {
          ctx.drawImage(tayImg, -24.6, -34.8, 64.8, 64.8);
        }

        // Aura trên tay của Pháp Sư khi gồng (tay trái)
        drawMageHandAura(chargeHand === 'left');
        ctx.restore();

        // Hiệu ứng đòn đánh tay trái của Sát Thủ: vẽ ngoài khối xoay của tay để cố định tọa độ, không di chuyển theo góc quay của tay
        drawAssassinHandChevron('left');

        // 3. LAYER THÂN/HÔNG (ĐÈ LÊN CUỐNG CHÂN VÀ TAY BỊ CHE KHUẤT): 26x14.4px
        // Có hiệu ứng xoay vặn hông (hipTwistRot + hipTwistScaleX + hipLungeShiftX) cho các hệ cận chiến (trừ Pháp Sư, Xạ Thủ)
        const thanImg = cachedThanImgRef.current;
        ctx.save();
        // Khi đấm thường, thân nhân vật sẽ không rướn/hướng về đằng trước nữa (cho tất cả nhân vật)
        const isNormalPunch = swing.active && !swing.isCharged && swing.tankMode !== 'ram_charge' && swing.tankMode !== 'standing_slam' && activeClass !== 'Assassin';
        const baseTorsoShiftX = isNormalPunch
          ? 0
          : isMeleeStepClass
          ? hipLungeShiftX
          : (isAnyTankSlam ? punchCurve * 1.5 : punchCurve * 4);

        const torsoActualX = baseTorsoShiftX;
        const torsoActualY = torsoY + tankSlamDipY * 0.4;

        ctx.translate(torsoActualX, torsoActualY);
        if (hipTwistRot !== 0) {
          ctx.rotate(hipTwistRot);
        }
        if (hipTwistScaleX !== 1.0) {
          ctx.scale(hipTwistScaleX, 1);
        }
        if (thanImg) {
          ctx.drawImage(thanImg, -13, -6.5, 26, 14.4);
        }
        ctx.restore();

        // 3.1. LAYER CHÂN DÀI (CHÂN PHẢI) ĐƯA RA TRƯỚC PHẦN THÂN:
        ctx.save();
        ctx.translate(legR_FinalX, legR_FinalY);
        if (legR_FinalRot !== 0) {
          ctx.rotate(legR_FinalRot);
        }
        if (chanPhaiImg) {
          const legR_Height = (isCharging && chargeHand === 'left') ? 14.67 + 3.0 * chargeProg : 14.67;
          ctx.drawImage(chanPhaiImg, -4.53, -1.5, 9.06, legR_Height);
        }
        ctx.restore();

        // 4. LAYER ĐẦU: GẮN CHẶT TUYỆT ĐỐI VÀO PHẦN THÂN (SKELETAL ATTACHMENT)
        // Khi bất kỳ animation nào diễn ra (di chuyển, thở, đấm combo, gồng lực, lướt, nhảy đập đất, ngã chết, choáng váng),
        // đầu nhân vật luôn luôn gắn chặt với phần thân và chuyển động đồng bộ 100% không bao giờ tách rời.
        const dauImg = cachedDauImgRef.current;

        // Điểm nối khớp cổ trên thân (Neck Joint on Torso):
        // Thân rộng 26px, cao 14.4px, tâm (0,0), mép trên cổ ở (-2, -6.5).
        const neckAnchorX = -2;
        const neckAnchorY = -6.5;

        // Khớp cổ di chuyển và xoay theo thân khi thân vặn hông (hipTwistRot & hipTwistScaleX):
        const cosTorsoTwist = Math.cos(hipTwistRot);
        const sinTorsoTwist = Math.sin(hipTwistRot);
        const scaledNeckAnchorX = neckAnchorX * (hipTwistScaleX !== 1.0 ? hipTwistScaleX : 1.0);
        const neckWorldX = torsoActualX + (scaledNeckAnchorX * cosTorsoTwist - neckAnchorY * sinTorsoTwist);
        const neckWorldY = torsoActualY + (scaledNeckAnchorX * sinTorsoTwist + neckAnchorY * cosTorsoTwist);

        // Vị trí tâm đầu nối tiếp từ khớp cổ (khoảng cách -2px trục X, -11px trục Y từ khớp cổ lên tâm đầu):
        const headRelNeckX = -2;
        const headRelNeckY = -11;
        const headTwistAngle = hipTwistRot * 0.55;
        const cosHeadTwist = Math.cos(headTwistAngle);
        const sinHeadTwist = Math.sin(headTwistAngle);

        const currentHeadX = neckWorldX + (headRelNeckX * cosHeadTwist - headRelNeckY * sinHeadTwist);
        const currentHeadY = neckWorldY + (headRelNeckX * sinHeadTwist + headRelNeckY * cosHeadTwist);

        // Cập nhật lại headX, headY để các hiệu ứng vệ tinh (ngôi sao hoa mắt dizzy) bám theo chính xác
        headX = currentHeadX;
        headY = currentHeadY;

        // Định vị bám dính chính xác tuyệt đối các khớp tay vào sau đầu khi gồng lực (anatomically correct) - TỪ TỪ DI CHUYỂN THEO CHARGEPROG:
        if (isCharging) {
          if (chargeHand === 'left') {
            // ĐÒN GỒNG THỨ 1 (TAY TRÁI GỒNG):
            // - Tay trái (bị che - Layer 2 - bên phải của người chơi) từ từ di chuyển từ vị trí chuẩn sang vị trí sau đầu:
            const targetHeadArmL_X = currentHeadX - 7.5;
            const targetHeadArmL_Y = currentHeadY - 1.5;
            armL_X = baseRestArmL_X + (targetHeadArmL_X - baseRestArmL_X) * chargeProg + chargeTremble;
            armL_Y = baseRestArmL_Y + (targetHeadArmL_Y - baseRestArmL_Y) * chargeProg + chargeTremble;
            chargeRotL = -0.5 * chargeProg;
          }
        }

        ctx.save();
        ctx.translate(currentHeadX, currentHeadY);

        // Điểm tựa xoay cổ (Neck Pivot) nằm tại chân đầu (2, 11) tiếp giáp trực tiếp với thân:
        // Mọi góc xoay (nghiêng theo thân, ngã chết, đập đất, choáng) đều xoay quanh khớp cổ này
        // để đầu không bao giờ bị xê dịch hay hở cổ khỏi thân người.
        ctx.translate(2, 11);

        if (headTwistAngle !== 0) {
          ctx.rotate(headTwistAngle);
        }

        if (isDead) {
          // Khi chết: xoay gập đầu quanh khớp cổ ngã ngửa
          ctx.rotate(easeFall * (Math.PI / 4));
        } else if (tankSlamFoldAngle > 0.05) {
          // Gập thêm phần đầu theo đà đập xuống đất của Đỡ Đòn quanh khớp cổ
          ctx.rotate(tankSlamFoldAngle * 0.35);
        }

        // Hiệu ứng lắc đầu choáng váng khi đập mặt vào vách đá quanh khớp cổ
        if (dazeTimerRef.current > 0 && !isDead) {
          ctx.rotate(Math.sin(dazeOrbitRef.current * 2.5) * 0.22);
        }

        ctx.translate(-2, -11);

        const curHair = hairStyleRef.current;
        const isWearingHair = curHair && curHair !== 'none';

        // Base box size tương ứng với kích thước hộp 112px (w-28 h-28) trong phần xem trước (Preview)
        const baseBox = 66;

        if (dauImg) {
          const dW = (dauImg as HTMLImageElement).naturalWidth || dauImg.width || 1280;
          const dH = (dauImg as HTMLImageElement).naturalHeight || dauImg.height || 1472;
          // Mô phỏng chuẩn xác CSS object-contain trong hộp vuông baseBox x baseBox
          let rawHeadW = baseBox;
          let rawHeadH = baseBox;
          if (dW > dH) {
            rawHeadH = baseBox * (dH / dW);
          } else {
            rawHeadW = baseBox * (dW / dH);
          }
          const headScale = 1.02;
          const headW = rawHeadW * headScale;
          const headH = rawHeadH * headScale;
          const headYOffset = isWearingHair ? baseBox * (0.5 / 112) : 0;
          ctx.drawImage(dauImg, -headW / 2, -headH / 2 + headYOffset, headW, headH);
        }

        // 4.1. LAYER TÓC: ĐỒNG BỘ 100% TỈ LỆ VỚI PHẦN XEM TRƯỚC (PREVIEW) VỀ CHIỀU RỘNG, DÀI, VỊ TRÍ & MÀU NHUỘM
        const activeHairImg = cachedHairImgRef.current;

        if (activeHairImg) {
          const hW = (activeHairImg as HTMLImageElement).naturalWidth || activeHairImg.width || 1;
          const hH = (activeHairImg as HTMLImageElement).naturalHeight || activeHairImg.height || 1;
          
          // Kiểu Tóc Bạch Kim: scale 1.0593; Tóc Bích Lục: chỉnh nhỏ gọn lại & hạ thấp xuống 3px; Tóc Hỏa Long Mới & các tóc còn lại: scale 1.095, offset (3px, -1px)
          const isSilver = curHair === 'hair_silver';
          const isGreen = curHair === 'hair_green';
          const hairScaleMultiplier = isSilver ? 0.99 : isGreen ? 0.98 : 1.02;
          const hairBox = baseBox * hairScaleMultiplier;
          let hairDrawW = hairBox;
          let hairDrawH = hairBox;
          if (hW > hH) {
            hairDrawH = hairBox * (hH / hW);
          } else if (hW < hH) {
            hairDrawW = hairBox * (hW / hH);
          }
          if (isGreen) {
            hairDrawW = baseBox * 1.00;
            hairDrawH = baseBox * 0.97;
          }
          // Dịch chuyển tỉ lệ theo CSS
          const hairOffsetX = isGreen
            ? baseBox * (2.6 / 112)
            : baseBox * (2.6 / 112);
          const hairOffsetY = isSilver
            ? baseBox * (2.2 / 112)
            : isGreen
            ? baseBox * (2.0 / 112)
            : baseBox * (-0.5 / 112);
          ctx.drawImage(
            activeHairImg,
            -hairDrawW / 2 + hairOffsetX,
            -hairDrawH / 2 + hairOffsetY,
            hairDrawW,
            hairDrawH
          );
        }

        // Biểu cảm mắt X_X khi nhân vật chết nằm ngửa
        if (isDead) {
          ctx.save();
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2.2;
          ctx.lineCap = 'round';
          // Mắt trái X
          ctx.beginPath();
          ctx.moveTo(6, -6);
          ctx.lineTo(12, 0);
          ctx.moveTo(12, -6);
          ctx.lineTo(6, 0);
          // Mắt phải X
          ctx.moveTo(18, -6);
          ctx.lineTo(24, 0);
          ctx.moveTo(24, -6);
          ctx.lineTo(18, 0);
          ctx.stroke();
          ctx.restore();
        }
        ctx.restore();

        // 5. LAYER TAY BÊN KHÔNG KHUẤT BỞI THÂN (VẼ TRÊN LAYER ĐẦU THEO YÊU CẦU):
        ctx.save();
        ctx.translate(armR_X, armR_Y);
        const rotR_L5 = (kickR !== 0 ? kickR * 0.35 : 0) + punchR_Rot + chargeRotR + aimLocalAngle;
        if (rotR_L5 !== 0) ctx.rotate(rotR_L5);

        // Hiệu ứng co nhỏ nhẹ tay phải khi gồng Đòn 1 để tạo cảm giác chiều sâu phối cảnh (bé dần nhưng không quá bé)
        const rightArmScale = (isCharging && chargeHand === 'left') ? (1.0 - 0.15 * chargeProg) : 1.0;
        if (rightArmScale !== 1.0) {
          ctx.scale(rightArmScale, rightArmScale);
        }

        if (tayImg) {
          ctx.drawImage(tayImg, -24.6, -34.8, 64.8, 64.8);
        }

        // Aura trên tay của Pháp Sư khi gồng (tay phải - bù trừ scale để 2 quả cầu 2 tay bằng nhau 100%)
        drawMageHandAura(chargeHand === 'right', 1 / rightArmScale);

        // Nếu người chơi đang trang bị kiếm: vẽ thanh kiếm trong tay
        if (hasSwordRef.current) {
          drawWeaponShape(10, 2, rotR_L5, true);
        }
        ctx.restore();

        // Hiệu ứng đòn đánh tay phải của Sát Thủ: vẽ ngoài khối xoay của tay để cố định tọa độ, không di chuyển theo góc quay của tay
        drawAssassinHandChevron('right');

        ctx.restore(); // Restore upper-body crouch/fold transform

        // Hiệu ứng các vạch gió (Wind Streaks) vút ngược lên khi nhân vật rơi từ độ cao >= 2m
        if (tankFallWindAlpha > 0.02) {
          ctx.save();
          ctx.lineCap = 'round';
          const windOffsetsX = [-26, -17, -8, 4, 15, 24, 31];
          const streakScale = 1 + (currentJumpMeters - 2) * 0.35;
          for (let w = 0; w < windOffsetsX.length; w++) {
            const wx = windOffsetsX[w];
            const cycle = ((tankAirElapsed * 11.5 + w * 0.37) % 1);
            const wyStart = 10 - cycle * 46;
            const streakLen = (18 + (w % 3) * 7) * streakScale;
            // Hơi nghiêng nhẹ ngược chiều lao tới để thể hiện quán tính rơi chéo xuống
            const slantX = -4.5 * (streakLen / 24);
            const lineAlpha = tankFallWindAlpha * Math.sin(cycle * Math.PI) * (w % 2 === 0 ? 0.92 : 0.68);

            if (lineAlpha > 0.03) {
              const windGrad = ctx.createLinearGradient(wx, wyStart, wx + slantX, wyStart - streakLen);
              windGrad.addColorStop(0, `rgba(255, 255, 255, ${lineAlpha})`);
              windGrad.addColorStop(0.6, `rgba(224, 242, 254, ${lineAlpha * 0.75})`);
              windGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

              ctx.strokeStyle = windGrad;
              ctx.lineWidth = w % 2 === 0 ? 2.1 : 1.4;
              ctx.shadowColor = '#ffffff';
              ctx.shadowBlur = 6;
              ctx.beginPath();
              ctx.moveTo(wx, wyStart);
              ctx.lineTo(wx + slantX, wyStart - streakLen);
              ctx.stroke();
            }
          }
          ctx.restore();
        }

        // Hiệu ứng XÉ GIÓ TỐC ĐỘ CAO (Linear Sonic Wind Needles & Slipstream Streaks - KHÔNG CÓ HÌNH MŨI TÊN)
        const isDashingNow = p.isDashing || (swing.active && swing.tankMode === 'ram_charge');
        if (isDashingNow) {
          ctx.save();
          const dashWindTime = performance.now() * 0.024;
          const windAlpha = p.isDashing ? 0.95 : Math.sin(punchCurve * Math.PI) * 0.95;

          ctx.lineCap = 'round';
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 8;

          // Các tia gió xé thẳng song song lướt dọc theo thân (Hoàn toàn dạng đường thẳng tốc độ, KHÔNG có hình mũi tên)
          const streakYOffsets = [-18, -12, -6, 0, 6, 12, 18];
          for (let i = 0; i < streakYOffsets.length; i++) {
            const sy = streakYOffsets[i];
            const jitterX = Math.sin(dashWindTime + i * 2.2) * 5;
            const streakLen = 46 + (i % 3) * 16 + Math.cos(dashWindTime + i) * 8;
            const startX = 24 + jitterX;
            const endX = startX - streakLen;

            const streakGrad = ctx.createLinearGradient(startX, sy, endX, sy);
            streakGrad.addColorStop(0, `rgba(255, 255, 255, ${windAlpha * (0.8 + (i % 2) * 0.2)})`);
            streakGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

            ctx.strokeStyle = streakGrad;
            ctx.lineWidth = i % 2 === 0 ? 2.0 : 1.3;
            ctx.beginPath();
            ctx.moveTo(startX, sy);
            ctx.lineTo(endX, sy);
            ctx.stroke();
          }

          ctx.restore();
        }

        // Hiệu ứng sọc tốc độ mỏng nhẹ, số lượng ít (chỉ 2-3 vạch) cho Đấu Sĩ, Đỡ Đòn, Sát Thủ khi lướt/gồng
        const isMeleeSpeedClass = activeClass === 'Fighter' || activeClass === 'Tank' || activeClass === 'Assassin';
        const fLunge = fighterLungeAnimRef.current;
        const isSpeedStreakActive = fLunge.active || (isMeleeSpeedClass && (p.isDashing || (swing.active && swing.tankMode === 'ram_charge')));

        if (isSpeedStreakActive) {
          let lineAlpha = 0.85;
          if (fLunge.active) {
            const lungeElapsed = (performance.now() - fLunge.startTime) / 1000;
            if (lungeElapsed >= fLunge.duration) {
              fLunge.active = false;
            } else {
              const progressFactor = lungeElapsed / fLunge.duration;
              lineAlpha = Math.sin(progressFactor * Math.PI) * (0.92 + fLunge.chargeLevel * 0.08);
            }
          }

          if (fLunge.active || isSpeedStreakActive) {
            ctx.save();
            ctx.lineCap = 'round';
            // Chỉ 3 vạch mỏng tinh tế
            const speedStripes = [
              { y: -14, len: 48, xOff: 6, width: 0.9, alpha: 0.90 }, // ngang vai
              { y: -3, len: 58, xOff: 3, width: 1.0, alpha: 0.95 },  // ngang ngực
              { y: 8, len: 44, xOff: 5, width: 0.8, alpha: 0.85 },   // ngang hông/đùi
            ];
            for (let s = 0; s < speedStripes.length; s++) {
              const str = speedStripes[s];
              const sx = str.xOff;
              const sy = str.y;
              const sLen = str.len;
              const grad = ctx.createLinearGradient(sx - sLen * 0.5, sy, sx + sLen * 0.5, sy);
              grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
              grad.addColorStop(0.3, `rgba(255, 255, 255, ${lineAlpha * str.alpha * 0.95})`);
              grad.addColorStop(0.7, `rgba(224, 242, 254, ${lineAlpha * str.alpha * 0.9})`);
              grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

              ctx.strokeStyle = grad;
              ctx.lineWidth = str.width;
              ctx.shadowColor = '#ffffff';
              ctx.shadowBlur = 2;
              ctx.beginPath();
              ctx.moveTo(sx - sLen * 0.5, sy);
              ctx.lineTo(sx + sLen * 0.5, sy);
              ctx.stroke();
            }
            ctx.restore();
          }
        }

        // 5. STYLIZED PIXEL DIZZY STARS (Hiệu ứng ngôi sao pixel hoa mắt quay quanh đầu khi bị choáng)
        if (dazeTimerRef.current > 0) {
          ctx.save();
          const starCount = 3;
          for (let s = 0; s < starCount; s++) {
            const starAngle = dazeOrbitRef.current + (s * (Math.PI * 2 / starCount));
            const starX = headX + Math.cos(starAngle) * 16;
            const starY = headY - 26 + Math.sin(starAngle) * 6;
            const starScale = 1.0 + Math.sin(starAngle) * 0.25;

            ctx.save();
            ctx.translate(starX, starY);
            ctx.scale(starScale, starScale);
            // Ngôi sao vàng pixel 5x5
            ctx.fillStyle = '#fde047';
            ctx.fillRect(-2, -1, 5, 2);
            ctx.fillRect(-1, -2, 2, 5);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 1, 1);
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(-2, -2, 1, 1);
            ctx.fillRect(1, -2, 1, 1);
            ctx.fillRect(-2, 1, 1, 1);
            ctx.fillRect(1, 1, 1, 1);
            ctx.restore();
          }
          ctx.restore();
        }

        ctx.restore(); // Restore scale flip
        ctx.restore(); // Restore outer save
      };

      // Bỏ hiệu ứng vệt kiếm theo yêu cầu ("bỏ hiệu ứng chém đi")

      // Vẽ định hướng xoay cho chiêu lướt / tầm chiêu AoE (Tuyệt đối không có chữ)
      const aim = aimingSkillRef.current;
      if (aim) {
        ctx.save();
        const fusionSlot = skillSystemRef.current.equippedSlots[aim.skillId];
        const primaryNode = fusionSlot.main || fusionSlot.sub;
        const isPureBuff = primaryNode ? primaryNode.endsWith('_1') || primaryNode === 'Fighter_3' : aim.skillId === 1;
        if (isPureBuff) {
          // Đối với chiêu buff (Kỹ năng 1 của mọi hệ & Chiêu 3 Cường Hóa Đấu Sĩ), không vẽ vòng định hướng, cơ chế giữ/thả hủy chiêu vẫn giữ nguyên!
          ctx.restore();
        } else {
          let indicatorType: 'directional' | 'aoe_circle' = 'directional';
          let indicatorRange = 180;
          if (primaryNode === 'Fighter_2') {
            indicatorType = 'aoe_circle';
            indicatorRange = 125;
          } else if (primaryNode === 'Tank_2') {
            indicatorType = 'directional';
            indicatorRange = 220;
          } else if (primaryNode === 'Tank_3') {
            indicatorType = 'directional';
            indicatorRange = 170;
          } else if (primaryNode === 'Mage_2') {
            indicatorType = 'aoe_circle';
            indicatorRange = 220;
          } else if (primaryNode === 'Mage_3') {
            indicatorType = 'aoe_circle';
            indicatorRange = 320;
          } else if (primaryNode === 'Assassin_2') {
            indicatorType = 'directional';
            indicatorRange = 400; // 5m
          } else if (primaryNode === 'Assassin_3') {
            indicatorType = 'aoe_circle';
            indicatorRange = 200;
          } else if (primaryNode === 'Marksman_2') {
            indicatorType = 'directional';
            indicatorRange = 360;
          } else if (primaryNode === 'Marksman_3') {
            indicatorType = 'aoe_circle';
            indicatorRange = 240;
          }
          const skillCfg = { type: indicatorType, range: indicatorRange };
          const isCancelled = aim.isCancelled;
          const aimColor = isCancelled ? '#ef4444' : '#38bdf8';

          if (skillCfg.type === 'directional') {
            // 1. Chỉ những chiêu di chuyển, dịch chuyển mới có phần định hướng
            const aimLength = skillCfg.range || 160;
            // Tọa độ mục tiêu hạ cánh trên mặt đất theo độ nghiêng Isometric 2:1
            const targetX = p.x + Math.cos(aim.angle) * aimLength;
            const targetY = p.y + Math.sin(aim.angle) * (aimLength * 0.5);

            // Vùng quạt mờ dưới chân theo hướng lướt trên mặt đất nghiêng Isometric 2:1
            const coneAngle = 0.22;
            ctx.save();
            ctx.translate(p.x, p.y + 11.5);
            ctx.scale(1, 0.5);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, aimLength, aim.angle - coneAngle, aim.angle + coneAngle);
            ctx.closePath();
            ctx.fillStyle = isCancelled ? 'rgba(239, 68, 68, 0.16)' : 'rgba(56, 189, 248, 0.15)';
            ctx.fill();
            ctx.restore();

            // Đường mũi tên định hướng xoay
            ctx.beginPath();
            ctx.moveTo(p.x, p.y + 11.5);
            ctx.lineTo(targetX, targetY);
            ctx.strokeStyle = aimColor;
            ctx.lineWidth = 4;
            ctx.shadowColor = aimColor;
            ctx.shadowBlur = 12;
            ctx.setLineDash([10, 6]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Điểm đến hạ cánh / Hồng tâm theo hình elip Isometric 2:1
            ctx.beginPath();
            ctx.ellipse(targetX, targetY, 24, 12, 0, 0, Math.PI * 2);
            ctx.strokeStyle = aimColor;
            ctx.lineWidth = 3;
            ctx.fillStyle = isCancelled ? 'rgba(239, 68, 68, 0.25)' : 'rgba(56, 189, 248, 0.2)';
            ctx.fill();
            ctx.stroke();

            // Mũi tên nhọn chỉ hướng
            const arrowHeadAngle = Math.PI / 6;
            const arrowHeadLen = 16;
            ctx.beginPath();
            ctx.moveTo(targetX, targetY);
            ctx.lineTo(
              targetX - Math.cos(aim.angle - arrowHeadAngle) * arrowHeadLen,
              targetY - Math.sin(aim.angle - arrowHeadAngle) * (arrowHeadLen * 0.5)
            );
            ctx.moveTo(targetX, targetY);
            ctx.lineTo(
              targetX - Math.cos(aim.angle + arrowHeadAngle) * arrowHeadLen,
              targetY - Math.sin(aim.angle + arrowHeadAngle) * (arrowHeadLen * 0.5)
            );
            ctx.strokeStyle = aimColor;
            ctx.lineWidth = 3.5;
            ctx.stroke();
          } else if (skillCfg.type === 'aoe_circle') {
            // 2. Vòng tròn hiển thị phạm vi chiêu theo độ nghiêng Isometric 2:1 của bản đồ
            const range = skillCfg.range;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y + 11.5, range, range * 0.5, 0, 0, Math.PI * 2);
            ctx.fillStyle = isCancelled ? 'rgba(239, 68, 68, 0.12)' : 'rgba(56, 189, 248, 0.12)';
            ctx.fill();
            ctx.strokeStyle = aimColor;
            ctx.lineWidth = 2.5;
            ctx.setLineDash([8, 6]);
            ctx.shadowColor = aimColor;
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.setLineDash([]);
          }
          // Chiêu 'none' (cường hóa, buff giáp sức mạnh...) thì không hiện gì hết!

          ctx.restore();
        }
      }

      // Tính vị trí và góc của kiếm
      const isFacingRight = p.facingRight;
      const weaponY = p.y + 4;
      const weaponX = isFacingRight ? p.x + 12 : p.x - 12;

      let weaponAngle = 0;
      const swing = swingAnimRef.current;

      if (isChargingRef.current && !hasSwordRef.current) {
        // Trạng thái Gồng Lực:
        // Đòn gồng kiếm hướng xuống thì vết chém hướng lên; Kiếm hướng lên thì vết chém hướng xuống
        const progress = chargeProgressRef.current;
        const pullBackDir = isFacingRight ? -1 : 1;
        const isSwordDown = chargeStanceRef.current === 'down';
        const stanceOffset = isSwordDown ? Math.PI * 0.48 : -Math.PI * 0.48;
        const pullBackBase = p.angle + stanceOffset * pullBackDir;
        const vibrate = (Math.random() - 0.5) * (0.05 + progress * 0.14);
        weaponAngle = pullBackBase + vibrate;
      } else if (swing.active) {
        // Trạng thái Vung Kiếm Mượt Mà (Fluid Swing Animation)
        const elapsed = (performance.now() - swing.startTime) / 1000;
        const t = Math.min(1.0, elapsed / swing.duration);

        // Cubic Easing: Vung kiếm cực nhanh và dứt khoát
        const easeSwing = (val: number) => {
          return val < 0.25
            ? (val / 0.25) * 0.5
            : 0.5 + Math.sin(((val - 0.25) / 0.75) * (Math.PI / 2)) * 0.5;
        };
        const eased = easeSwing(t);
        weaponAngle = swing.startAngle + (swing.endAngle - swing.startAngle) * eased;

        // Ghi nhận mũi kiếm vào vệt kiếm phát sáng màu TRẮNG
        const bladeLen = activeClass === 'Fighter' ? (swing.isCharged ? 32 : 24) : 20;
        const tipX = weaponX + Math.cos(weaponAngle) * bladeLen;
        const tipY = weaponY + Math.sin(weaponAngle) * bladeLen;
        swordTrailRef.current.push({
          x: tipX,
          y: tipY,
          alpha: 1.0,
          color: '#ffffff', // Mặc định màu TRẮNG
          width: swing.isCharged ? 7 : 4.5,
        });

        if (t >= 1.0) {
          swing.active = false;
        }
      } else {
        // Nghỉ hoặc di chuyển bình thường: Rung nhẹ theo nhịp thở
        if (isFacingRight) {
          weaponAngle = -0.55 + Math.sin(performance.now() * 0.007) * 0.08;
        } else {
          weaponAngle = -Math.PI + 0.55 - Math.sin(performance.now() * 0.007) * 0.08;
        }
      }

      // 8a. Ground-Layer Particles từ Object Pool (Render hình vuông pixel sắc nét)
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const pt = pool[i];
        if (pt.alpha <= 0.02 || pt.layer !== 'ground') continue;
        if (pt.x < minX - 10 || pt.x > maxX + 10 || pt.y < minY - 10 || pt.y > maxY + 10) continue;
        ctx.globalAlpha = pt.alpha;
        ctx.fillStyle = pt.color;
        // Hiệu ứng hạt thành hình vuông pixel
        ctx.fillRect(pt.x - pt.size * 0.5, pt.y - pt.size * 0.5, pt.size, pt.size);
      }
      ctx.globalAlpha = 1.0;

      // Draw 2.5D shockwave ring flat on the ground (không dùng shadowBlur nặng trong lúc xuất hiện)
      if (spawnShockwaveRef.current.active) {
        const sw = spawnShockwaveRef.current;
        sw.progress += dt / 0.4; // 0.4 seconds duration
        if (sw.progress >= 1.0) {
          sw.active = false;
        } else {
          ctx.save();
          ctx.beginPath();
          const radius = sw.progress * 65; // expand up to 65px
          const alpha = 1.0 - sw.progress;
          ctx.ellipse(sw.x, sw.y, radius, radius * 0.5, 0, 0, Math.PI * 2); // 2.5D perspective squashed circle
          ctx.strokeStyle = `rgba(0, 255, 255, ${alpha})`;
          ctx.lineWidth = 3.2;
          ctx.stroke();
          ctx.restore();
        }
      }

      // Xóa thanh kiếm đi theo yêu cầu người dùng, chỉ hiển thị mô hình nhân vật
      drawPlayerModel();

      // Vẽ những người chơi khác trong phòng Multiplayer
      if (remotePlayers && remotePlayers.length > 0) {
        for (let rIdx = 0; rIdx < remotePlayers.length; rIdx++) {
          const rp = remotePlayers[rIdx];
          ctx.save();
          // Bóng dưới chân người chơi khác
          ctx.save();
          ctx.translate(rp.x, rp.y + 11.5);
          ctx.scale(1, 0.35);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
          ctx.beginPath();
          ctx.arc(0, 0, 15, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Mô hình nhân vật
          ctx.save();
          ctx.translate(rp.x, rp.y);
          if (!rp.facingRight) {
            ctx.scale(-1, 1);
          }
          const bParts = partImagesRef.current;
          if (bParts) {
            const idleBob = Math.sin((now + rp.x * 2) * 0.003) * 0.6;
            const torsoY = -4 + idleBob;
            if (bParts.than) {
              ctx.drawImage(bParts.than, -13, torsoY - 6.5, 26, 14.4);
            }
            if (bParts.dau) {
              ctx.drawImage(bParts.dau, -18, torsoY - 32, 32, 32);
            }
            const rHairKey = rp.hairStyle as keyof typeof bParts;
            const rHair = rHairKey && bParts[rHairKey] ? bParts[rHairKey] : null;
            if (rHair) {
              ctx.drawImage(rHair, -20, torsoY - 35, 36, 36);
            }
          }
          ctx.restore();

          // Tên và thanh máu trên đầu
          ctx.save();
          ctx.textAlign = 'center';
          ctx.font = 'bold 10px monospace';
          ctx.fillStyle = '#67e8f9';
          ctx.fillText(rp.name || 'Hiệp Khách', rp.x, rp.y - 38);

          const barW = 32;
          const barH = 3.5;
          const hpRatio = Math.max(0, Math.min(1, (rp.hp || 100) / (rp.maxHp || 100)));
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(rp.x - barW / 2, rp.y - 34, barW, barH);
          ctx.fillStyle = hpRatio > 0.4 ? '#22c55e' : '#ef4444';
          ctx.fillRect(rp.x - barW / 2, rp.y - 34, barW * hpRatio, barH);
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(rp.x - barW / 2, rp.y - 34, barW, barH);
          ctx.restore();

          ctx.restore();
        }
      }

      // Chuỗi hiệu ứng hạt tụ lại thành người chơi -> phát sáng & fade-in -> bùng nổ tỏa ra xung quanh
      // Đã tắt hoàn toàn ctx.shadowBlur trong lúc hạt tụ và nổ để tối ưu GPU
      if (playerSpawnTimerRef.current > 0) {
        const elapsed = SPAWN_TOTAL_DURATION - playerSpawnTimerRef.current;
        const nowSec = performance.now() * 0.001;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        const blocks = spawnBlocksRef.current;
        for (let i = 0; i < MAX_SPAWN_PARTICLES; i++) {
          const block = blocks[i];
          const flickerVal = Math.sin(nowSec * block.flickerSpeed + block.flickerOffset);
          let opacity = 0.7 + flickerVal * 0.3;
          let bx = p.x + block.offsetX;
          let by = p.y + block.offsetY;
          let size = block.size;

          if (elapsed <= SPAWN_WHITE_FADE_END) {
            // Màn hình trắng đang mờ dần: Hạt chưa xuất hiện
            opacity = 0;
            size = 0;
          } else if (elapsed <= SPAWN_GATHER_END) {
            // Giai đoạn 1 (0.60s -> 1.30s): Hạt từ ngoài màn hình bay vào tụ lại đúng hình dáng người chơi
            const gatherDuration = SPAWN_GATHER_END - SPAWN_WHITE_FADE_END;
            const gatherElapsed = elapsed - SPAWN_WHITE_FADE_END;
            const effectiveGatherTime = gatherDuration - 0.04 - block.gatherDelay;
            const rawGather = Math.max(0, Math.min(1.0, (gatherElapsed - block.gatherDelay) / effectiveGatherTime));
            const inv = 1.0 - rawGather;
            const easeGather = 1.0 - inv * inv * inv;
            bx = p.x + block.startX + (block.offsetX - block.startX) * easeGather;
            by = p.y + block.startY + (block.offsetY - block.startY) * easeGather;
            opacity = (0.35 + 0.65 * rawGather) * (0.75 + flickerVal * 0.25);
          } else if (elapsed <= SPAWN_FADEIN_END) {
            // Giai đoạn 2 (1.30s -> 1.85s): Đã tụ lại đầy đủ đúng hình dáng người chơi -> các hạt phát sáng cùng lúc nhân vật từ từ hiện rõ lên (fade in)
            const fadeProg = (elapsed - SPAWN_GATHER_END) / (SPAWN_FADEIN_END - SPAWN_GATHER_END);
            bx = p.x + block.offsetX;
            by = p.y + block.offsetY;
            const fastFlickerVal = Math.sin(nowSec * (block.flickerSpeed * 2.2) + block.flickerOffset);
            size = block.size * (1.0 + Math.sin(fadeProg * Math.PI) * 0.28);
            opacity = (1.0 - fadeProg * 0.25) * (0.75 + fastFlickerVal * 0.25);
          } else {
            // Giai đoạn 3 (1.85s -> 2.25s): Sau khi nhân vật đã hiện rõ -> các hạt bùng nổ tỏa ra xung quanh
            const burstProgress = (elapsed - SPAWN_FADEIN_END) / (SPAWN_TOTAL_DURATION - SPAWN_FADEIN_END);
            const burstFactor = 1.0 + burstProgress * 10;
            const bodyCenterY = -14;
            bx = p.x + block.offsetX * burstFactor;
            by = p.y + bodyCenterY + (block.offsetY - bodyCenterY) * burstFactor;
            size = Math.max(0, block.size * (1.0 - burstProgress));
            opacity = (1.0 - burstProgress) * (0.6 + flickerVal * 0.4);
          }

          if (opacity > 0 && size > 0) {
            ctx.fillStyle = elapsed > SPAWN_GATHER_END && elapsed <= SPAWN_FADEIN_END && flickerVal > 0.2 ? '#ffffff' : block.color;
            ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
            ctx.fillRect(bx - size * 0.5, by - size * 0.5, size, size);
          }
        }
        ctx.restore();

        // Kích hoạt vụ nổ hạt & sóng xung kích đúng thời điểm chuyển sang Giai đoạn 3 (sau khi nhân vật đã phát sáng và hiện rõ)
        // Các hạt trong spawnBlocksRef (tối đa 30 hạt) đã trực tiếp bùng nổ tỏa ra xung quanh nên không phát sinh thêm hạt thừa
        if (elapsed >= SPAWN_FADEIN_END && !hasTriggeredShockwaveRef.current) {
          hasTriggeredShockwaveRef.current = true;
          // Trigger shockwave ring
          spawnShockwaveRef.current = { x: p.x, y: p.y + 11.5, progress: 0, active: true };
          // Play sound
          sounds.playExplosion();
        }
      }

      // Hiển thị icon Tia Sét Tím trên đầu Sát Thủ (cao hơn hẳn đầu ~1cm, kèm số tầng nội tại)
      const currentAssassinStacks = getActiveAssassinStacks();
      if (statsRef.current.classType === 'Assassin' && currentAssassinStacks > 0 && !deathStateRef.current.isDead) {
        ctx.save();
        // Cao hơn đầu lên tầm 83px trên tâm nhân vật để không bị che lấp sprite/model
        ctx.translate(p.x, p.y - 83);
        const pulse = 1.0 + Math.sin(performance.now() * 0.008) * 0.08;
        ctx.scale(pulse, pulse);

        const isMaxStacks = currentAssassinStacks >= 5;
        ctx.shadowColor = isMaxStacks ? '#ffffff' : '#a855f7';
        ctx.shadowBlur = isMaxStacks ? 18 : 12;

        // Biểu tượng Tia Sét Tím (phát sáng trắng rực rỡ khi tích đủ 5 dấu ấn)
        ctx.fillStyle = isMaxStacks ? '#ffffff' : '#c084fc';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡', -6, 0);

        // Hiển thị số tầng nội tại (1 - 5)
        ctx.font = '900 13px Inter, sans-serif';
        ctx.fillStyle = isMaxStacks ? '#ffffff' : '#f3e8ff';
        ctx.strokeStyle = isMaxStacks ? '#6b21a8' : '#581c87';
        ctx.lineWidth = 2.5;
        ctx.strokeText(`${currentAssassinStacks}`, 9, 1);
        ctx.fillText(`${currentAssassinStacks}`, 9, 1);

        ctx.restore();
      }

      // 9. Particles (Above-Player Layer) từ Object Pool (Render hình vuông pixel sắc nét)
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const pt = pool[i];
        if (pt.alpha <= 0.02 || pt.layer === 'ground') continue;
        if (pt.x < minX - 10 || pt.x > maxX + 10 || pt.y < minY - 10 || pt.y > maxY + 10) continue;
        ctx.globalAlpha = pt.alpha;
        ctx.fillStyle = pt.color;
        // Hiệu ứng hạt thành hình vuông pixel
        ctx.fillRect(pt.x - pt.size * 0.5, pt.y - pt.size * 0.5, pt.size, pt.size);
      }
      ctx.globalAlpha = 1.0;

      // Tầng sương mù mờ ảo huyền bí phủ nhẹ lên người chơi (Foreground Mystical Mist Layer with Y-Sorting)
      drawMistLayer(ctx, cameraRef.current, playerRef.current.y, 'front');

      // ================= 4 & 6. CHU KỲ NGÀY - ĐÊM & HIỆU ỨNG BẦU TRỜI THỜI TIẾT =================
      // Yêu cầu: Màu của buổi đêm và trời mưa KHÔNG CỘNG DỒN VÀO NHAU (không bị tối chồng tối)
      const dayNight = getDayNightLighting(dayNightTimeOffsetRef.current, performance.now());
      const curWeather = weatherStateRef.current;
      const rainAlpha = (curWeather && curWeather.darkOverlayAlpha > 0.005) ? curWeather.darkOverlayAlpha : 0;

      // Không cộng dồn (không dùng dayNight.curA + rainAlpha), lấy mức tối cao nhất của 1 trong 2 (tối đa 0.78)
      const masterSkyAlpha = Math.max(dayNight.curA, rainAlpha);

      if (masterSkyAlpha > 0.005) {
        ctx.save();
        // Ban đêm có tông màu xanh tím than nhạt ở khu vực trung tâm và tối dần về phía viền màn hình (Vignette)
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const outerRadius = Math.hypot(maxX - minX, maxY - minY) * 0.52;

        const nightGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, outerRadius);
        // Center: Màu xanh tím than nhạt (RGB: 22, 34, 68) dịu mắt
        nightGrad.addColorStop(0, `rgba(22, 34, 68, ${(masterSkyAlpha * 0.58).toFixed(3)})`);
        nightGrad.addColorStop(0.50, `rgba(16, 26, 56, ${(masterSkyAlpha * 0.82).toFixed(3)})`);
        // Viền màn hình: Tối hơn rõ rệt (Vignette)
        nightGrad.addColorStop(1, `rgba(4, 8, 22, ${Math.min(0.92, masterSkyAlpha * 1.25).toFixed(3)})`);

        ctx.fillStyle = nightGrad;
        ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
        ctx.restore();
      }

      // ================= 6. HIỆU ỨNG THỜI TIẾT (MƯA RƠI CHÉO, GIÔNG BÃO & SẤM SÉT TRÊN BẢN ĐỒ) =================
      // 2. Hạt mưa, gợn sóng nước và chớp sáng màn hình
      if (curWeather && (curWeather.isStormActive || curWeather.rainDrops.length > 0 || (curWeather.lightningFlashAlpha || 0) > 0.01)) {
        ctx.save();
        // Lớp sương mờ không khí mưa nhẹ trên bản đồ (xám khói trung tính, không ám xanh)
        ctx.fillStyle = 'rgba(42, 44, 48, 0.06)';
        ctx.fillRect(minX, minY, maxX - minX, maxY - minY);

        // Hạt mưa rơi trong không gian bản đồ và dừng lại chạm xuống đất
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.65)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        curWeather.rainDrops.forEach((drop) => {
          if (drop.x >= minX - 40 && drop.x <= maxX + 40 && drop.y >= minY - 40 && drop.y <= maxY + 40) {
            const len = drop.length || 18;
            ctx.moveTo(drop.x + len * 0.28, drop.y - len);
            ctx.lineTo(drop.x, drop.y);
          }
        });
        ctx.stroke();

        // Gợn sóng nước (water splashes) trên nền đất (chỉ vẽ trong tầm nhìn màn hình người chơi)
        if (curWeather.rainSplashes && curWeather.rainSplashes.length > 0) {
          curWeather.rainSplashes.forEach((s) => {
            if (s.x >= minX - 30 && s.x <= maxX + 30 && s.y >= minY - 30 && s.y <= maxY + 30) {
              const splashR = Math.max(0.5, s.r || 1);
              const splashA = Math.max(0, Math.min(1, s.alpha || 0));
              ctx.strokeStyle = `rgba(186, 230, 253, ${splashA.toFixed(2)})`;
              ctx.lineWidth = 1.1;
              ctx.beginPath();
              ctx.ellipse(s.x, s.y, splashR, Math.max(0.2, splashR * 0.48), 0, 0, Math.PI * 2);
              ctx.stroke();
            }
          });
        }

        // Nháy chớp màn hình 2 lần trong 0.2s dịu mắt trước khi sấm nổ (giảm bớt độ sáng)
        const flashA = Math.max(0, Math.min(0.32, curWeather.lightningFlashAlpha || 0));
        if (flashA > 0.01) {
          ctx.fillStyle = `rgba(210, 230, 255, ${flashA.toFixed(2)})`;
          ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
        }
        ctx.restore();
      }

      // 10. Floating Texts (Sát thương / Hồi máu trong Camera World Space) - Vẽ từ Object Pool
      const sortedFloatingTexts = floatingTextsPoolRef.current
        .filter((ft) => ft.opacity > 0.01)
        .sort((a, b) => ((a as any).seq || 0) - ((b as any).seq || 0));
      sortedFloatingTexts.forEach((ft) => {
        if (ft.x < minX - 50 || ft.x > maxX + 50 || ft.y < minY - 50 || ft.y > maxY + 50) return;
        ctx.save();
        ctx.globalAlpha = ft.opacity;
        ctx.fillStyle = ft.color;
        ctx.font = `${ft.italic ? 'italic ' : ''}900 ${ft.size}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.lineWidth = ft.italic ? 3.2 : 2.2;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      });

      // Kết thúc Camera Transform (World Space) -> Chuyển về Screen Space
      ctx.restore();

      // --- VẼ LỚP MÀN HÌNH TRẮNG CHUYỂN CẢNH (SCREEN SPACE) ---
      let whiteScreenOpacity = 0;
      if (playerSpawnTimerRef.current > 0) {
        const elapsed = SPAWN_TOTAL_DURATION - playerSpawnTimerRef.current;
        if (elapsed <= SPAWN_WHITE_FADE_END) {
          const whiteProg = Math.max(0, Math.min(1.0, elapsed / SPAWN_WHITE_FADE_END));
          whiteScreenOpacity = 1.0 - whiteProg;
        }
      }

      if (whiteScreenOpacity > 0) {
        ctx.save();
        // Reset hoàn toàn biến đổi camera/zoom về tọa độ màn hình chuẩn (0,0)
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        ctx.fillStyle = `rgba(255, 255, 255, ${whiteScreenOpacity})`;
        // Phủ kín 100% Canvas từ góc trên bên trái màn hình
        const screenW = canvas.width || (typeof window !== 'undefined' ? window.innerWidth : 1920);
        const screenH = canvas.height || (typeof window !== 'undefined' ? window.innerHeight : 1080);
        ctx.fillRect(0, 0, screenW, screenH);

        ctx.restore();
      }
      } catch (renderErr) {
        console.error('Canvas render loop error:', renderErr);
      }
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [activeClass, spawnFloatingText, spawnDamageText, spawnParticles, addScreenShake]);

  // Window Resize to fill viewport with High-DPI pixel sharpness
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(window.innerWidth * dpr);
        canvas.height = Math.round(window.innerHeight * dpr);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Keyboard & Mouse Events (PC Controls: WASD = Di chuyển, I O P = Skill 1 2 3, Chuột Trái / Space = Đánh)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      if (playerSpawnTimerRef.current > 0) return;

      // Đánh thường bằng phím Space hoặc J (Không áp dụng đòn gồng khi cầm vũ khí của tất cả các class)
      if (e.code === 'Space' || e.code === 'KeyJ') {
        if (hasSwordRef.current) {
          isAttackHeldRef.current = false;
          isChargingRef.current = false;
          chargeProgressRef.current = 0;
          executeAttack(0);
        } else if (!isAttackHeldRef.current) {
          isAttackHeldRef.current = true;
          attackHoldStartTimeRef.current = performance.now();
          chargeMaxNotifiedRef.current = false;
          chargeProgressRef.current = 0;
          isChargingRef.current = true;
        }
      } else if (e.code === 'KeyI' || e.code === 'KeyE' || e.code === 'Digit1') {
        executeSkill1();
      } else if (e.code === 'KeyO' || e.code === 'KeyR' || e.code === 'Digit2' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        executeSkill2();
      } else if (e.code === 'KeyP' || e.code === 'KeyQ' || e.code === 'Digit3') {
        executeSkill3();
      } else if (e.code === 'KeyK') {
        setSkillModalTab('skills');
        setIsLearnSkillsOpen((prev) => !prev);
      } else if (e.code === 'KeyB' || e.code === 'KeyI') {
        setIsEquipOpen((prev) => !prev);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
      if (e.code === 'Space' || e.code === 'KeyJ') {
        if (isAttackHeldRef.current) {
          isAttackHeldRef.current = false;
          isChargingRef.current = false;
          executeAttack(hasSwordRef.current ? 0 : chargeProgressRef.current);
          chargeProgressRef.current = 0;
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mouseScreenX = e.clientX - rect.left;
      const mouseScreenY = e.clientY - rect.top;
      const isMobileScreen = Math.min(rect.width, rect.height) < 768;
      const cameraZoom = isMobileScreen ? 0.76 : 1.0;

      mouseWorldRef.current.x = (mouseScreenX - rect.width / 2) / cameraZoom + cameraRef.current.x;
      mouseWorldRef.current.y = (mouseScreenY - rect.height / 2) / cameraZoom + cameraRef.current.y;
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (playerSpawnTimerRef.current > 0) return;
      if (e.button === 2) {
        e.preventDefault();
        executeSkill1();
      }
    };

    const handleMouseUp = (_e: MouseEvent) => {
      // Bỏ cơ chế ấn vào màn hình sẽ đánh thường, tích lực (Chỉ đánh bằng nút đánh thường hoặc phím)
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [executeAttack, executeSkill1, executeSkill2, executeSkill3]);

  // Dọn dẹp âm thanh thời tiết khi rời khỏi màn chơi
  useEffect(() => {
    return () => {
      sounds.stopRainAndWind();
    };
  }, []);

  const preset = CLASS_PRESETS[activeClass];

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-full overflow-hidden select-none touch-none"
      style={{
        backgroundColor: '#111827',
      }}
    >
      {/* Hiệu ứng màn hình trắng phủ toàn màn hình & toàn map khi vừa vào trận (0.00s -> 0.60s) */}
      <div
        className="fixed inset-0 pointer-events-none select-none"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: '#ffffff',
          zIndex: 9999,
          pointerEvents: 'none',
          transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          opacity: isInitialWhiteFade ? 1 : 0,
        }}
      />
      {/* Màn hình Loading khởi tạo thế giới trên nền sọc ô lưới chéo (tự xóa khi vào game) */}
      {isBootloading && (
        <div
          className="absolute inset-0 z-[100] flex flex-col items-center justify-center pointer-events-auto select-none transition-opacity duration-300"
          style={{
            backgroundColor: 'rgba(11, 17, 32, 0.92)',
            backgroundImage:
              'repeating-linear-gradient(28.7deg, rgba(56, 189, 248, 0.14) 0px, rgba(56, 189, 248, 0.14) 1px, transparent 1px, transparent 41px), repeating-linear-gradient(-28.7deg, rgba(56, 189, 248, 0.14) 0px, rgba(56, 189, 248, 0.14) 1px, transparent 1px, transparent 41px)',
          }}
        >
          <div className="flex flex-col items-center gap-4 animate-fade-in">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-amber-500/20" />
            <span className="text-sm font-black uppercase tracking-widest text-amber-400 animate-pulse drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              Đang kiến tạo thế giới...
            </span>
          </div>
        </div>
      )}
      {/* Top Left: Pixel Art Status HUD (Cách cạnh màn hình ~0.5cm / 18px: Cụm LV phóng to, thẻ tên mỏng, HP, MP, Tiền Vàng & Kim Cương Mini) */}
      <div className="absolute top-[18px] left-[18px] z-40 pointer-events-auto select-none">
        <StatusHud
          level={stats.level || 1}
          reincarnations={stats.reincarnations || 0}
          currentExp={stats.currentExp || 0}
          maxExp={stats.maxExp || 100}
          expPercent={stats.maxExp && stats.maxExp > 0 ? (stats.currentExp || 0) / stats.maxExp : 0}
          currentHp={stats.currentHp}
          maxHp={stats.maxHp}
          shieldHp={stats.shieldHp || 0}
          currentMana={stats.currentMana}
          maxMana={stats.maxMana}
          playerName={playerName}
          classType={stats.classType}
          gold={stats.gold}
          redCurrency={stats.redCurrency ?? 0}
          onLevelClick={() => {
            sounds.playClick();
            setIsStatsOpen(true);
          }}
        />
      </div>

      {/* Top Right: Mini-Map Tròn (Bản đồ con hình tròn đặt góc phải trên cùng, cách cạnh màn hình ~0.5cm) */}
      <div className="absolute top-[18px] right-[18px] z-30 pointer-events-auto flex items-start gap-2">
        {/* Room Info Badge for Multiplayer */}
        {roomInfo?.mode === 'multiplayer' && (
          <div className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-950/85 backdrop-blur-md border border-blue-500/80 shadow-[0_0_12px_rgba(59,130,246,0.35)]">
            <span className="text-[10px] sm:text-xs font-mono font-bold text-blue-300">
              Phòng #{roomInfo.roomCode}
            </span>
            <span className="text-[9px] sm:text-[10px] px-1.5 py-0.2 bg-blue-600 text-white font-mono font-bold rounded">
              {(remotePlayers?.length || 0) + 1}/{roomInfo.maxPlayers}
            </span>
          </div>
        )}

        <MiniMap
          getPlayerState={() => ({
            x: playerRef.current.x,
            y: playerRef.current.y,
            facingRight: playerRef.current.facingRight,
          })}
          getEnemiesState={() =>
            enemiesRef.current.map((e) => ({
              id: e.id,
              x: e.x,
              y: e.y,
              hp: e.hp,
              maxHp: e.maxHp,
              type: e.type,
              isDummy: e.isDummy,
              isBot: e.isBot,
            }))
          }
          getGemsState={() =>
            goldGemsRef.current.map((g) => ({
              id: g.id,
              x: g.x,
              y: g.y,
              currencyType: g.currencyType,
            }))
          }
          spawnerPos={{ x: spawnerZoneRef.current.x, y: spawnerZoneRef.current.y }}
          remotePlayers={remotePlayers}
          playerName={playerName}
          playerClass={activeClass}
          forestBoundX={1760}
          forestBoundY={1740}
        />
      </div>

      {/* Main Interactive Canvas */}
      <div
        className={`absolute inset-0 w-full h-full cursor-crosshair transition-all duration-700 ${
          respawnCountdown !== null ? 'grayscale contrast-95 brightness-75' : ''
        }`}
      >
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
      </div>

      {/* Màn hình xám báo tử (Cơ chế 1 mạng - Chết sẽ mất hết đồ, chiêu và lập nhân vật mới) */}
      {respawnCountdown !== null && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/75 backdrop-blur-[3px] pointer-events-none select-none">
          <div className="px-8 py-5 rounded-2xl bg-slate-900/95 border-2 border-red-500/70 shadow-2xl flex flex-col items-center gap-2 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-red-400">
              Cơ Chế 1 Mạng (Permadeath) • Mất Toàn Bộ Đồ & Kỹ Năng
            </span>
            <span className="text-2xl sm:text-3xl font-black tracking-wide text-slate-100 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
              Lập nhân vật mới sau {respawnCountdown}s
            </span>
          </div>
        </div>
      )}

      {/* ================= 2-HALF SCREEN SPLIT OPERATIONAL OVERLAY ================= */}
      {/* 1. LEFT HALF: Dedicated Movement Control Zone (Nửa màn hình bên trái: Di chuyển) - Thu gọn vùng trên để không che thanh máu/mana */}
      <div
        onTouchStart={handleLeftHalfTouchStart}
        onMouseDown={handleLeftHalfTouchStart}
        className="absolute top-20 sm:top-28 md:top-34 bottom-0 left-0 w-1/2 z-30 select-none touch-none pointer-events-auto cursor-pointer"
      >
        {/* Dynamic Floating or Default Virtual Joystick (Thu nhỏ khoảng 20%: w-29 h-29 / 116px) */}
        {joystickOrigin ? (
          <div
            className="fixed z-40 pointer-events-none transition-opacity"
            style={{
              left: joystickOrigin.x - 58,
              top: joystickOrigin.y - 58,
            }}
          >
            <div className="relative w-29 h-29 rounded-full bg-slate-900/70 backdrop-blur-md border-2 border-sky-500/80 shadow-2xl shadow-sky-500/30 flex items-center justify-center">
              <div
                className="w-11 h-11 rounded-full border-2 bg-sky-500 border-white scale-110 shadow-lg shadow-sky-500/50 flex items-center justify-center pointer-events-none"
                style={{
                  transform: `translate3d(${joystickKnob.x}px, ${joystickKnob.y}px, 0)`,
                }}
              >
                <div className="w-3 h-3 rounded-full bg-white/90 shadow-sm" />
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute bottom-5 left-5 pointer-events-none">
            <div
              ref={joystickBaseRef}
              className="relative w-29 h-29 rounded-full bg-slate-900/60 backdrop-blur-md border-2 border-slate-700/80 shadow-2xl flex items-center justify-center"
            >
              <div className="w-11 h-11 rounded-full border-2 bg-slate-700/90 border-slate-400 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-white/90 shadow-sm" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM-RIGHT: Touch Action Buttons Cluster - Ergonomic MOBA Layout (Đã xóa nút đổi tay sang kiếm, thay bằng nút Mở Bảng Kỹ Năng & Kho Đồ) */}
      <div className="absolute bottom-4 right-4 z-30 select-none touch-none pointer-events-auto flex items-end justify-end pointer-events-none">
        <div className="relative w-84 h-64 pointer-events-auto">
          {/* 1. NÚT MỞ BẢNG KỸ NĂNG & GHÉP CHIÊU (Phím K) */}
          <button
            onTouchStart={(e) => {
              if (e.cancelable) e.preventDefault();
              lastTouchTimeRef.current = performance.now();
              sounds.playClick();
              setSkillModalTab('skills');
              setIsLearnSkillsOpen(true);
            }}
            onClick={() => {
              if (performance.now() - lastTouchTimeRef.current < 500) return;
              sounds.playClick();
              setSkillModalTab('skills');
              setIsLearnSkillsOpen(true);
            }}
            title="Bảng Kỹ Năng & Kết Hợp 2 Chiêu (Phím K)"
            aria-label="Bảng Kỹ Năng"
            className="absolute bottom-2 right-44 w-12 h-12 rounded-full bg-slate-900/90 backdrop-blur-md border-2 border-emerald-400 shadow-xl flex items-center justify-center text-white active:scale-90 transition cursor-pointer hover:border-emerald-300 hover:shadow-emerald-400/20 z-20"
          >
            <BookOpen size={20} className="stroke-[2.5] text-emerald-300 drop-shadow select-none" />
            {skillSystem.skillPoints > 0 && (
              <div className="absolute -top-0.5 -right-0.5 w-3 h-3 flex items-center justify-center">
                {/* Vòng xung nhịp màu đỏ bắn lan rộng dần ra bên ngoài và mờ dần */}
                <span className="absolute w-full h-full rounded-full bg-red-500 animate-ripple-glow pointer-events-none" />
                {/* Chấm đỏ tĩnh phẳng nằm ở tâm - phát sáng rực rỡ, không viền, không hiệu ứng 3D */}
                <span className="absolute w-full h-full rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.95)]" />
              </div>
            )}
          </button>

          {/* 1b. NÚT MỞ KHO ĐỒ & TRANG BỊ (Cạnh nút quyển sách học chiêu - Phím B) */}
          <button
            onTouchStart={(e) => {
              if (e.cancelable) e.preventDefault();
              lastTouchTimeRef.current = performance.now();
              sounds.playClick();
              setIsEquipOpen(true);
            }}
            onClick={() => {
              if (performance.now() - lastTouchTimeRef.current < 500) return;
              sounds.playClick();
              setIsEquipOpen(true);
            }}
            title="Kho Đồ & Bảng Trang Bị Nhân Vật (Phím B)"
            aria-label="Kho Đồ"
            className="absolute bottom-2 right-58 w-12 h-12 rounded-full bg-slate-900/90 backdrop-blur-md border-2 border-amber-400 shadow-xl flex items-center justify-center text-white active:scale-90 transition cursor-pointer hover:border-amber-300 hover:shadow-amber-400/20 z-20"
          >
            <Backpack size={20} className="stroke-[2.5] text-amber-300 drop-shadow select-none" />
          </button>

          {/* 2. CUNG CHIÊU THỨC MOBA - CHIÊU 1 (BÊN TRÁI ĐÒN ĐÁNH): Kể cả không vũ khí vẫn học & dùng được */}
          {(() => {
            const fusion1 = skillSystem.equippedSlots[1];
            const isSkill1Unlearned = !fusion1.main && !fusion1.sub;
            const mainDef1 = fusion1.main ? getSkillDefinitionByNodeId(fusion1.main) : null;
            const subDef1 = fusion1.sub ? getSkillDefinitionByNodeId(fusion1.sub) : null;
            return (
              <button
                onTouchStart={(e) => {
                  handleSkillAimStart(1, e);
                }}
                onMouseDown={(e) => {
                  handleSkillAimStart(1, e);
                }}
                disabled={skill1CdRemaining > 0}
                aria-label="Chiêu 1"
                className={`absolute bottom-2 right-28 w-14 h-14 rounded-full bg-slate-900/90 backdrop-blur-md border-2 shadow-xl flex items-center justify-center text-white active:scale-90 transition cursor-pointer overflow-hidden z-20 ${
                  isSkill1Unlearned
                    ? 'opacity-50 border-slate-700'
                    : aimingSkillId === 1
                    ? aimingSkillRef.current?.isCancelled
                      ? 'border-red-500 ring-4 ring-red-500/50 scale-105'
                      : 'border-sky-400 ring-4 ring-sky-400/50 scale-105'
                    : ''
                }`}
                style={{
                  borderColor: isSkill1Unlearned
                    ? '#475569'
                    : aimingSkillId === 1
                    ? aimingSkillRef.current?.isCancelled
                      ? '#ef4444'
                      : '#38bdf8'
                    : mainDef1?.color || preset.skill1.color,
                }}
              >
                {skill1CdRemaining > 0 && (
                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-sm font-mono font-bold text-white z-10 select-none">
                    {skill1CdRemaining >= 1 ? Math.ceil(skill1CdRemaining) : skill1CdRemaining.toFixed(1)}
                  </div>
                )}
                {isSkill1Unlearned && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs z-10 select-none">
                    +
                  </div>
                )}
                {mainDef1 && subDef1 && (
                  <span className="absolute top-0.5 right-1 text-[9px] font-black text-amber-300 z-10">2X</span>
                )}
                <span className="text-2xl leading-none select-none">⚡</span>
              </button>
            );
          })()}

          {/* 3. CUNG CHIÊU THỨC MOBA - CHIÊU 2 (CHÉO TRÊN - TRÁI): Kể cả không vũ khí vẫn học & dùng được */}
          {(() => {
            const fusion2 = skillSystem.equippedSlots[2];
            const isSkill2Unlearned = !fusion2.main && !fusion2.sub;
            const mainDef2 = fusion2.main ? getSkillDefinitionByNodeId(fusion2.main) : null;
            const subDef2 = fusion2.sub ? getSkillDefinitionByNodeId(fusion2.sub) : null;
            return (
              <button
                onTouchStart={(e) => {
                  handleSkillAimStart(2, e);
                }}
                onMouseDown={(e) => {
                  handleSkillAimStart(2, e);
                }}
                disabled={skill2CdRemaining > 0}
                aria-label="Chiêu 2"
                className={`absolute bottom-20 right-20 w-14 h-14 rounded-full bg-slate-900/90 backdrop-blur-md border-2 shadow-xl flex items-center justify-center text-white active:scale-90 transition cursor-pointer overflow-hidden z-20 ${
                  isSkill2Unlearned
                    ? 'opacity-50 border-slate-700'
                    : aimingSkillId === 2
                    ? aimingSkillRef.current?.isCancelled
                      ? 'border-red-500 ring-4 ring-red-500/50 scale-105'
                      : 'border-sky-400 ring-4 ring-sky-400/50 scale-105'
                    : ''
                }`}
                style={{
                  borderColor: isSkill2Unlearned
                    ? '#475569'
                    : aimingSkillId === 2
                    ? aimingSkillRef.current?.isCancelled
                      ? '#ef4444'
                      : '#38bdf8'
                    : mainDef2?.color || preset.skill2.color,
                }}
              >
                {skill2CdRemaining > 0 && (
                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-sm font-mono font-bold text-white z-10 select-none">
                    {skill2CdRemaining >= 1 ? Math.ceil(skill2CdRemaining) : skill2CdRemaining.toFixed(1)}
                  </div>
                )}
                {isSkill2Unlearned && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs z-10 select-none">
                    +
                  </div>
                )}
                {mainDef2 && subDef2 && (
                  <span className="absolute top-0.5 right-1 text-[9px] font-black text-amber-300 z-10">2X</span>
                )}
                <span className="text-2xl leading-none select-none">🔥</span>
              </button>
            );
          })()}

          {/* 4. CUNG CHIÊU THỨC MOBA - CHIÊU 3 / ULTIMATE (PHÍA TRÊN ĐÒN ĐÁNH): Kể cả không vũ khí vẫn học & dùng được */}
          {(() => {
            const fusion3 = skillSystem.equippedSlots[3];
            const isSkill3Unlearned = !fusion3.main && !fusion3.sub;
            const mainDef3 = fusion3.main ? getSkillDefinitionByNodeId(fusion3.main) : null;
            const subDef3 = fusion3.sub ? getSkillDefinitionByNodeId(fusion3.sub) : null;
            return (
              <button
                onTouchStart={(e) => {
                  handleSkillAimStart(3, e);
                }}
                onMouseDown={(e) => {
                  handleSkillAimStart(3, e);
                }}
                disabled={skill3CdRemaining > 0}
                aria-label="Chiêu 3"
                className={`absolute bottom-28 right-2 w-14 h-14 rounded-full bg-slate-900/90 backdrop-blur-md border-2 shadow-xl flex items-center justify-center text-white active:scale-90 transition cursor-pointer overflow-hidden z-20 ${
                  isSkill3Unlearned
                    ? 'opacity-50 border-slate-700'
                    : aimingSkillId === 3
                    ? aimingSkillRef.current?.isCancelled
                      ? 'border-red-500 ring-4 ring-red-500/50 scale-105'
                      : 'border-sky-400 ring-4 ring-sky-400/50 scale-105'
                    : ''
                }`}
                style={{
                  borderColor: isSkill3Unlearned
                    ? '#475569'
                    : aimingSkillId === 3
                    ? aimingSkillRef.current?.isCancelled
                      ? '#ef4444'
                      : '#38bdf8'
                    : mainDef3?.color || preset.skill3.color,
                }}
              >
                {skill3CdRemaining > 0 && (
                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-sm font-mono font-bold text-white z-10 select-none">
                    {skill3CdRemaining >= 1 ? Math.ceil(skill3CdRemaining) : skill3CdRemaining.toFixed(1)}
                  </div>
                )}
                {isSkill3Unlearned && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs z-10 select-none">
                    +
                  </div>
                )}
                {mainDef3 && subDef3 && (
                  <span className="absolute top-0.5 right-1 text-[9px] font-black text-amber-300 z-10">2X</span>
                )}
                <span className="text-2xl leading-none select-none">💥</span>
              </button>
            );
          })()}

          {/* 5. NÚT ĐÁNH THƯỜNG TRUNG TÂM MOBA (GÓC DƯỚI CÙNG BÊN PHẢI - TO NHẤT, VỪA KHỚP NGÓN CÁI) */}
          <button
            onTouchStart={(e) => {
              if (e.cancelable) e.preventDefault();
              lastTouchTimeRef.current = performance.now();
              if (hasSwordRef.current) {
                isAttackHeldRef.current = false;
                isChargingRef.current = false;
                chargeProgressRef.current = 0;
                executeAttack(0);
                return;
              }
              isAttackHeldRef.current = true;
              attackHoldStartTimeRef.current = performance.now();
              chargeMaxNotifiedRef.current = false;
              chargeProgressRef.current = 0;
              isChargingRef.current = true;
            }}
            onTouchEnd={(e) => {
              if (e.cancelable) e.preventDefault();
              lastTouchTimeRef.current = performance.now();
              if (!isAttackHeldRef.current) return;
              isAttackHeldRef.current = false;
              isChargingRef.current = false;
              executeAttack(hasSwordRef.current ? 0 : chargeProgressRef.current);
              chargeProgressRef.current = 0;
            }}
            onMouseDown={() => {
              if (performance.now() - lastTouchTimeRef.current < 500) return;
              if (hasSwordRef.current) {
                isAttackHeldRef.current = false;
                isChargingRef.current = false;
                chargeProgressRef.current = 0;
                executeAttack(0);
                return;
              }
              isAttackHeldRef.current = true;
              attackHoldStartTimeRef.current = performance.now();
              chargeMaxNotifiedRef.current = false;
              chargeProgressRef.current = 0;
              isChargingRef.current = true;
            }}
            onMouseUp={() => {
              if (performance.now() - lastTouchTimeRef.current < 500) return;
              if (!isAttackHeldRef.current) return;
              isAttackHeldRef.current = false;
              isChargingRef.current = false;
              executeAttack(hasSwordRef.current ? 0 : chargeProgressRef.current);
              chargeProgressRef.current = 0;
            }}
            aria-label="Đánh thường"
            className="absolute bottom-2 right-2 w-21 h-21 rounded-full flex items-center justify-center active:scale-95 transition transform cursor-pointer select-none z-20"
          >
            <img
              src="https://i.ibb.co/m56SNRM6/ad2f942e-bf06-431b-9a93-c914ae271536-Photoroom.png"
              alt="Đánh thường"
              draggable={false}
              className="w-full h-full object-contain -rotate-45 drop-shadow-[0_6px_14px_rgba(0,0,0,0.65)] pointer-events-none select-none"
            />
          </button>
        </div>
      </div>

      {/* 1. Bảng Học Kỹ Năng, Ghép Chiêu & Học Class Mới (Tích Hợp Đồng Bộ) */}
      <LearnSkillsModal
        isOpen={isLearnSkillsOpen}
        onClose={() => setIsLearnSkillsOpen(false)}
        playerLevel={stats.level || 1}
        activeClass={activeClass}
        skillSystem={skillSystem}
        onUpgradeSkill={handleUpgradeSkillNode}
        onUpgradePassive={handleUpgradePassiveNode}
        onUpgradeClassLevel={handleUpgradeClassLevel}
        onUnlockSubSlot={handleUnlockSubSlot}
        onSaveSkillSystem={handleSaveSkillSystem}
        onAssignSkillSlot={handleAssignSkillSlot}
        onUnlockClass={handleUnlockClassInSkillTree}
        initialTab={skillModalTab}
      />

      {/* Bảng Chỉ Số Stats Nhân Vật, Chuyển Sinh & Cài Đặt (Mở khi ấn vào phần Level) */}
      <StatsModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        stats={stats}
        attributes={attributes}
        onUpgradeAttribute={handleUpgradeAttribute}
        statExp={stats.statExp ?? 0}
        onReincarnate={handleReincarnate}
        onQuitGame={() => {
          setIsStatsOpen(false);
          if (onLeaveRoom) {
            onLeaveRoom();
          }
        }}
      />

      {/* Bảng Trang Bị Nhân Vật (Mũ, giáp, giày, vũ khí chính, vũ khí phụ, vòng cổ, nhẫn) */}
      <EquipmentModal
        isOpen={isEquipOpen}
        onClose={() => setIsEquipOpen(false)}
        equipped={equipped}
        onEquipItem={handleEquipItem}
      />

      {/* Bảng Chọn Hệ Phái: Đấu sĩ, Đỡ đòn, Pháp sư, Sát thủ, Xạ thủ */}
      <ClassSelectModal
        isOpen={isClassSelectOpen}
        onClose={() => setIsClassSelectOpen(false)}
        activeClass={activeClass}
        onSelectClass={(c) => {
          onClassChange(c);
        }}
      />

      {/* Bảng Tùy Chỉnh Kiểu Tóc Gốc, Màu Tóc & Màu Da */}
      {isCharacterCustomOpen && (
        <CharacterCreationModal
          isOpen={isCharacterCustomOpen}
          canClose={true}
          onClose={() => setIsCharacterCustomOpen(false)}
          initialClass={activeClass}
          initialName={playerName}
          initialEyeStyle={eyeStyle}
          initialHairStyle={hairStyle}
          initialHairColor={hairColor}
          initialSkinColor={skinColor}
          onConfirm={(name, selectedClass, selectedEye, selectedHair, selectedColor, selectedSkin) => {
            sounds.playClick();
            setPlayerName(name);
            if (selectedClass !== activeClass) {
              onClassChange(selectedClass);
            }
            setEyeStyle(selectedEye);
            setHairStyle(selectedHair);
            hairStyleRef.current = selectedHair;
            setHairColor(selectedColor);
            hairColorRef.current = selectedColor;
            setSkinColor(selectedSkin);
            skinColorRef.current = selectedSkin;

            if (onCustomizationChange) {
              onCustomizationChange({
                name,
                classType: selectedClass,
                eyeStyle: selectedEye,
                hairStyle: selectedHair,
                hairColor: selectedColor,
                skinColor: selectedSkin,
              });
            }

            updateCachedCharacterImages();
            preWarmGPUTextures();

            const p = playerRef.current;
            p.x = 0;
            p.y = 0;
            p.vx = 0;
            p.vy = 0;
            p.isDashing = false;
            p.dashTimer = 0;
            p.shieldActive = false;
            p.shieldTimer = 0;
            p.fighterBuffActive = false;
            p.fighterBuffTimer = 0;
            p.fighterEnhanceActive = false;
            p.fighterEnhanceTimer = 0;
            p.tankShieldHp = 0;
            p.tankShieldTimer = 0;
            p.mageBuffActive = false;
            p.mageBuffTimer = 0;
            p.assassinBuffActive = false;
            p.assassinBuffTimer = 0;
            p.marksmanBuffActive = false;
            p.marksmanBuffTimer = 0;
            p.marksmanStoneStacks = 0;

            enemiesRef.current = [];
            projectilesRef.current = [];
            slashesRef.current = [];
            goldGemsRef.current = [];

            aiFreezeTimerRef.current = 0.5;

            setIsCharacterCustomOpen(false);
            setIsBootloading(false);
            // Kích hoạt ngay chuỗi hiệu ứng hạt tụ thành hình dáng người chơi khi bắt đầu vào game
            initPlayerSpawnEffect();
          }}
        />
      )}

      {/* Bảng Cài Đặt Game & Thoát Game về Main Menu */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onQuitGame={() => {
          setIsSettingsOpen(false);
          if (onLeaveRoom) {
            onLeaveRoom();
          }
        }}
      />

      {/* Thẻ Thông Báo Level Up Màu Vàng ở Cạnh Dưới Màn Hình (Số Cuộn Lên Như Chọn Ngày Sinh) */}
      <LevelUpCardOverlay notification={levelUpNotification} />
    </div>
  );
};
