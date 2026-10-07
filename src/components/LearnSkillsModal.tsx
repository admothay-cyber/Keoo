import React, { useState, useEffect } from 'react';
import { ClassType, SkillNodeId, SkillSystemState } from '../types/game';
import { ALL_CLASS_TYPES, CLASS_PRESETS, getSkillDefinitionByNodeId } from '../data/classPresets';
import { X, Sparkles, Lock, Check, Layers, ArrowRight, Award, ArrowUp } from 'lucide-react';
import { sounds } from '../audio/soundEffects';

interface LearnSkillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerLevel: number;
  activeClass: ClassType;
  skillSystem: SkillSystemState;
  onUpgradeSkill: (nodeId: SkillNodeId) => void;
  onUpgradePassive?: (targetClass: ClassType) => void;
  onUpgradeClassLevel?: (targetClass: ClassType) => void;
  onUnlockSubSlot?: (slotNumber: 1 | 2 | 3) => void;
  onSaveSkillSystem?: (newSkillSystem: SkillSystemState) => void;
  onAssignSkillSlot?: (slotNumber: 1 | 2 | 3, branch: 'main' | 'sub', nodeId: SkillNodeId | null) => void;
  onUnlockClass?: (targetClass: ClassType) => void;
  initialTab?: 'skills' | 'fusion' | 'unlock';
}

export const SUB_SLOT_UNLOCK_COSTS: Record<1 | 2 | 3, number> = {
  1: 10,
  2: 100,
  3: 1000,
};

export const getSkillUpgradeCost = (slot: 'passive' | 1 | 2 | 3, currentLvl: number): number => {
  // Nội tại: +5 mỗi lần (cấp 1: 5, cấp 2: 10, cấp 3: 15...)
  // Chiêu 1: +10 mỗi lần (cấp 1: 10, cấp 2: 20, cấp 3: 30...)
  // Chiêu 2: +20 mỗi lần (cấp 1: 20, cấp 2: 40, cấp 3: 60...)
  // Chiêu 3: +50 mỗi lần (cấp 1: 50, cấp 2: 100, cấp 3: 150...)
  const step = slot === 'passive' ? 5 : slot === 1 ? 10 : slot === 2 ? 20 : 50;
  return (currentLvl + 1) * step;
};

export const toRoman = (num: number): string => {
  if (num <= 0) return '-';
  const romanMap: [number, string][] = [
    [10, 'X'],
    [9, 'IX'],
    [8, 'VIII'],
    [7, 'VII'],
    [6, 'VI'],
    [5, 'V'],
    [4, 'IV'],
    [3, 'III'],
    [2, 'II'],
    [1, 'I'],
  ];
  for (const [val, roman] of romanMap) {
    if (num === val) return roman;
  }
  return String(num);
};

export const getClassUpgradeCost = (currentLvl: number): number => {
  // Cấp 1 (0 -> 1): 10 điểm
  // Cấp 2 (1 -> 2): 15 điểm
  // Cấp 3 (2 -> 3): 20 điểm
  // ... Cấp N: 10 + currentLvl * 5
  return 10 + currentLvl * 5;
};

const CLASS_ICONS: Record<ClassType, string> = {
  Fighter: '⚔️',
  Tank: '🛡️',
  Mage: '🔮',
  Assassin: '🗡️',
  Marksman: '🏹',
};

const formatCleanName = (name?: string) => {
  if (!name) return '';
  return name.replace(/\s*\([^)]*\)\s*/g, '').trim();
};

const formatSkillAbbreviation = (nodeId: SkillNodeId | null): string => {
  if (!nodeId) return '';
  const parts = nodeId.split('_');
  if (parts.length < 2) return '';
  const className = parts[0];
  const slotNum = parts[1]; // '1', '2', '3'

  let classAbbr = '';
  switch (className) {
    case 'Fighter': classAbbr = 'Fig'; break;
    case 'Tank': classAbbr = 'Tan'; break;
    case 'Mage': classAbbr = 'Mag'; break;
    case 'Assassin': classAbbr = 'Ass'; break;
    case 'Marksman': classAbbr = 'Mar'; break;
    default: classAbbr = className.substring(0, 3);
  }

  return `C${slotNum} ${classAbbr}`;
};

const formatStatProgression = (
  currentLvl: number,
  calcVal: (lvl: number) => number,
  unit = '',
  prefix = ''
): string => {
  const u = unit ? unit : '';
  if (currentLvl <= 0) {
    const nextVal = calcVal(1);
    return `${prefix}${nextVal}${u}`;
  }
  if (currentLvl >= 10) {
    const curVal = calcVal(10);
    return `${prefix}${curVal}${u}`;
  }
  const curVal = calcVal(currentLvl);
  const nextVal = calcVal(currentLvl + 1);
  return `${prefix}${curVal}${u} -> ${prefix}${nextVal}${u}`;
};

