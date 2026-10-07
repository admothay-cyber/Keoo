import React, { useState } from 'react';
import { ClassType, SkillNodeId, SkillSystemState } from '../types/game';
import { ALL_CLASS_TYPES, CLASS_PRESETS, getSkillDefinitionByNodeId } from '../data/classPresets';
import { X, BookOpen, Sparkles, Lock, Check, ArrowRight, Layers, Shield, Zap, Flame } from 'lucide-react';
import { sounds } from '../audio/soundEffects';

interface SkillTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerLevel: number;
  activeClass: ClassType;
  skillSystem: SkillSystemState;
  onUnlockClass: (targetClass: ClassType) => void;
  onUpgradeSkill: (nodeId: SkillNodeId) => void;
  onUpgradePassive: (targetClass: ClassType) => void;
  onAssignSkillSlot: (slotNumber: 1 | 2 | 3, branch: 'main' | 'sub', nodeId: SkillNodeId | null) => void;
}

export const SkillTreeModal: React.FC<SkillTreeModalProps> = ({
  isOpen,
  onClose,
  playerLevel,
  activeClass,
  skillSystem,
  onUnlockClass,
  onUpgradeSkill,
  onUpgradePassive,
  onAssignSkillSlot,
}) => {
  const [selectedTabClass, setSelectedTabClass] = useState<ClassType>(activeClass);
  const [selectingSlotTarget, setSelectingSlotTarget] = useState<{
    slotNumber: 1 | 2 | 3;
    branch: 'main' | 'sub';
  } | null>(null);

  if (!isOpen) return null;

  const isClassUnlocked = skillSystem.unlockedClasses.includes(selectedTabClass);
  const unlockedCount = skillSystem.unlockedClasses.length;
  // Hệ đầu tiên mở ở cấp 1, mỗi hệ tiếp theo yêu cầu thêm 5 cấp (1 -> 5 -> 10 -> 15 -> 20)
  // Không mất kinh nghiệm khi học
  const requiredLevelForNextClass = unlockedCount === 0 ? 1 : unlockedCount * 5;
  const canUnlockThisClass = !isClassUnlocked && playerLevel >= requiredLevelForNextClass;

  const preset = CLASS_PRESETS[selectedTabClass];
  const passiveLvl = skillSystem.passiveLevels[selectedTabClass] || 0;

  // Tất cả kỹ năng đã học (level >= 1) từ mọi hệ phái để ghép vào Ô 1 (Nhánh chính) và Ô 2 (Nhánh phụ)
  const allLearnedSkillNodes: SkillNodeId[] = (Object.keys(skillSystem.skillLevels) as SkillNodeId[]).filter(
    (nodeId) => (skillSystem.skillLevels[nodeId] || 0) > 0
  );

  const renderSkillTimelineRow = (slotIdx: 1 | 2 | 3) => {
    const nodeId = `${selectedTabClass}_${slotIdx}` as SkillNodeId;
    const skillDef = slotIdx === 1 ? preset.skill1 : slotIdx === 2 ? preset.skill2 : preset.skill3;
    const currentLvl = skillSystem.skillLevels[nodeId] || 0;
    const canUpgrade = isClassUnlocked && skillSystem.skillPoints > 0 && currentLvl < 10;

    return (
      <div
        key={nodeId}
        className="chamfer-md bg-slate-900/90 border border-rose-900/50 p-3 sm:p-4 flex flex-col gap-3 shadow-lg"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 chamfer-sm flex items-center justify-center font-black text-base border shadow-md shrink-0"
              style={{
                backgroundColor: `${skillDef.color}22`,
                borderColor: skillDef.color,
                color: skillDef.color,
              }}
            >
              {slotIdx === 1 ? '⚡' : slotIdx === 2 ? '🔥' : '💥'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 chamfer-sm bg-slate-950 text-rose-300 border border-rose-900/50">
                  Kỹ Năng {slotIdx} {slotIdx === 1 ? '• BUFF' : ''}
                </span>
                <h4 className="text-sm sm:text-base font-extrabold text-white">{skillDef.name}</h4>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">{skillDef.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right mr-1">
              <div className="text-[11px] text-slate-400 font-mono">
                Mana: <span className="text-sky-300 font-bold">{skillDef.manaCost}</span> • CD:{' '}
                <span className="text-rose-300 font-bold">
                  {Math.max(1.5, +(skillDef.cooldown * (1 - currentLvl * 0.03)).toFixed(1))}s
                </span>
              </div>
              <div className="text-xs font-bold text-rose-300">
                Cấp hiện tại: {currentLvl} / 10
              </div>
            </div>

            <button
              onClick={() => {
                if (!canUpgrade) return;
                sounds.playLevelUp?.();
                onUpgradeSkill(nodeId);
              }}
              disabled={!canUpgrade}
              className={`px-3 py-2 chamfer-sm font-bold text-xs flex items-center gap-1.5 transition cursor-pointer ${
                canUpgrade
                  ? 'bg-gradient-to-r from-red-950 via-rose-900 to-red-950 hover:from-rose-900 hover:to-red-800 text-rose-100 border border-rose-500/80 hover:shadow-[0_0_15px_rgba(225,29,72,0.65)] active:scale-95'
                  : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
              }`}
            >
              {currentLvl === 0 ? 'Học Chiêu (1 Điểm)' : currentLvl >= 10 ? 'Đã Tối Đa' : 'Nâng Cấp (+1)'}
            </button>
          </div>
        </div>

        {/* Dòng thời gian cấp độ: Cấp 1 -> Cấp 2 -> ... -> Cấp 10 */}
        <div className="w-full overflow-x-auto pb-1">
          <div className="flex items-center min-w-[540px] gap-1 pt-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((lvlStep) => {
              const isUnlockedStep = currentLvl >= lvlStep;
              const isNextStep = currentLvl + 1 === lvlStep && isClassUnlocked;
              return (
                <React.Fragment key={lvlStep}>
                  <button
                    onClick={() => {
                      if (isNextStep && skillSystem.skillPoints > 0) {
                        sounds.playLevelUp?.();
                        onUpgradeSkill(nodeId);
                      }
                    }}
                    disabled={!isNextStep || skillSystem.skillPoints <= 0}
                    className={`flex-1 py-1.5 px-1 chamfer-sm border text-center transition flex flex-col items-center justify-center relative ${
                      isUnlockedStep
                        ? 'bg-rose-950/60 border-rose-500 text-rose-200 shadow-[0_0_10px_rgba(225,29,72,0.35)]'
                        : isNextStep && skillSystem.skillPoints > 0
                        ? 'bg-slate-900 border-rose-500/80 text-rose-200 hover:bg-rose-950/60 cursor-pointer animate-pulse'
                        : 'bg-slate-950/70 border-slate-800 text-slate-600'
                    }`}
                  >
                    <span className="text-[10px] font-extrabold tracking-tight">Cấp {lvlStep}</span>
                    <span className="text-[9px] font-mono opacity-80">
                      {slotIdx === 1 ? `+${lvlStep * 5}% Hiệu lực` : `+${lvlStep * 12}% Uy lực`}
                    </span>
                  </button>
                  {lvlStep < 10 && (
                    <ArrowRight
                      size={12}
                      className={`shrink-0 ${
                        currentLvl >= lvlStep ? 'text-rose-400' : 'text-slate-700'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-2 sm:p-4 select-none">
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-slate-900 border-2 border-rose-600/70 chamfer-lg shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header: [Điểm kỹ năng] -> Kỹ năng 1 2 3 xếp dọc & Kết hợp 2 chiêu */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-950 border-b border-rose-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 chamfer-md bg-rose-950/80 border border-rose-500 flex items-center justify-center text-rose-300 shadow">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wide text-rose-300 uppercase flex items-center gap-2">
                BẢNG KỸ NĂNG & KẾT HỢP CHIÊU THỨC
              </h2>
              <p className="text-[11px] text-slate-400">
                Đạt thêm mỗi 50 cấp để lĩnh ngộ hệ phái mới (không tốn EXP). Nội tại các hệ đã học được cộng dồn vĩnh viễn!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Ô [Điểm Kỹ Năng] */}
            <div className="px-3.5 py-1.5 chamfer-md bg-rose-950/80 border-2 border-rose-500 flex items-center gap-2 shadow-[0_0_15px_rgba(225,29,72,0.4)]">
              <Sparkles size={16} className="text-rose-400" />
              <span className="text-xs font-bold text-rose-200 uppercase">Điểm Kỹ Năng:</span>
              <span className="text-base font-black font-mono text-rose-300">
                {skillSystem.skillPoints}
              </span>
            </div>

            <button
              onClick={() => {
                sounds.playClick();
                onClose();
              }}
              className="w-8 h-8 chamfer-sm bg-slate-900 hover:bg-rose-950/80 text-rose-300 hover:text-white border border-rose-900/50 flex items-center justify-center transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-5">
          {/* PHẦN 1: CHỌN HỆ PHÁI ĐỂ HỌC / NÂNG KỸ NĂNG (Mỗi hệ cách nhau 50 cấp, không mất EXP) */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                1. Chọn Hệ Phái ({unlockedCount}/5 Hệ Đã Lĩnh Ngộ • Cấp Nhân Vật: LV {playerLevel})
              </span>
              <span className="text-xs text-amber-300 font-semibold">
                {unlockedCount < 5
                  ? `Mốc mở hệ tiếp theo: Cấp ${requiredLevelForNextClass} (Hiện tại: LV ${playerLevel})`
                  : 'Đã lĩnh ngộ toàn bộ 5 hệ phái!'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {ALL_CLASS_TYPES.map((cType) => {
                const cPreset = CLASS_PRESETS[cType];
                const unlocked = skillSystem.unlockedClasses.includes(cType);
                const isSelected = selectedTabClass === cType;
                return (
                  <button
                    key={cType}
                    onClick={() => {
                      sounds.playClick();
                      setSelectedTabClass(cType);
                    }}
                    className={`p-2.5 tab-chamfer border text-left transition flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-r from-red-950 via-rose-900 to-red-950 border-rose-500 text-white shadow-[0_0_15px_rgba(225,29,72,0.5)]'
                        : unlocked
                        ? 'bg-slate-900/90 border-slate-800 hover:border-rose-900/60'
                        : 'bg-slate-950/70 border-slate-800/80 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs sm:text-sm font-black" style={{ color: cPreset.color }}>
                        {cPreset.name}
                      </span>
                      {unlocked ? (
                        <span className="text-[10px] px-1.5 py-0.5 chamfer-sm bg-rose-950/80 text-rose-300 border border-rose-500/40 font-bold flex items-center gap-0.5">
                          <Check size={10} /> Đã Học
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 chamfer-sm bg-slate-900 text-slate-400 border border-slate-700 font-mono flex items-center gap-0.5">
                          <Lock size={10} /> LV {requiredLevelForNextClass}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                      Nội tại: {cPreset.passiveName}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Thanh Mở Khóa Hệ Phái hoặc Nâng Cấp Chỉ Số Nội Tại của Hệ Đang Xem */}
            <div className="p-3 sm:p-4 chamfer-md bg-slate-950/90 border border-rose-900/40 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm font-black uppercase tracking-wide"
                    style={{ color: preset.color }}
                  >
                    Nội Tại {preset.name}: {preset.passiveName}
                  </span>
                  {isClassUnlocked && (
                    <span className="text-xs px-2 py-0.5 chamfer-sm bg-rose-950/80 text-rose-300 border border-rose-500/40 font-bold">
                      Đang kích hoạt vĩnh viễn (Cấp {passiveLvl}/10)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300">{preset.passiveDescription}</p>
              </div>

              {!isClassUnlocked ? (
                <button
                  onClick={() => {
                    if (!canUnlockThisClass) return;
                    sounds.playLevelUp?.();
                    onUnlockClass(selectedTabClass);
                  }}
                  disabled={!canUnlockThisClass}
                  className={`px-4 py-2 chamfer-md font-black text-xs uppercase tracking-wider flex items-center gap-2 transition cursor-pointer ${
                    canUnlockThisClass
                      ? 'bg-gradient-to-r from-red-950 via-rose-900 to-red-950 hover:from-rose-900 hover:to-red-800 text-rose-100 border border-rose-500/80 hover:shadow-[0_0_18px_rgba(225,29,72,0.65)]'
                      : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                  }`}
                >
                  <Lock size={14} />
                  {unlockedCount === 0
                    ? `Lĩnh Ngộ Hệ Khởi Đầu (${preset.name}) - Miễn Phí`
                    : `Lĩnh Ngộ Hệ ${preset.name} (Yêu cầu Cấp ${requiredLevelForNextClass})`}
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (skillSystem.skillPoints <= 0 || passiveLvl >= 10) return;
                    sounds.playLevelUp?.();
                    onUpgradePassive(selectedTabClass);
                  }}
                  disabled={skillSystem.skillPoints <= 0 || passiveLvl >= 10}
                  className={`px-3.5 py-2 chamfer-md font-bold text-xs flex items-center gap-1.5 transition cursor-pointer ${
                    skillSystem.skillPoints > 0 && passiveLvl < 10
                      ? 'bg-gradient-to-r from-red-950 via-rose-900 to-red-950 hover:from-rose-900 hover:to-red-800 text-rose-100 border border-rose-500/80 hover:shadow-[0_0_18px_rgba(225,29,72,0.65)]'
                      : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                  }`}
                >
                  <Shield size={14} />
                  {passiveLvl >= 10 ? 'Nội Tại Tối Đa (10/10)' : 'Nâng Chỉ Số Nội Tại (1 Điểm)'}
                </button>
              )}
            </div>
          </div>

          {/* PHẦN 2: SƠ ĐỒ [ĐIỂM KỸ NĂNG] -> KỸ NĂNG 1, 2, 3 XẾP DỌC THEO DÒNG THỜI GIAN CẤP 1 -> CẤP 10 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-300">
              <span>[Điểm Kỹ Năng: {skillSystem.skillPoints}]</span>
              <ArrowRight size={14} />
              <span>Kỹ Năng 1 • 2 • 3 Xếp Dọc ({preset.name})</span>
            </div>

            <div className="flex flex-col gap-3">
              {renderSkillTimelineRow(1)}
              {renderSkillTimelineRow(2)}
              {renderSkillTimelineRow(3)}
            </div>
          </div>

          {/* PHẦN 3: KẾT HỢP 2 CHIÊU VÀO NHAU (Ô 1: NHÁNH CHÍNH RA TRƯỚC -> Ô 2: NHÁNH PHỤ KÍCH HOẠT SAU) */}
          <div className="chamfer-lg bg-slate-950/95 border-2 border-rose-600/60 p-3.5 sm:p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-rose-400" />
                <div>
                  <h3 className="text-sm sm:text-base font-black text-rose-200 uppercase">
                    Khay Kết Hợp 2 Chiêu Thức (Tất Cả Class & Tất Cả Kỹ Năng)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Đặt chiêu vào 2 ô cho mỗi nút kỹ năng: <strong>Ô 1 (Nhánh Chính)</strong> sẽ tung ra trước,{' '}
                    <strong>Ô 2 (Nhánh Phụ)</strong> sẽ tự động kích hoạt nối tiếp ngay sau!
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {([1, 2, 3] as const).map((slotNum) => {
                const fusion = skillSystem.equippedSlots[slotNum];
                const mainDef = fusion.main ? getSkillDefinitionByNodeId(fusion.main) : null;
                const subDef = fusion.sub ? getSkillDefinitionByNodeId(fusion.sub) : null;

                const mainLvl = fusion.main ? Math.max(1, skillSystem.skillLevels[fusion.main] || 1) : 1;
                const subLvl = fusion.sub ? Math.max(1, skillSystem.skillLevels[fusion.sub] || 1) : 1;
                const mainCd = mainDef ? Math.max(1.5, mainDef.cooldown * (1 - mainLvl * 0.03)) : 0;
                const subCd = subDef ? Math.max(1.5, subDef.cooldown * (1 - subLvl * 0.03)) : 0;
                const combinedCd = mainDef || subDef ? +Math.max(mainCd, subCd).toFixed(1) : 0;

                return (
                  <div
                    key={slotNum}
                    className="chamfer-md bg-slate-900 border border-rose-900/50 p-3 flex flex-col gap-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-rose-300">
                        Nút Chiêu {slotNum} (Phím {slotNum})
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {mainDef && subDef
                          ? `2 Chiêu • CD: ${combinedCd}s`
                          : mainDef || subDef
                          ? `1 Chiêu • CD: ${combinedCd}s`
                          : 'Chưa Gắn Chiêu'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Ô 1: Nhánh Chính */}
                      <button
                        onClick={() => {
                          sounds.playClick();
                          setSelectingSlotTarget({ slotNumber: slotNum, branch: 'main' });
                        }}
                        className={`flex-1 p-2.5 chamfer-sm border text-left transition cursor-pointer ${
                          selectingSlotTarget?.slotNumber === slotNum && selectingSlotTarget?.branch === 'main'
                            ? 'bg-rose-950/80 border-rose-500 shadow-[0_0_12px_rgba(225,29,72,0.5)]'
                            : mainDef
                            ? 'bg-slate-800/90 border-rose-600/60 hover:border-rose-400'
                            : 'bg-slate-950 border-dashed border-slate-700 hover:border-slate-500'
                        }`}
                      >
                        <div className="text-[10px] font-bold uppercase text-rose-300">Ô 1 • Nhánh Chính</div>
                        {mainDef ? (
                          <div className="mt-1">
                            <div className="text-xs font-extrabold text-white truncate">{mainDef.name}</div>
                            <div className="text-[10px] text-slate-400">
                              {CLASS_PRESETS[mainDef.classId!]?.name} • Cấp {skillSystem.skillLevels[fusion.main!] || 1}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 mt-1">+ Chọn chiêu chính</div>
                        )}
                      </button>

                      <ArrowRight size={16} className="text-rose-400 shrink-0" />

                      {/* Ô 2: Nhánh Phụ */}
                      <button
                        onClick={() => {
                          sounds.playClick();
                          setSelectingSlotTarget({ slotNumber: slotNum, branch: 'sub' });
                        }}
                        className={`flex-1 p-2.5 chamfer-sm border text-left transition cursor-pointer ${
                          selectingSlotTarget?.slotNumber === slotNum && selectingSlotTarget?.branch === 'sub'
                            ? 'bg-rose-950/80 border-rose-500 shadow-[0_0_12px_rgba(225,29,72,0.5)]'
                            : subDef
                            ? 'bg-slate-800/90 border-rose-600/60 hover:border-rose-400'
                            : 'bg-slate-950 border-dashed border-slate-700 hover:border-slate-500'
                        }`}
                      >
                        <div className="text-[10px] font-bold uppercase text-rose-300">Ô 2 • Nhánh Phụ</div>
                        {subDef ? (
                          <div className="mt-1">
                            <div className="text-xs font-extrabold text-white truncate">{subDef.name}</div>
                            <div className="text-[10px] text-slate-400">
                              {CLASS_PRESETS[subDef.classId!]?.name} • Cấp {skillSystem.skillLevels[fusion.sub!] || 1}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 mt-1">+ Chọn chiêu phụ</div>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Danh sách chọn nhanh chiêu đã học để lắp vào Ô 1 hoặc Ô 2 */}
            {selectingSlotTarget && (
              <div className="p-3 rounded-xl bg-slate-900 border border-sky-400/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-300">
                    Chọn kỹ năng đã học để đặt vào:{' '}
                    <span className="text-amber-300">
                      Nút Chiêu {selectingSlotTarget.slotNumber} —{' '}
                      {selectingSlotTarget.branch === 'main' ? 'Ô 1 (Nhánh Chính - Ra Trước)' : 'Ô 2 (Nhánh Phụ - Ra Sau)'}
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        onAssignSkillSlot(selectingSlotTarget.slotNumber, selectingSlotTarget.branch, null);
                        setSelectingSlotTarget(null);
                      }}
                      className="px-2.5 py-1 rounded bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-500/50 text-xs font-bold cursor-pointer"
                    >
                      Gỡ Chiêu Ô Này
                    </button>
                    <button
                      onClick={() => setSelectingSlotTarget(null)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                    >
                      Đóng
                    </button>
                  </div>
                </div>

                {allLearnedSkillNodes.length === 0 ? (
                  <div className="text-xs text-amber-300 py-2">
                    Bạn chưa học kỹ năng nào! Hãy bấm &quot;Học Chiêu&quot; ở danh sách phía trên trước.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {allLearnedSkillNodes.map((nId) => {
                      const sDef = getSkillDefinitionByNodeId(nId);
                      const cPreset = CLASS_PRESETS[sDef.classId!];
                      const sLvl = skillSystem.skillLevels[nId] || 1;
                      return (
                        <button
                          key={nId}
                          onClick={() => {
                            sounds.playClick();
                            onAssignSkillSlot(selectingSlotTarget.slotNumber, selectingSlotTarget.branch, nId);
                            setSelectingSlotTarget(null);
                          }}
                          className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-amber-400 text-left transition cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold" style={{ color: cPreset.color }}>
                              {cPreset.name} • Chiêu {sDef.slotIndex}
                            </span>
                            <span className="text-[10px] font-mono text-emerald-400">Cấp {sLvl}</span>
                          </div>
                          <div className="text-xs font-extrabold text-white mt-0.5 truncate">{sDef.name}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
