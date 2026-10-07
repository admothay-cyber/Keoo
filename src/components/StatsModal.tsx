import React, { useState, useEffect, useRef } from 'react';
import { PlayerAttributes, PlayerStats } from '../types/game';
import { CLASS_PRESETS } from '../data/classPresets';
import { sounds } from '../audio/soundEffects';
import { formatCompactNumber } from './StatusHud';
import {
  X,
  Shield,
  Heart,
  Zap,
  Swords,
  Target,
  Sparkles,
  Plus,
  Flame,
  Clover,
  Crosshair,
  Gauge,
  Settings,
  Volume2,
  VolumeX,
  LogOut,
  Sliders,
  Activity,
  Award,
} from 'lucide-react';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: PlayerStats;
  attributes: PlayerAttributes;
  onUpgradeAttribute: (attr: keyof PlayerAttributes, mode?: 'one' | 'all') => void;
  statExp: number;
  onReincarnate?: () => void;
  onQuitGame?: () => void;
}

const COST_PER_POINT = 1;

type ModalTab = 'status' | 'reincarnate' | 'settings';

export const StatsModal: React.FC<StatsModalProps> = ({
  isOpen,
  onClose,
  stats,
  attributes,
  onUpgradeAttribute,
  statExp,
  onReincarnate,
  onQuitGame,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('status');
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(sounds.enabled);
  const [volume, setVolumeState] = useState<number>(Math.round(sounds.volume * 100));

  const holdTimeoutRef = useRef<number | null>(null);
  const holdIntervalRef = useRef<number | null>(null);

  const stopHoldUpgrade = () => {
    if (holdTimeoutRef.current !== null) {
      window.clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (holdIntervalRef.current !== null) {
      window.clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopHoldUpgrade();
  }, []);

  if (!isOpen) return null;

  const preset = CLASS_PRESETS[stats.classType] || CLASS_PRESETS['Fighter'];
  const canUpgrade = statExp >= COST_PER_POINT;

  const startHoldUpgrade = (attrKey: keyof PlayerAttributes) => {
    stopHoldUpgrade();
    if (!canUpgrade) return;
    sounds.playPurchase();
    onUpgradeAttribute(attrKey, 'one');

    // Giữ nút để tự động cộng liên tục
    holdTimeoutRef.current = window.setTimeout(() => {
      holdIntervalRef.current = window.setInterval(() => {
        onUpgradeAttribute(attrKey, 'one');
      }, 55);
    }, 280);
  };

  const handleToggleSound = () => {
    sounds.playClick();
    const nextState = !isSoundEnabled;
    setIsSoundEnabled(nextState);
    sounds.enabled = nextState;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setVolumeState(val);
    sounds.setVolume(val / 100);
  };

  // Equipment bonuses
  const eq = stats.equipped;
  const eqCrit = (eq?.mainWeapon?.critBonus || 0) + (eq?.ring?.critBonus || 0) + (eq?.necklace?.critBonus || 0) + (eq?.subWeapon?.critBonus || 0);
  const eqCritDmg = (eq?.mainWeapon?.critDmgBonus || 0) + (eq?.ring?.critDmgBonus || 0) + (eq?.subWeapon?.critDmgBonus || 0);
  const eqLuck = (eq?.necklace?.luckBonus || 0) + (eq?.ring?.luckBonus || 0);

  // CR: Max 100%
  const currentCR = Math.min(1.0, preset.critChance + (stats.critChanceBonus || 0) + attributes.dexPoints * 0.01 + (attributes.crPoints || 0) * 0.01 + eqCrit);
  const isCrMax = currentCR >= 1.0;

  // CD: Unlimited
  const currentCD = preset.critMultiplier + (stats.critMultiplierBonus || 0) + (attributes.cdPoints || 0) * 0.05 + eqCritDmg;

  // Luck: Max 100%
  const currentLuck = Math.min(1.0, 0.05 + (attributes.luckPoints || 0) * 0.01 + eqLuck);
  const isLuckMax = currentLuck >= 1.0;

  // ASPD
  const aspdBonusPercent = (attributes.atkSpeedPoints || 0) * 5;
  const currentAspd = preset.attackSpeed * (1 + (attributes.atkSpeedPoints || 0) * 0.05);

  const statRows: {
    key: keyof PlayerAttributes;
    label: string;
    icon: React.ReactNode;
    color: string;
    bonusText: string;
    isMax?: boolean;
  }[] = [
    {
      key: 'hpPoints',
      label: 'HP',
      icon: <Heart size={14} className="text-rose-400" />,
      color: 'border-rose-500/40 text-rose-400 bg-rose-950/30',
      bonusText: `+${formatCompactNumber(attributes.hpPoints * 15)} (+15/đ)`,
    },
    {
      key: 'mpPoints',
      label: 'MP',
      icon: <Zap size={14} className="text-sky-400" />,
      color: 'border-sky-500/40 text-sky-400 bg-sky-950/30',
      bonusText: `+${formatCompactNumber(attributes.mpPoints * 10)} (+10/đ)`,
    },
    {
      key: 'strPoints',
      label: 'STR',
      icon: <Swords size={14} className="text-amber-400" />,
      color: 'border-amber-500/40 text-amber-400 bg-amber-950/30',
      bonusText: `+${formatCompactNumber(attributes.strPoints * 3)} (+3/đ)`,
    },
    {
      key: 'dexPoints',
      label: 'DEX',
      icon: <Target size={14} className="text-emerald-400" />,
      color: 'border-emerald-500/40 text-emerald-400 bg-emerald-950/30',
      bonusText: `+${formatCompactNumber(attributes.dexPoints * 4)} Tốc, +${formatCompactNumber(attributes.dexPoints * 1)}% Bạo`,
    },
    {
      key: 'intPoints',
      label: 'INT',
      icon: <Sparkles size={14} className="text-purple-400" />,
      color: 'border-purple-500/40 text-purple-400 bg-purple-950/30',
      bonusText: `+${formatCompactNumber(attributes.intPoints * 5)} Kĩ năng, +${formatCompactNumber(attributes.intPoints * 2)} Hồi/s`,
    },
    {
      key: 'defPoints',
      label: 'DEF',
      icon: <Shield size={14} className="text-blue-400" />,
      color: 'border-blue-500/40 text-blue-400 bg-blue-950/30',
      bonusText: `+${formatCompactNumber(attributes.defPoints * 2)} Giáp (-${formatCompactNumber(attributes.defPoints * 2)}% ST)`,
    },
    {
      key: 'crPoints',
      label: 'CR',
      icon: <Crosshair size={14} className="text-fuchsia-400" />,
      color: 'border-fuchsia-500/40 text-fuchsia-400 bg-fuchsia-950/30',
      bonusText: `+${formatCompactNumber(attributes.crPoints || 0)}% (Tổng: ${(currentCR * 100).toFixed(0)}%)`,
      isMax: isCrMax,
    },
    {
      key: 'cdPoints',
      label: 'CD',
      icon: <Flame size={14} className="text-orange-400" />,
      color: 'border-orange-500/40 text-orange-400 bg-orange-950/30',
      bonusText: `+${formatCompactNumber((attributes.cdPoints || 0) * 5)}% (Tổng: ${(currentCD * 100).toFixed(0)}%)`,
      isMax: false,
    },
    {
      key: 'luckPoints',
      label: 'LUCK',
      icon: <Clover size={14} className="text-lime-400" />,
      color: 'border-lime-500/40 text-lime-400 bg-lime-950/30',
      bonusText: `+${formatCompactNumber(attributes.luckPoints || 0)}% (Tổng: ${(currentLuck * 100).toFixed(0)}%)`,
      isMax: isLuckMax,
    },
    {
      key: 'atkSpeedPoints',
      label: 'ASPD',
      icon: <Gauge size={14} className="text-yellow-400" />,
      color: 'border-yellow-500/40 text-yellow-400 bg-yellow-950/30',
      bonusText: `+${aspdBonusPercent}% (${currentAspd.toFixed(2)}/s)`,
    },
    {
      key: 'manaControlPoints',
      label: 'MC',
      icon: <Sparkles size={14} className="text-cyan-400" />,
      color: 'border-cyan-500/40 text-cyan-400 bg-cyan-950/30',
      bonusText: `${attributes.manaControlPoints || 0}/100`,
      isMax: (attributes.manaControlPoints || 0) >= 100,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 bg-black/80 backdrop-blur-sm select-none touch-auto animate-fadeIn overflow-hidden">
      {/* Khung Modal Chuẩn */}
      <div className="relative w-full max-w-[560px] h-[340px] sm:h-[350px] bg-[#0b1120] border border-slate-700/80 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden text-slate-100 shrink-0">
        
        {/* Header với 3 Tab: Trạng Thái • Chuyển Sinh • Cài Đặt */}
        <div className="h-[44px] px-3 flex items-center justify-between bg-[#070b14] border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Tab 1: Trạng Thái */}
            <button
              onClick={() => {
                sounds.playClick();
                setActiveTab('status');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase font-mono transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'status'
                  ? 'bg-rose-950 text-rose-200 border border-rose-500/80 shadow-md shadow-rose-950/50'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Activity size={14} className={activeTab === 'status' ? 'text-rose-400' : 'text-slate-400'} />
              <span>Trạng Thái</span>
            </button>

            {/* Tab 2: Chuyển Sinh */}
            <button
              onClick={() => {
                sounds.playClick();
                setActiveTab('reincarnate');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase font-mono transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'reincarnate'
                  ? 'bg-cyan-950 text-cyan-200 border border-cyan-500/80 shadow-md shadow-cyan-950/50'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Award size={14} className={activeTab === 'reincarnate' ? 'text-cyan-400' : 'text-slate-400'} />
              <span>Chuyển Sinh</span>
            </button>

            {/* Tab 3: Cài Đặt */}
            <button
              onClick={() => {
                sounds.playClick();
                setActiveTab('settings');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase font-mono transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'settings'
                  ? 'bg-blue-950 text-blue-200 border border-blue-500/80 shadow-md shadow-blue-950/50'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Settings size={14} className={activeTab === 'settings' ? 'text-blue-400' : 'text-slate-400'} />
              <span>Cài Đặt</span>
            </button>
          </div>

          {/* Nút X đóng gọn gàng (Không có chữ đóng) */}
          <button
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            aria-label="Đóng"
            className="w-7 h-7 rounded-md bg-slate-800 hover:bg-rose-900 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center transition cursor-pointer shrink-0"
          >
            <X size={15} />
          </button>
        </div>

        {/* ================= TAB 1: BẢNG TRẠNG THÁI (ĐIỂM THUỘC TÍNH -> CHỈ SỐ CƠ BẢN -> CỘNG ĐIỂM) ================= */}
        {activeTab === 'status' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            {/* 1. Điểm thuộc tính lên đầu */}
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-sky-950/70 via-indigo-950/50 to-purple-950/70 border border-sky-500/50 shadow-inner flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-xs font-black uppercase tracking-wider text-cyan-300">
                  ĐIỂM THUỘC TÍNH
                </span>
              </div>
              <div className="text-right font-mono font-black text-cyan-200 text-sm sm:text-base">
                {formatCompactNumber(statExp)} <span className="text-[10px] text-cyan-400 font-bold">Điểm</span>
              </div>
            </div>

            {/* 2. Chỉ số cơ bản */}
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Chỉ Số Cơ Bản
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                <div className="p-1.5 rounded-lg bg-slate-900/70 border border-slate-800 flex flex-col">
                  <span className="text-[8.5px] text-slate-400 uppercase font-semibold">HP</span>
                  <span className="text-xs sm:text-sm font-black font-mono text-rose-400 mt-0.5">
                    {formatCompactNumber(stats.currentHp)}
                  </span>
                </div>
                <div className="p-1.5 rounded-lg bg-slate-900/70 border border-slate-800 flex flex-col">
                  <span className="text-[8.5px] text-slate-400 uppercase font-semibold">MP</span>
                  <span className="text-xs sm:text-sm font-black font-mono text-sky-400 mt-0.5">
                    {formatCompactNumber(stats.currentMana)}
                  </span>
                </div>
                <div className="p-1.5 rounded-lg bg-slate-900/70 border border-slate-800 flex flex-col">
                  <span className="text-[8.5px] text-slate-400 uppercase font-semibold">ATK</span>
                  <span className="text-xs sm:text-sm font-black font-mono text-amber-300 mt-0.5">
                    {formatCompactNumber(stats.baseDamage + stats.bonusDamage)}
                  </span>
                </div>
                <div className="p-1.5 rounded-lg bg-slate-900/70 border border-slate-800 flex flex-col">
                  <span className="text-[8.5px] text-slate-400 uppercase font-semibold">DEF</span>
                  <span className="text-xs sm:text-sm font-black font-mono text-blue-400 mt-0.5">
                    {formatCompactNumber((stats.defense || 0) + attributes.defPoints * 2)}
                  </span>
                </div>
                <div className="p-1.5 rounded-lg bg-slate-900/70 border border-slate-800 flex flex-col">
                  <span className="text-[8.5px] text-slate-400 uppercase font-semibold">Tốc Chạy</span>
                  <span className="text-xs sm:text-sm font-black font-mono text-emerald-400 mt-0.5">
                    {formatCompactNumber(stats.moveSpeed)}
                  </span>
                </div>
                <div className="p-1.5 rounded-lg bg-slate-900/70 border border-slate-800 flex flex-col">
                  <span className="text-[8.5px] text-slate-400 uppercase font-semibold">ASPD</span>
                  <span className="text-xs sm:text-sm font-black font-mono text-yellow-400 mt-0.5">
                    {currentAspd.toFixed(2)}/s
                  </span>
                </div>
                <div className="p-1.5 rounded-lg bg-slate-900/70 border border-slate-800 flex flex-col">
                  <span className="text-[8.5px] text-slate-400 uppercase font-semibold">CR</span>
                  <span className="text-xs sm:text-sm font-black font-mono text-fuchsia-400 mt-0.5">
                    {(currentCR * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="p-1.5 rounded-lg bg-slate-900/70 border border-slate-800 flex flex-col">
                  <span className="text-[8.5px] text-slate-400 uppercase font-semibold">CD</span>
                  <span className="text-xs sm:text-sm font-black font-mono text-orange-400 mt-0.5">
                    {(currentCD * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="p-1.5 rounded-lg bg-slate-900/70 border border-slate-800 flex flex-col">
                  <span className="text-[8.5px] text-slate-400 uppercase font-semibold">LUCK</span>
                  <span className="text-xs sm:text-sm font-black font-mono text-lime-400 mt-0.5">
                    {(currentLuck * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="p-1.5 rounded-lg bg-slate-900/70 border border-slate-800 flex flex-col">
                  <span className="text-[8.5px] text-slate-400 uppercase font-semibold">Quái Diệt</span>
                  <span className="text-xs sm:text-sm font-black font-mono text-slate-200 mt-0.5">
                    {formatCompactNumber(stats.killCount)}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Cộng điểm */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Cộng Điểm
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {statRows.map((row) => {
                  return (
                    <div
                      key={row.key}
                      className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${row.color}`}>
                          {row.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black font-mono text-white leading-none">
                            {row.label}
                          </div>
                          <div className="text-[9.5px] text-slate-400 font-mono mt-0.5 truncate">
                            {row.bonusText}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {row.isMax ? (
                          <div className="px-2 py-1 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-emerald-400 font-bold text-[10px] select-none">
                            MAX
                          </div>
                        ) : (
                          <>
                            <button
                              onMouseDown={(e) => {
                                e.preventDefault();
                                startHoldUpgrade(row.key);
                              }}
                              onMouseUp={stopHoldUpgrade}
                              onMouseLeave={stopHoldUpgrade}
                              onTouchStart={(e) => {
                                e.preventDefault();
                                startHoldUpgrade(row.key);
                              }}
                              onTouchEnd={stopHoldUpgrade}
                              onTouchCancel={stopHoldUpgrade}
                              disabled={!canUpgrade}
                              title={`Bấm hoặc giữ để cộng nhanh +1 ${row.label}`}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm transition select-none ${
                                canUpgrade
                                  ? 'bg-gradient-to-r from-red-950 via-rose-900 to-red-950 hover:from-rose-900 hover:to-red-800 text-rose-100 border border-rose-500/80 active:scale-90 cursor-pointer'
                                  : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed opacity-50'
                              }`}
                            >
                              <Plus size={13} />
                            </button>

                            <button
                              onClick={() => {
                                if (canUpgrade) {
                                  stopHoldUpgrade();
                                  sounds.playPurchase();
                                  onUpgradeAttribute(row.key, 'all');
                                }
                              }}
                              disabled={!canUpgrade}
                              title={`Cộng toàn bộ điểm vào ${row.label}`}
                              className={`px-2 h-7 rounded-lg flex items-center justify-center font-black text-[10px] tracking-tight transition select-none ${
                                canUpgrade
                                  ? 'bg-gradient-to-r from-red-900 via-rose-800 to-red-900 hover:from-rose-800 hover:to-red-700 text-rose-100 border border-rose-400/80 active:scale-90 cursor-pointer'
                                  : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed opacity-50'
                              }`}
                            >
                              ALL
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: CHUYỂN SINH (REINCARNATION) ================= */}
        {activeTab === 'reincarnate' && (
          <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-between custom-scrollbar">
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/70 via-blue-950/50 to-indigo-950/70 border border-cyan-500/50 flex items-center justify-between">
                <div>
                  <div className="text-xs font-black uppercase text-cyan-300">
                    TIẾN HÓA CHUYỂN SINH
                  </div>
                  <div className="text-[11px] text-slate-300 mt-1">
                    Đã chuyển sinh: <span className="font-bold text-cyan-200 font-mono">x{stats.reincarnations || 0} lần</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-400">Yêu cầu cấp độ</div>
                  <div className="text-sm font-mono font-black text-yellow-300">
                    Cấp 999
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5 text-xs text-slate-300">
                <div className="font-bold text-cyan-300 uppercase text-[11px]">Đặc quyền khi chuyển sinh:</div>
                <div>• Nhận thêm lượng lớn Điểm Thuộc Tính vĩnh viễn</div>
                <div>• Đổi màu vòng hào quang XP sang Xanh Lam Ngọc / Hoàng Kim</div>
                <div>• Cường hóa toàn diện sức mạnh kĩ năng và sát thương cơ bản</div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => {
                  if (stats.level >= 999 && onReincarnate) {
                    sounds.playPurchase();
                    onReincarnate();
                  }
                }}
                disabled={stats.level < 999}
                className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 ${
                  stats.level >= 999
                    ? 'bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white border border-cyan-400 shadow-lg shadow-cyan-500/40 cursor-pointer animate-pulse'
                    : 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed opacity-60'
                }`}
              >
                <Sparkles size={15} />
                <span>{stats.level >= 999 ? 'TIẾN HÀNH CHUYỂN SINH NGAY' : `CẦN ĐẠT CẤP 999 (HIỆN TẠI: LV ${stats.level})`}</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= TAB 3: CÀI ĐẶT (SETTINGS) ================= */}
        {activeTab === 'settings' && (
          <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-between custom-scrollbar">
            <div className="space-y-3">
              {/* Sound Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                  {isSoundEnabled ? <Volume2 size={16} className="text-blue-400" /> : <VolumeX size={16} className="text-rose-400" />}
                  <span>Âm thanh trò chơi</span>
                </div>
                <button
                  onClick={handleToggleSound}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                    isSoundEnabled
                      ? 'bg-blue-600 text-white border border-blue-300'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {isSoundEnabled ? 'BẬT' : 'TẮT'}
                </button>
              </div>

              {/* Volume Slider */}
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                  <span className="flex items-center gap-1.5">
                    <Sliders size={15} className="text-blue-400" /> Âm lượng:
                  </span>
                  <span className="font-mono text-white text-xs">{volume}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            </div>

            {/* Quit Game Button */}
            <div className="pt-2">
              <button
                onClick={() => {
                  sounds.playClick();
                  onQuitGame?.();
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-700 via-red-600 to-rose-700 hover:from-red-600 hover:to-rose-600 text-white font-black text-xs uppercase tracking-wider border border-red-400 shadow-md shadow-red-950/60 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut size={15} />
                <span>THOÁT GAME VỀ MÀN HÌNH CHÍNH</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