const getSkillRealStats = (
  cType: ClassType,
  slot: 'passive' | 1 | 2 | 3,
  skillLvl: number,
  playerLvl: number
): string[] => {
  const preset = CLASS_PRESETS[cType];
  const baseAtk = preset.baseDamage + (playerLvl - 1) * 3;
  const baseHp = preset.maxHp + (playerLvl - 1) * 20;

  if (slot === 'passive') {
    switch (cType) {
      case 'Fighter':
        return [
          `Xuyên Giáp: ${formatStatProgression(skillLvl, (l) => Math.round(10 * (1 + (l - 1) * 0.10)), '%', '+')}`,
          `Sát Thương: ${formatStatProgression(skillLvl, (l) => Math.round(30 * (1 + (l - 1) * 0.10)), '', '+')}`,
        ];
      case 'Tank':
        return [
          `Miễn Thương: ${formatStatProgression(skillLvl, (l) => Math.round(10 * (1 + (l - 1) * 0.10)), '%', '+')}`,
          `Máu: ${formatStatProgression(skillLvl, (l) => Math.round(250 * (1 + (l - 1) * 0.10)), '', '+')}`,
        ];
      case 'Mage':
        return [
          `Hồi Mana: ${formatStatProgression(skillLvl, (l) => Math.round(10 * (1 + (l - 1) * 0.10)), '%', '+')}`,
          `EXP: ${formatStatProgression(skillLvl, (l) => Math.round(10 * (1 + (l - 1) * 0.10)), '%', '+')}`,
        ];
      case 'Assassin':
        return [
          `Tỉ Lệ Chí Mạng: ${formatStatProgression(skillLvl, (l) => Math.round(25 * (1 + (l - 1) * 0.10)), '%', '+')}`,
          `ST Chuẩn: ${formatStatProgression(skillLvl, (l) => Math.round(10 * (1 + (l - 1) * 0.10)), '%', '+')}`,
        ];
      case 'Marksman':
        return [
          `Xuyên Giáp: ${formatStatProgression(skillLvl, (l) => Math.round(15 * (1 + (l - 1) * 0.10)), '%', '+')}`,
          `Tỉ Lệ Chí Mạng: ${formatStatProgression(skillLvl, (l) => Math.round(15 * (1 + (l - 1) * 0.10)), '%', '+')}`,
        ];
    }
  }

  if (slot === 1) {
    switch (cType) {
      case 'Fighter':
        return [
          `Tăng Sát Thương: ${formatStatProgression(skillLvl, (l) => Math.round(20 * (1 + (l - 1) * 0.10)), '%', '+')}`,
        ];
      case 'Tank':
        return [
          `Giáp Ảo: ${formatStatProgression(skillLvl, (l) => Math.round(baseHp * (0.50 + (l - 1) * 0.05) * (1 + (l - 1) * 0.10)), '', '+')}`,
        ];
      case 'Mage':
        return [
          `Hồi Mana: ${formatStatProgression(skillLvl, (l) => Math.round((12 + (l - 1) * 2) * (1 + (l - 1) * 0.10)), '/s', '+')}`,
        ];
      case 'Assassin':
        return [
          `Tỉ Lệ Chí Mạng: ${formatStatProgression(skillLvl, (l) => Math.round(30 * (1 + (l - 1) * 0.10)), '%', '+')}`,
          `ST Chí Mạng: ${formatStatProgression(skillLvl, (l) => Math.round(50 * (1 + (l - 1) * 0.10)), '%', '+')}`,
        ];
      case 'Marksman':
        return [
          `Tốc Đánh: ${formatStatProgression(skillLvl, (l) => Math.round(70 * (1 + (l - 1) * 0.10)), '%', '+')}`,
          'Tốc Chạy: +50%',
        ];
    }
  }

  if (slot === 2) {
    switch (cType) {
      case 'Fighter':
        return [
          `Sát Thương: ${formatStatProgression(skillLvl, (l) => Math.round(baseAtk * 2.1 * (1 + (l - 1) * 0.10)))}`,
          'Hiệu Ứng: Đẩy lùi',
        ];
      case 'Tank':
        return [
          `Sát Thương: ${formatStatProgression(skillLvl, (l) => Math.round(baseAtk * 1.8 * (1 + (l - 1) * 0.10)))}`,
          'Hiệu Ứng: Đẩy lùi',
        ];
      case 'Mage':
        return [
          `Sát Thương: ${formatStatProgression(skillLvl, (l) => Math.round(baseAtk * 1.15 * (1 + (l - 1) * 0.10)))} (x10)`,
          'Hiệu Ứng: Đẩy lùi',
        ];
      case 'Assassin':
        return [
          `Sát Thương: ${formatStatProgression(skillLvl, (l) => Math.round(baseAtk * 2.2 * (1 + (l - 1) * 0.10)))}`,
          'Hiệu Ứng: 50% ST Chuẩn',
        ];
      case 'Marksman':
        return [
          `Sát Thương: ${formatStatProgression(skillLvl, (l) => Math.round(baseAtk * 1.6 * (1 + (l - 1) * 0.10)))} (x5)`,
          'Hiệu Ứng: Xuyên thấu',
        ];
    }
  }

  if (slot === 3) {
    switch (cType) {
      case 'Fighter':
        return [
          `Tốc Đánh: ${formatStatProgression(skillLvl, (l) => Math.round(60 * (1 + (l - 1) * 0.10)), '%', '+')}`,
          'Hiệu Ứng: 100% Đòn gồng',
        ];
      case 'Tank':
        return [
          `Sát Thương: ${formatStatProgression(skillLvl, (l) => Math.round(baseAtk * 2.2 * (1 + (l - 1) * 0.10)))}`,
          'Hiệu Ứng: Hất tung, Làm chậm',
        ];
      case 'Mage':
        return [
          `Sát Thương: ${formatStatProgression(skillLvl, (l) => Math.round(baseAtk * 2.65 * (1 + (l - 1) * 0.10)))} (x3)`,
          'Hiệu Ứng: Choáng, Đẩy lùi',
        ];
      case 'Assassin':
        return [
          `Sát Thương: ${formatStatProgression(skillLvl, (l) => Math.round(baseAtk * 0.72 * (1 + (l - 1) * 0.10)))} (x8)`,
          'Hiệu Ứng: Hồi máu',
        ];
      case 'Marksman':
        return [
          `Sát Thương: ${formatStatProgression(skillLvl, (l) => Math.round(baseAtk * 0.85 * (1 + (l - 1) * 0.10)))} (x16)`,
          'Hiệu Ứng: Xuyên thấu',
        ];
    }
  }

  return [];
};

export const LearnSkillsModal: React.FC<LearnSkillsModalProps> = ({
  isOpen,
  onClose,
  playerLevel,
  activeClass,
  skillSystem,
  onUpgradeSkill,
  onUpgradePassive,
  onUpgradeClassLevel,
  onUnlockSubSlot,
  onAssignSkillSlot,
  onUnlockClass,
  initialTab = 'skills',
}) => {
  const [selectedTabClass, setSelectedTabClass] = useState<ClassType>(activeClass);
  const [activeSubTab, setActiveSubTab] = useState<'skills' | 'fusion' | 'unlock'>(initialTab);
  const [selectingTarget, setSelectingTarget] = useState<{
    slotNumber: 1 | 2 | 3;
    branch: 'main' | 'sub';
  } | null>(null);

  // Sync tab when modal opens or initialTab changes
  useEffect(() => {
    if (isOpen) {
      setActiveSubTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const isClassUnlocked = skillSystem.unlockedClasses.includes(selectedTabClass);
  const preset = CLASS_PRESETS[selectedTabClass];

  const getRequiredLevelForSkill = (nextLvl: number) => {
    if (nextLvl <= 1) return 1;
    return (nextLvl - 1) * 5;
  };

  const handleIncrease = (slot: 'passive' | 1 | 2 | 3, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isClassUnlocked) return;

    if (slot === 'passive') {
      const currentLvl = skillSystem.passiveLevels[selectedTabClass] || 0;
      const skillCost = getSkillUpgradeCost('passive', currentLvl);
      if (currentLvl >= 10 || skillSystem.skillPoints < skillCost) return;
      const reqLevel = getRequiredLevelForSkill(currentLvl + 1);
      if (playerLevel < reqLevel) {
        sounds.playClick();
        return;
      }
      sounds.playLevelUp?.();
      onUpgradePassive?.(selectedTabClass);
      return;
    }

    // Điều kiện học tuần tự:
    // Chiêu 1 cần Nội tại Lv 1
    if (slot === 1) {
      const passiveLvl = skillSystem.passiveLevels[selectedTabClass] || 0;
      if (passiveLvl < 1) {
        sounds.playClick();
        return;
      }
    }
    // Chiêu 2 cần Chiêu 1 Lv 1
    else if (slot === 2) {
      const s1Lvl = skillSystem.skillLevels[`${selectedTabClass}_1`] || 0;
      if (s1Lvl < 1) {
        sounds.playClick();
        return;
      }
    }
    // Chiêu 3 cần Chiêu 2 Lv 1
    else if (slot === 3) {
      const s2Lvl = skillSystem.skillLevels[`${selectedTabClass}_2`] || 0;
      if (s2Lvl < 1) {
        sounds.playClick();
        return;
      }
    }

    const nodeId = `${selectedTabClass}_${slot}` as SkillNodeId;
    const currentLvl = skillSystem.skillLevels[nodeId] || 0;
    const skillCost = getSkillUpgradeCost(slot, currentLvl);
    if (currentLvl >= 10 || skillSystem.skillPoints < skillCost) return;

    const reqLevel = getRequiredLevelForSkill(currentLvl + 1);
    if (playerLevel < reqLevel) {
      sounds.playClick();
      return;
    }

    sounds.playLevelUp?.();
    onUpgradeSkill(nodeId);
  };

  const skillCardsList: ('passive' | 1 | 2 | 3)[] = ['passive', 1, 2, 3];

  // Logic values for class unlocking
  const unlockedCount = skillSystem.unlockedClasses.length;
  const requiredLevelForNext = unlockedCount === 0 ? 1 : unlockedCount * 10;

  // Logic values for skill fusion
  const learnedSkillNodes: SkillNodeId[] = (Object.keys(skillSystem.skillLevels) as SkillNodeId[]).filter(
    (nodeId) => (skillSystem.skillLevels[nodeId] || 0) > 0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-3 select-none animate-fadeIn overflow-hidden">
      {/* Khung Container Cố Định Kích Thước (Đồng bộ diện tích chuẩn max-w-[550px] h-[250px] sm:h-[260px]) */}
      <div className="relative w-full max-w-[550px] h-[250px] sm:h-[260px] bg-[#0b1120] border border-slate-700/80 rounded-xl shadow-[0_0_40px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden text-slate-100 shrink-0">
        
        {/* 1. THANH TIÊU ĐỀ (HEADER ZONE) - Có tab chuyển đổi sọc xiên */}
        <div className="h-[42px] px-3.5 flex items-center justify-between bg-[#070b14] border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <h2 className="text-xs sm:text-sm font-black tracking-wide text-white uppercase font-mono shrink-0 hidden xs:block">
              BẢNG KỸ NĂNG
            </h2>
            
            {/* 3 Lựa chọn chuyển đổi kèm sọc ngăn giữa */}
            <div className="flex items-center bg-slate-950/80 rounded-lg border border-slate-800/80 px-2 py-0.5 text-[11px] sm:text-xs text-slate-400 font-bold shrink-0">
              <button
                onClick={() => {
                  sounds.playClick();
                  setActiveSubTab('skills');
                }}
                className={`px-2.5 py-0.5 transition cursor-pointer whitespace-nowrap rounded ${
                  activeSubTab === 'skills' ? 'text-sky-400 font-black bg-sky-950/40' : 'hover:text-slate-200'
                }`}
              >
                Kỹ năng
              </button>
              
              <span className="text-slate-800 px-1.5 font-bold select-none">/</span>
              
              <button
                onClick={() => {
                  sounds.playClick();
                  setActiveSubTab('fusion');
                }}
                className={`px-2.5 py-0.5 transition cursor-pointer whitespace-nowrap rounded ${
                  activeSubTab === 'fusion' ? 'text-sky-400 font-black bg-sky-950/40' : 'hover:text-slate-200'
                }`}
              >
                Ghép kỹ năng
              </button>
              
              <span className="text-slate-800 px-1.5 font-bold select-none">/</span>
              
              <button
                onClick={() => {
                  sounds.playClick();
                  setActiveSubTab('unlock');
                }}
                className={`px-2.5 py-0.5 transition cursor-pointer whitespace-nowrap rounded ${
                  activeSubTab === 'unlock' ? 'text-sky-400 font-black bg-sky-950/40' : 'hover:text-slate-200'
                }`}
              >
                Học class
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Cụm Điểm kỹ năng */}
            <div className="px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-400 text-amber-300 font-black text-xs flex items-center gap-1.5 shadow-[0_0_8px_rgba(245,158,11,0.25)] shrink-0 font-mono">
              <Sparkles size={14} className="text-amber-300 fill-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]" strokeWidth={2.5} />
              <span>{skillSystem.skillPoints}</span>
            </div>

            <button
              onClick={() => {
                sounds.playClick();
                onClose();
              }}
              className="w-7 h-7 rounded-md bg-slate-800 hover:bg-rose-900 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center transition cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* 2. CHUYỂN ĐỔI BÊN TRONG THEO TAB HOẠT ĐỘNG (Đồng bộ diện tích cố định chuẩn - Tuyệt đối không thanh cuộn dọc) */}
        <div className="h-[208px] sm:h-[218px] overflow-hidden flex-shrink-0 flex flex-col justify-start">
          
          {/* TAB 1: BẢNG KỸ NĂNG CHÍNH */}
          {activeSubTab === 'skills' && (
            <>
              {/* HÀNG CHỌN HỆ PHÁI (CLASS TABS BAR - Đã thu bé gọn gàng) */}
              <div className="px-2 pt-1.5 pb-1 grid grid-cols-5 gap-1 shrink-0 overflow-x-hidden border-b border-slate-950/80 bg-slate-950/20">
                {ALL_CLASS_TYPES.map((cType) => {
                  const cPreset = CLASS_PRESETS[cType];
                  const isUnlocked = skillSystem.unlockedClasses.includes(cType);
                  const isSelected = selectedTabClass === cType;
                  const iconEmoji = CLASS_ICONS[cType];

                  return (
                    <button
                      key={cType}
                      onClick={() => {
                        sounds.playClick();
                        setSelectedTabClass(cType);
                      }}
                      className={`h-[25px] rounded-md flex items-center justify-center gap-1 font-bold transition cursor-pointer px-0.5 shrink-0 ${
                        isSelected
                          ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white border border-sky-400/80 shadow-[0_0_8px_rgba(56,189,248,0.4)] font-black'
                          : 'bg-white/[0.02] text-slate-400 border border-white/[0.04] hover:bg-white/[0.06] hover:text-slate-200'
                      }`}
                    >
                      <span className="text-[11px] shrink-0">{iconEmoji}</span>
                      <span className="truncate text-[9.5px] tracking-tight">{cPreset.name}</span>
                      {isUnlocked && <Check size={9} className={isSelected ? 'text-white' : 'text-emerald-400 shrink-0'} />}
                    </button>
                  );
                })}
              </div>

              {/* LƯỚI THẺ CHIÊU THỨC (Đẩy thẻ lên trên cùng, sát vào vạch phân cách, lấp đầy diện tích cố định không cuộn dọc) */}
              <div className="px-2 pt-0 pb-1 flex-1">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 h-full">
                  {skillCardsList.map((slot) => {
                    const isPassive = slot === 'passive';
                    const skillDef = isPassive
                      ? null
                      : slot === 1
                      ? preset.skill1
                      : slot === 2
                      ? preset.skill2
                      : preset.skill3;

                    const nodeId = isPassive ? null : (`${selectedTabClass}_${slot}` as SkillNodeId);
                    const currentLvl = isPassive
                      ? skillSystem.passiveLevels[selectedTabClass] || 0
                      : skillSystem.skillLevels[nodeId!] || 0;

                    // Điều kiện học tuần tự: Chiêu 1 cần Nội tại Lv 1, Chiêu 2 cần Chiêu 1 Lv 1, Chiêu 3 cần Chiêu 2 Lv 1
                    const isPrereqMet =
                      isPassive
                        ? true
                        : slot === 1
                        ? (skillSystem.passiveLevels[selectedTabClass] || 0) >= 1
                        : slot === 2
                        ? (skillSystem.skillLevels[`${selectedTabClass}_1`] || 0) >= 1
                        : (skillSystem.skillLevels[`${selectedTabClass}_2`] || 0) >= 1;

                    const prereqText =
                      isPassive
                        ? ''
                        : slot === 1
                        ? 'Cần Nội tại Lv 1'
                        : slot === 2
                        ? 'Cần Chiêu 1 Lv 1'
                        : 'Cần Chiêu 2 Lv 1';

                    const reqLevel = getRequiredLevelForSkill(currentLvl + 1);
                    const shortStats = getSkillRealStats(selectedTabClass, slot, currentLvl, playerLevel);

                    const skillDisplayName = isPassive
                      ? formatCleanName(preset.passiveName)
                      : formatCleanName(skillDef!.name);

                    const skillCost = getSkillUpgradeCost(slot, currentLvl);

                    const canIncrease =
                      isClassUnlocked &&
                      isPrereqMet &&
                      skillSystem.skillPoints >= skillCost &&
                      currentLvl < 10 &&
                      playerLevel >= reqLevel;

                    return (
                      <div
                        key={isPassive ? 'card_passive' : nodeId}
                        className={`w-full h-[158px] sm:h-[168px] rounded-xl bg-slate-900/95 border p-2 flex flex-col justify-between relative select-none transition shrink-0 ${
                          !isClassUnlocked || !isPrereqMet
                            ? 'opacity-65 border-slate-800'
                            : 'border-slate-800 hover:border-slate-700 shadow-md'
                        }`}
                      >
                        {/* Trạng thái Chưa học Class */}
                        {!isClassUnlocked ? (
                          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/65 rounded-xl">
                            <Lock size={16} className="text-amber-400" />
                            <span className="text-[9px] font-bold text-amber-300 mt-1">Chưa Mở Khóa Hệ</span>
                          </div>
                        ) : !isPrereqMet ? (
                          /* Trạng thái Khóa do chưa học kỹ năng trước đó */
                          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75 rounded-xl p-1 text-center select-none">
                            <Lock size={15} className="text-amber-400 mb-0.5" />
                            <span className="text-[8px] font-bold text-amber-300 leading-tight">
                              Khóa
                            </span>
                            <span className="text-[7.5px] font-mono font-bold text-slate-300 mt-0.5">
                              {prereqText}
                            </span>
                          </div>
                        ) : null}

                        <div className="flex-1 flex flex-col overflow-hidden relative">
                          {/* Header Thẻ: Icon + Tên + Cấp */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div
                              className="w-[22px] h-[22px] rounded-lg flex items-center justify-center font-black text-xs shrink-0 border shadow"
                              style={{
                                backgroundColor: isPassive ? '#0284c722' : `${skillDef?.color}22`,
                                borderColor: isPassive ? '#38bdf8' : skillDef?.color,
                                color: isPassive ? '#38bdf8' : skillDef?.color,
                              }}
                            >
                              {isPassive ? '🛡️' : slot === 1 ? '⚡' : slot === 2 ? '🔥' : '💥'}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <span className="bg-slate-950 text-sky-300 border-sky-800/60 text-[7px] sm:text-[7.5px] font-bold uppercase px-1 rounded border leading-none">
                                  {isPassive ? 'Nội tại' : `Chiêu ${slot}`}
                                </span>
                                <span className="text-[8.5px] sm:text-[9px] font-bold text-amber-300 font-mono leading-none">
                                  Lv {currentLvl}/10
                                </span>
                              </div>
                              <h4 className="text-[9px] sm:text-[9.5px] font-black text-white truncate leading-tight mt-0.5" title={skillDisplayName}>
                                {skillDisplayName}
                              </h4>
                            </div>
                          </div>

                          {/* CD & Mana Row */}
                          <div className="h-[15px] flex items-center gap-1.5 mt-1 px-1.5 rounded bg-slate-950/80 border border-slate-800/80 text-[7.5px] sm:text-[8px] text-slate-300 font-mono shrink-0 leading-none">
                            {isPassive ? (
                              <>
                                <span className="text-sky-400 font-bold">Vĩnh Viễn</span>
                                <span className="text-slate-600">•</span>
                                <span>0 MP</span>
                              </>
                            ) : (
                              <>
                                <span>⏱️ {Math.max(1.5, +(skillDef!.cooldown * (1 - currentLvl * 0.03)).toFixed(1))}s</span>
                                <span className="text-slate-600">•</span>
                                <span>{skillDef!.manaCost} MP</span>
                              </>
                            )}
                          </div>

                          {/* PHẦN GIẢI THÍCH CHIÊU */}
                          <div className="mt-1 space-y-0.5 text-[8px] sm:text-[8.5px] leading-tight text-slate-300 flex-1 overflow-hidden flex flex-col justify-start">
                            {shortStats.map((st, sIdx) => (
                              <div key={sIdx} className="flex items-start gap-1">
                                <span className="text-sky-400 font-bold shrink-0">•</span>
                                <span className="text-slate-200 line-clamp-2 leading-tight">{st}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Nút hành động & Cấp yêu cầu ở chân thẻ */}
                        {isClassUnlocked && (
                          <div className="pt-1 mt-0.5 border-t border-slate-800/80 flex items-center justify-between shrink-0">
                            {!isPrereqMet ? (
                              <span className="text-[7.5px] font-mono font-bold text-amber-400/90 leading-none">
                                {prereqText}
                              </span>
                            ) : currentLvl < 10 && playerLevel < reqLevel ? (
                              <span className="text-[8px] font-mono font-bold text-rose-400 leading-none">
                                Cần Lv{reqLevel}
                              </span>
                            ) : (
                              <span className="text-[7.5px] font-mono text-slate-400 flex items-center gap-0.5">
                                {currentLvl >= 10 ? (
                                  'Tối đa'
                                ) : (
                                  <>
                                    <span className="text-amber-300 font-black">{skillCost}</span>
                                    <Sparkles size={9} className="text-amber-300 fill-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.6)] shrink-0" strokeWidth={2.5} />
                                  </>
                                )}
                              </span>
                            )}
                            
                            <button
                              onClick={(e) => handleIncrease(slot, e)}
                              disabled={!canIncrease}
                              className={`px-1.5 py-0.5 rounded font-black text-[8px] sm:text-[8.5px] flex items-center justify-center gap-0.5 transition cursor-pointer active:scale-95 ${
                                currentLvl >= 10
                                  ? 'bg-slate-950 text-emerald-400 border border-emerald-950 cursor-not-allowed text-[7.5px] font-bold py-0.5 px-1.5'
                                  : canIncrease
                                  ? 'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white border border-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.4)]'
                                  : 'bg-slate-950/80 text-slate-600 border border-slate-800/60 cursor-not-allowed'
                              }`}
                              title={!isPrereqMet ? prereqText : undefined}
                            >
                              {currentLvl >= 10 ? (
                                'Max'
                              ) : (
                                <>
                                  <span>+</span>
                                  <span>Học</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* TAB 2: GHÉP KỸ NĂNG (Bố cục chia đôi màn hình Side-by-Side 50/50 - Diện tích cố định) */}
          {activeSubTab === 'fusion' && (
            <div className="p-2 sm:p-3 grid grid-cols-2 gap-4 items-stretch h-full overflow-hidden">
              
              {/* NỬA BÊN TRÁI: 50% width với border-r */}
              <div className="border-r border-slate-800/80 pr-4 flex flex-col h-full justify-between">
                <div className="bg-slate-950/40 rounded-xl border border-slate-800/60 divide-y divide-slate-800/80 flex-1 flex flex-col justify-center">
                  {([1, 2, 3] as const).map((slotNum) => {
                    const fusion = skillSystem.equippedSlots[slotNum];
                    const mainDef = fusion.main ? getSkillDefinitionByNodeId(fusion.main) : null;
                    const subDef = fusion.sub ? getSkillDefinitionByNodeId(fusion.sub) : null;
                    const isSubUnlocked = skillSystem.unlockedSubSlots?.[slotNum] ?? false;
                    const unlockCost = SUB_SLOT_UNLOCK_COSTS[slotNum];
                    const canAffordSub = skillSystem.skillPoints >= unlockCost;

                    return (
                      <div
                        key={slotNum}
                        className="flex flex-row items-center justify-between gap-1.5 p-1 sm:p-1.5 flex-1"
                      >
                        {/* Tên Phím */}
                        <div className="w-[48px] sm:w-[58px] flex-shrink-0 flex flex-col">
                          <span className="font-mono font-black text-sky-400 uppercase tracking-wider text-[9px] sm:text-[10px]">
                            Phím {slotNum}
                          </span>
                          <span className="text-[7.5px] text-slate-500 font-medium font-mono whitespace-nowrap">
                            {mainDef && subDef ? 'Combo' : mainDef || subDef ? '1 Chiêu' : 'Trống'}
                          </span>
                        </div>

                        {/* Ô chọn nhánh chính */}
                        <button
                          onClick={() => {
                            sounds.playClick();
                            setSelectingTarget({ slotNumber: slotNum, branch: 'main' });
                          }}
                          className={`flex-1 h-[26px] sm:h-[30px] rounded-lg border transition flex items-center justify-center cursor-pointer font-mono font-black text-[9px] sm:text-[10px] min-w-0 ${
                            selectingTarget?.slotNumber === slotNum && selectingTarget?.branch === 'main'
                              ? 'bg-blue-600/90 border-white text-white shadow-[0_0_10px_rgba(56,189,248,0.5)]'
                              : fusion.main
                              ? 'bg-slate-900 border-sky-900/40 text-sky-300 hover:border-sky-500/50'
                              : 'bg-slate-950/80 border-dashed border-slate-800 text-slate-500 hover:border-sky-500/50'
                          }`}
                          title={mainDef ? `Nhánh chính: ${mainDef.name}` : 'Chọn chiêu chính'}
                        >
                          <span className="truncate">
                            {fusion.main ? formatSkillAbbreviation(fusion.main) : 'Ô 1'}
                          </span>
                        </button>

                        {/* Mũi tên ngang */}
                        <div className="flex-shrink-0 text-sky-400 text-[9px] font-black font-mono select-none px-0.5">
                          ➔
                        </div>

                        {/* Ô chọn nhánh phụ (Khóa: Phím 1 = 10đ, Phím 2 = 100đ, Phím 3 = 1000đ) */}
                        {!isSubUnlocked ? (
                          <button
                            onClick={() => {
                              if (canAffordSub) {
                                sounds.playLevelUp?.();
                                onUnlockSubSlot?.(slotNum);
                              } else {
                                sounds.playClick();
                              }
                            }}
                            className={`flex-1 h-[26px] sm:h-[30px] rounded-lg border transition flex items-center justify-center cursor-pointer font-mono font-black text-[8.5px] sm:text-[9.5px] min-w-0 ${
                              canAffordSub
                                ? 'bg-amber-950/40 border-amber-500/70 hover:bg-amber-900/60 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.25)] active:scale-95'
                                : 'bg-slate-950/80 border-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                            title={`Mở khóa Ô 2: Cần ${unlockCost} Điểm Kỹ Năng`}
                          >
                            <div className="flex items-center gap-1 truncate px-1 justify-center">
                              <Lock size={9} className={canAffordSub ? 'text-amber-400 shrink-0' : 'text-slate-500 shrink-0'} />
                              <span className={`truncate font-black font-mono ${canAffordSub ? 'text-amber-300' : 'text-slate-400'}`}>{unlockCost}</span>
                              <Sparkles size={10} className={canAffordSub ? 'text-amber-300 fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)] shrink-0' : 'text-slate-400 fill-slate-500 shrink-0'} strokeWidth={2.5} />
                            </div>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              sounds.playClick();
                              setSelectingTarget({ slotNumber: slotNum, branch: 'sub' });
                            }}
                            className={`flex-1 h-[26px] sm:h-[30px] rounded-lg border transition flex items-center justify-center cursor-pointer font-mono font-black text-[9px] sm:text-[10px] min-w-0 ${
                              selectingTarget?.slotNumber === slotNum && selectingTarget?.branch === 'sub'
                                ? 'bg-blue-600/90 border-white text-white shadow-[0_0_10px_rgba(56,189,248,0.5)]'
                                : fusion.sub
                                ? 'bg-slate-900 border-sky-900/40 text-sky-300 hover:border-sky-500/50'
                                : 'bg-slate-950/80 border-dashed border-slate-800 text-slate-500 hover:border-sky-500/50'
                            }`}
                            title={subDef ? `Nhánh phụ: ${subDef.name}` : 'Chọn chiêu phụ'}
                          >
                            <span className="truncate">
                              {fusion.sub ? formatSkillAbbreviation(fusion.sub) : 'Ô 2'}
                            </span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* NỬA BÊN PHẢI: Khung chọn kỹ năng (Skill Selection Panel) - 50% width */}
              <div className="flex flex-col h-full justify-start min-h-[110px] sm:min-h-[130px]">
                {selectingTarget ? (
                  <div className="p-2 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-1.5 flex-1 flex flex-col justify-between overflow-hidden">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-1">
                      <div className="flex flex-col min-w-0">
                        <span className="text-[8.5px] font-bold text-sky-400 uppercase tracking-tight font-mono">ĐANG CHỌN CHIÊU</span>
                        <span className="text-[9.5px] font-black text-white truncate font-mono">
                          Phím {selectingTarget.slotNumber} — {selectingTarget.branch === 'main' ? 'Ô 1 (Chính)' : 'Ô 2 (Phụ)'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => {
                            onAssignSkillSlot?.(selectingTarget.slotNumber, selectingTarget.branch, null);
                            setSelectingTarget(null);
                          }}
                          className="px-2 py-0.5 bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-500/40 text-[8px] font-bold rounded cursor-pointer"
                        >
                          Gỡ Chiêu
                        </button>
                        <button
                          onClick={() => setSelectingTarget(null)}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[8px] font-bold rounded cursor-pointer"
                        >
                          Đóng
                        </button>
                      </div>
                    </div>

                    {learnedSkillNodes.length === 0 ? (
                      <div className="text-[9.5px] text-amber-300 py-2 text-center flex-1 flex items-center justify-center">
                        Bạn chưa học kỹ năng nào! Hãy chọn chế độ &quot;Kỹ năng&quot; để nâng chiêu trước.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-1 max-h-[140px] overflow-y-auto custom-scrollbar p-0.5">
                        {learnedSkillNodes.map((nId) => {
                          const sDef = getSkillDefinitionByNodeId(nId);
                          const cPreset = CLASS_PRESETS[sDef.classId!];
                          const sLvl = skillSystem.skillLevels[nId] || 1;
                          return (
                            <button
                              key={nId}
                              onClick={() => {
                                sounds.playClick();
                                onAssignSkillSlot?.(selectingTarget.slotNumber, selectingTarget.branch, nId);
                                setSelectingTarget(null);
                              }}
                              className="p-1 rounded bg-slate-900/90 hover:bg-sky-900/60 border border-slate-800/80 hover:border-sky-500/50 text-left transition cursor-pointer group min-w-0"
                            >
                              <div className="flex items-center justify-between text-[7.5px] font-bold text-sky-400">
                                <span className="truncate">{cPreset.name}</span>
                                <span className="flex-shrink-0">Lv {sLvl}</span>
                              </div>
                              <div className="text-[9px] font-black text-white mt-0.5 truncate leading-none">{sDef.name}</div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-center p-3 text-slate-500 text-[9.5px] min-h-[110px] sm:min-h-[130px] flex-1">
                    <Layers size={18} className="text-slate-600 mb-1.5 animate-pulse" />
                    <span>Chọn một ô bên trái (Ô 1 hoặc Ô 2) để gắn kỹ năng</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: HỌC CLASS MỚI (Luyện từng Class đạt Cấp X rồi mới mở chọn Class tiếp theo) */}
          {activeSubTab === 'unlock' && (() => {
            // Tìm Class đang được luyện dở (0 < level < 10)
            const inProgressClass = ALL_CLASS_TYPES.find((c) => {
              const lvl = skillSystem.classLevels?.[c] ?? (skillSystem.unlockedClasses.includes(c) ? 1 : 0);
              return lvl > 0 && lvl < 10;
            });
            const inProgressLvl = inProgressClass
              ? (skillSystem.classLevels?.[inProgressClass] ?? (skillSystem.unlockedClasses.includes(inProgressClass) ? 1 : 0))
              : 0;
            const inProgressPreset = inProgressClass ? CLASS_PRESETS[inProgressClass] : null;

            const maxedCount = ALL_CLASS_TYPES.filter((c) => {
              const lvl = skillSystem.classLevels?.[c] ?? (skillSystem.unlockedClasses.includes(c) ? 1 : 0);
              return lvl >= 10;
            }).length;

            return (
              <div className="p-2 flex flex-col justify-between h-full overflow-hidden">
                {/* Thanh thông tin cấp độ & trạng thái mở khóa */}
                <div className="h-[26px] px-2.5 bg-slate-950/80 border border-slate-800/80 rounded-lg flex items-center justify-between text-[9.5px] sm:text-[10px] shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-bold text-sky-400 shrink-0">
                      Cấp NV: <span className="text-white font-mono font-black">LV {playerLevel}</span>
                    </span>
                    <span className="text-slate-600 font-bold shrink-0">•</span>
                    {inProgressClass && inProgressPreset ? (
                      <span className="text-[8.5px] text-amber-300 font-medium truncate">
                        Đang luyện <span className="text-white font-bold">{inProgressPreset.name}</span> • <span className="text-amber-400 font-mono font-black">Đạt Cấp X ({inProgressLvl}/10)</span>
                      </span>
                    ) : maxedCount >= 5 ? (
                      <span className="text-[8.5px] text-emerald-400 font-bold flex items-center gap-1 truncate">
                        <Check size={10} className="text-emerald-400" />
                        Đã tinh thông toàn bộ 5 Class (Cấp X)
                      </span>
                    ) : (
                      <span className="text-[8.5px] text-emerald-400 font-bold flex items-center gap-1 truncate">
                        <Check size={10} className="text-emerald-400" />
                        Chọn 1 Class bất kỳ để luyện Cấp
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-amber-300 font-mono shrink-0 pl-2">
                    <Sparkles size={12} className="text-amber-300 fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)] shrink-0" strokeWidth={2.5} />
                    <span className="text-amber-400 font-black">{skillSystem.skillPoints}</span>
                  </div>
                </div>

                {/* Lưới 5 Hệ Phái đồng nhất với Tab 1 */}
                <div className="grid grid-cols-5 gap-1.5 pt-1.5 flex-1 items-stretch">
                  {ALL_CLASS_TYPES.map((cType) => {
                    const cPreset = CLASS_PRESETS[cType];
                    const curLvl = skillSystem.classLevels?.[cType] ?? (skillSystem.unlockedClasses.includes(cType) ? 1 : 0);
                    const isMax = curLvl >= 10;
                    // Khóa nếu đang có 1 Class khác đang luyện dở (0 < level < 10) và class này chưa học (curLvl === 0)
                    const isLocked = inProgressClass !== undefined && curLvl === 0;
                    const cost = getClassUpgradeCost(curLvl);
                    const canUpgrade = !isLocked && !isMax && skillSystem.skillPoints >= cost;
                    const iconEmoji = CLASS_ICONS[cType];

                    return (
                      <div
                        key={cType}
                        className={`rounded-xl border p-1.5 flex flex-col justify-between select-none transition relative shrink-0 ${
                          isLocked
                            ? 'bg-slate-950/70 border-slate-800/80 opacity-75'
                            : curLvl > 0
                            ? 'bg-slate-900/95 border-sky-800/60 shadow-md'
                            : 'bg-slate-950/60 border-slate-800/80 opacity-90'
                        }`}
                      >
                        {/* Khóa mờ: Chỉ hiển thị Khóa và Đạt Cấp X */}
                        {isLocked && (
                          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75 rounded-xl p-1 text-center">
                            <Lock size={16} className="text-rose-400 mb-0.5" />
                            <span className="text-[8.5px] font-bold text-rose-300 leading-tight">
                              Khóa
                            </span>
                            <span className="text-[7.5px] font-mono font-black text-amber-300 mt-0.5">
                              Đạt Cấp X
                            </span>
                          </div>
                        )}

                        {/* Header Thẻ: Icon + Tên + SỐ LA MÃ DƯỚI TÊN CLASS */}
                        <div className="flex flex-col items-center text-center">
                          <div className="w-[26px] h-[26px] rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-sm shadow">
                            {iconEmoji}
                          </div>
                          <h3 className="text-[10px] font-black text-white mt-0.5 truncate w-full">{cPreset.name}</h3>
                          {/* Số La Mã hiển thị dưới tên class */}
                          <div className="mt-0.5">
                            <span className={`px-1 py-0.2 rounded font-mono font-black text-[8.5px] leading-tight border ${
                              curLvl > 0
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-[0_0_6px_rgba(245,158,11,0.25)]'
                                : 'bg-slate-950 text-slate-500 border-slate-800'
                            }`}>
                              {curLvl > 0 ? `Cấp ${toRoman(curLvl)}` : 'Chưa học'}
                            </span>
                          </div>
                        </div>

                        {/* Chỉ số cộng dồn cấp số cộng: Bỏ dấu cộng trước số */}
                        <div className="bg-slate-950/80 border border-slate-900 rounded p-1 text-[7px] sm:text-[7.5px] font-mono text-slate-300 space-y-0.5 leading-none">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400 font-bold">Công:</span>
                            <span className="text-amber-300 font-black">
                              {curLvl * 5} {curLvl < 10 && <span className="text-slate-500 font-bold">→ {(curLvl + 1) * 5}</span>}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400 font-bold">Máu:</span>
                            <span className="text-emerald-300 font-black">
                              {curLvl * 20} {curLvl < 10 && <span className="text-slate-500 font-bold">→ {(curLvl + 1) * 20}</span>}
                            </span>
                          </div>
                        </div>

                        {/* Nút nâng cấp cấp độ class: Bỏ dấu cộng trước số */}
                        <div className="w-full pt-1 border-t border-slate-800/80">
                          {isMax ? (
                            <div className="w-full py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-black text-[8.5px] flex items-center justify-center gap-1 select-none">
                              <Check size={10} className="text-emerald-400" />
                              <span>Max ({toRoman(10)})</span>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                if (!canUpgrade) return;
                                sounds.playLevelUp?.();
                                if (onUpgradeClassLevel) {
                                  onUpgradeClassLevel(cType);
                                } else if (onUnlockClass) {
                                  onUnlockClass(cType);
                                }
                              }}
                              disabled={!canUpgrade}
                              className={`w-full py-0.5 rounded font-black text-[8px] sm:text-[8.5px] flex items-center justify-center gap-1 transition ${
                                canUpgrade
                                  ? 'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white border border-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.5)] active:scale-95 cursor-pointer'
                                  : 'bg-slate-950 text-slate-500 border border-slate-800/80 cursor-not-allowed'
                              }`}
                              title={
                                isLocked
                                  ? 'Khóa • Đạt Cấp X'
                                  : `Nâng lên Cấp ${toRoman(curLvl + 1)} tốn ${cost} điểm kỹ năng`
                              }
                            >
                              <span>Cấp {toRoman(curLvl + 1)}</span>
                              <div className="flex items-center gap-0.5 text-amber-300 font-mono">
                                <span className="font-black">{cost}</span>
                                <Sparkles size={9} className="text-amber-300 fill-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.6)] shrink-0" strokeWidth={2.5} />
                              </div>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

      </div>
    </div>
  );
};
