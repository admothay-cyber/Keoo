import React, { useState } from 'react';
import { EquipmentItem, EquipmentSlot, EquippedItems } from '../types/game';
import { ALL_EQUIPMENT_ITEMS, EQUIPMENT_SLOT_NAMES } from '../data/equipmentData';
import { sounds } from '../audio/soundEffects';
import { X, Shield, Swords, Sparkles, Check, ArrowRightLeft } from 'lucide-react';

interface EquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipped: EquippedItems;
  onEquipItem: (slot: EquipmentSlot, item: EquipmentItem | null) => void;
}

const RARITY_COLORS: Record<string, { border: string; bg: string; text: string; glow: string }> = {
  common: {
    border: 'border-slate-600',
    bg: 'bg-slate-900/60',
    text: 'text-slate-300',
    glow: 'shadow-none',
  },
  rare: {
    border: 'border-sky-500/70',
    bg: 'bg-sky-950/40',
    text: 'text-sky-300',
    glow: 'shadow-[0_0_12px_rgba(56,189,248,0.25)]',
  },
  epic: {
    border: 'border-purple-500/70',
    bg: 'bg-purple-950/40',
    text: 'text-purple-300',
    glow: 'shadow-[0_0_14px_rgba(168,85,247,0.3)]',
  },
  legendary: {
    border: 'border-amber-400/80',
    bg: 'bg-amber-950/40',
    text: 'text-amber-300',
    glow: 'shadow-[0_0_16px_rgba(251,191,36,0.35)]',
  },
};

export const EquipmentModal: React.FC<EquipmentModalProps> = ({
  isOpen,
  onClose,
  equipped,
  onEquipItem,
}) => {
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlot | null>(null);

  if (!isOpen) return null;

  const SLOTS: { slot: EquipmentSlot; label: string; defaultIcon: string }[] = [
    { slot: 'helmet', label: 'Mũ', defaultIcon: '🪖' },
    { slot: 'armor', label: 'Giáp', defaultIcon: '🥋' },
    { slot: 'boots', label: 'Giày', defaultIcon: '👢' },
    { slot: 'mainWeapon', label: 'Vũ Khí Chính', defaultIcon: '⚔️' },
    { slot: 'subWeapon', label: 'Vũ Khí Phụ', defaultIcon: '🛡️' },
    { slot: 'necklace', label: 'Vòng Cổ', defaultIcon: '📿' },
    { slot: 'ring', label: 'Nhẫn', defaultIcon: '💍' },
  ];

  // Calculate total stats from equipped items
  const totalBonuses = Object.values(equipped).reduce(
    (acc, itm) => {
      if (!itm) return acc;
      acc.hp += itm.hpBonus || 0;
      acc.mp += itm.mpBonus || 0;
      acc.atk += itm.atkBonus || 0;
      acc.def += itm.defBonus || 0;
      acc.speed += itm.speedBonus || 0;
      acc.crit += itm.critBonus || 0;
      acc.critDmg += itm.critDmgBonus || 0;
      acc.luck += itm.luckBonus || 0;
      return acc;
    },
    { hp: 0, mp: 0, atk: 0, def: 0, speed: 0, crit: 0, critDmg: 0, luck: 0 }
  );

  const availableItemsForSlot = selectedSlot
    ? ALL_EQUIPMENT_ITEMS.filter((itm) => itm.slot === selectedSlot)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 bg-black/75 backdrop-blur-md select-none touch-auto animate-fadeIn overflow-hidden">
      {/* Khung Container Cố Định Kích Thước (Đồng bộ diện tích max-w-[550px]) */}
      <div className="relative w-full max-w-[550px] h-fit max-h-[85vh] bg-[#0b1120] border-2 border-rose-600/70 rounded-xl shadow-[0_0_35px_rgba(159,18,57,0.3)] flex flex-col overflow-hidden text-slate-100 shrink-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-rose-900/50 bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 chamfer-md bg-gradient-to-tr from-rose-950 via-red-900 to-rose-700 flex items-center justify-center text-rose-100 shadow-md border border-rose-500/50">
              <Shield size={20} className="stroke-[2.5] text-rose-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wide text-rose-200">
                KHO ĐỒ & TRANG BỊ NHÂN VẬT
              </h2>
              <p className="text-xs text-slate-400">
                Kho lưu trữ & 7 ô trang bị: Mũ, Giáp, Giày, Vũ khí chính, Vũ khí phụ, Vòng cổ, Nhẫn
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="w-9 h-9 chamfer-sm bg-slate-900 hover:bg-slate-800 text-rose-300 hover:text-white flex items-center justify-center transition border border-rose-900/50 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Layout */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col lg:flex-row gap-5 custom-scrollbar">
          {/* Left: 7 Equipment Slots Grid */}
          <div className="flex-1 flex flex-col gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SLOTS.map(({ slot, label, defaultIcon }) => {
                const item = equipped[slot];
                const isSelected = selectedSlot === slot;
                const rarityStyle = item ? RARITY_COLORS[item.rarity] : null;

                return (
                  <button
                    key={slot}
                    onClick={() => {
                      sounds.playClick();
                      setSelectedSlot(isSelected ? null : slot);
                    }}
                    className={`p-3 chamfer-md border-2 text-left transition flex flex-col justify-between min-h-[96px] cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? 'border-rose-500 bg-rose-950/50 shadow-[0_0_15px_rgba(225,29,72,0.4)]'
                        : item
                        ? `${rarityStyle?.border} ${rarityStyle?.bg} hover:border-rose-500/60`
                        : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300">
                        {label}
                      </span>
                      <span className="text-lg">{item ? item.icon : defaultIcon}</span>
                    </div>

                    {item ? (
                      <div className="min-w-0">
                        <div className={`text-xs font-bold truncate ${rarityStyle?.text}`}>
                          {item.name}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 space-x-1 font-mono">
                          {item.atkBonus && <span className="text-rose-300">+{item.atkBonus} Công</span>}
                          {item.defBonus && <span className="text-blue-300">+{item.defBonus} Giáp</span>}
                          {item.hpBonus && <span className="text-rose-300">+{item.hpBonus} HP</span>}
                          {item.speedBonus && <span className="text-emerald-300">+{item.speedBonus} Tốc</span>}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic">Trống (Nhấn để chọn)</div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Total Equipment Bonuses Banner */}
            <div className="p-3.5 chamfer-md bg-slate-900/80 border border-rose-900/40">
              <span className="text-xs font-bold text-rose-200 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                <Sparkles size={14} className="text-rose-400" />
                <span>Tổng Chỉ Số Tăng Thêm Từ Trang Bị</span>
              </span>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 text-center text-xs font-mono font-bold">
                <div className="p-1 chamfer-sm bg-slate-950/60 border border-slate-800">
                  <div className="text-[9px] text-rose-400 font-sans">HP</div>
                  <div className="text-rose-300">+{totalBonuses.hp}</div>
                </div>
                <div className="p-1 chamfer-sm bg-slate-950/60 border border-slate-800">
                  <div className="text-[9px] text-sky-400 font-sans">MP</div>
                  <div className="text-sky-300">+{totalBonuses.mp}</div>
                </div>
                <div className="p-1 chamfer-sm bg-slate-950/60 border border-slate-800">
                  <div className="text-[9px] text-rose-300 font-sans">CÔNG</div>
                  <div className="text-rose-300">+{totalBonuses.atk}</div>
                </div>
                <div className="p-1 chamfer-sm bg-slate-950/60 border border-slate-800">
                  <div className="text-[9px] text-blue-400 font-sans">GIÁP</div>
                  <div className="text-blue-300">+{totalBonuses.def}</div>
                </div>
                <div className="p-1 chamfer-sm bg-slate-950/60 border border-slate-800">
                  <div className="text-[9px] text-emerald-400 font-sans">TỐC</div>
                  <div className="text-emerald-300">+{totalBonuses.speed}</div>
                </div>
                <div className="p-1 chamfer-sm bg-slate-950/60 border border-slate-800">
                  <div className="text-[9px] text-purple-400 font-sans">CR (TL)</div>
                  <div className="text-purple-300">+{(totalBonuses.crit * 100).toFixed(0)}%</div>
                </div>
                <div className="p-1 chamfer-sm bg-slate-950/60 border border-slate-800">
                  <div className="text-[9px] text-rose-400 font-sans">CD (ST)</div>
                  <div className="text-rose-300">+{(totalBonuses.critDmg * 100).toFixed(0)}%</div>
                </div>
                <div className="p-1 chamfer-sm bg-slate-950/60 border border-slate-800">
                  <div className="text-[9px] text-emerald-300 font-sans">LUCK</div>
                  <div className="text-emerald-300">+{(totalBonuses.luck * 100).toFixed(0)}%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Item Selector Drawer for Selected Slot */}
          <div className="w-full lg:w-72 flex flex-col border-t lg:border-t-0 lg:border-l border-slate-800 pt-4 lg:pt-0 lg:pl-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                <ArrowRightLeft size={14} className="text-rose-400" />
                <span>
                  {selectedSlot ? `Trang Bị: ${EQUIPMENT_SLOT_NAMES[selectedSlot]}` : 'Kho Trang Bị'}
                </span>
              </h3>
              {selectedSlot && equipped[selectedSlot] && (
                <button
                  onClick={() => {
                    sounds.playClick();
                    onEquipItem(selectedSlot, null);
                  }}
                  className="text-[10px] font-bold text-rose-400 hover:text-rose-300 underline cursor-pointer"
                >
                  Gỡ Bỏ
                </button>
              )}
            </div>

            {selectedSlot ? (
              <div className="space-y-2 overflow-y-auto max-h-[300px] lg:max-h-[360px] pr-1 custom-scrollbar">
                {availableItemsForSlot.map((item) => {
                  const isCurrent = equipped[selectedSlot]?.id === item.id;
                  const rStyle = RARITY_COLORS[item.rarity];

                  return (
                    <div
                      key={item.id}
                      className={`p-2.5 chamfer-md border text-left transition flex flex-col gap-1.5 ${
                        isCurrent
                          ? 'border-rose-500 bg-rose-950/40'
                          : `${rStyle.border} ${rStyle.bg} hover:border-slate-600`
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{item.icon}</span>
                          <span className={`text-xs font-bold ${rStyle.text}`}>
                            {item.name}
                          </span>
                        </div>
                        {isCurrent ? (
                          <span className="flex items-center gap-1 text-[10px] text-rose-300 font-bold bg-rose-950/80 px-2 py-0.5 chamfer-sm border border-rose-500/50">
                            <Check size={12} /> Đang dùng
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              sounds.playPurchase();
                              onEquipItem(selectedSlot, item);
                            }}
                            className="px-2 py-0.5 chamfer-sm bg-gradient-to-r from-red-950 to-rose-900 hover:from-rose-900 hover:to-red-800 text-rose-100 text-[10px] font-bold border border-rose-500/60 hover:shadow-[0_0_12px_rgba(225,29,72,0.6)] transition cursor-pointer"
                          >
                            Trang Bị
                          </button>
                        )}
                      </div>

                      <p className="text-[10px] text-slate-300 leading-tight">
                        {item.description}
                      </p>

                      <div className="flex flex-wrap gap-1.5 text-[9px] font-mono mt-0.5">
                        {item.atkBonus && (
                          <span className="text-rose-300 bg-slate-900 px-1 chamfer-sm border border-slate-800">
                            +{item.atkBonus} Tấn công
                          </span>
                        )}
                        {item.defBonus && (
                          <span className="text-blue-300 bg-slate-900 px-1 chamfer-sm border border-slate-800">
                            +{item.defBonus} Giáp
                          </span>
                        )}
                        {item.hpBonus && (
                          <span className="text-rose-300 bg-slate-900 px-1 chamfer-sm border border-slate-800">
                            +{item.hpBonus} HP
                          </span>
                        )}
                        {item.speedBonus && (
                          <span className="text-emerald-300 bg-slate-900 px-1 chamfer-sm border border-slate-800">
                            +{item.speedBonus} Tốc độ
                          </span>
                        )}
                        {item.critBonus && (
                          <span className="text-purple-300 bg-slate-900 px-1 chamfer-sm border border-slate-800">
                            +{(item.critBonus * 100).toFixed(0)}% CR (Bạo)
                          </span>
                        )}
                        {item.critDmgBonus && (
                          <span className="text-rose-300 bg-slate-900 px-1 chamfer-sm border border-slate-800">
                            +{(item.critDmgBonus * 100).toFixed(0)}% CD (ST Bạo)
                          </span>
                        )}
                        {item.luckBonus && (
                          <span className="text-emerald-300 bg-slate-900 px-1 chamfer-sm border border-slate-800">
                            +{(item.luckBonus * 100).toFixed(0)}% Luck (Rơi đồ)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 chamfer-md flex flex-col items-center justify-center h-48">
                <span>Chọn một ô trang bị ở bên trái để xem và thay đổi vật phẩm</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
          <span>* Trang bị cộng thẳng vào chỉ số thực chiến</span>
          <button
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="px-4 py-1.5 chamfer-md bg-slate-900 hover:bg-slate-800 text-rose-200 border border-rose-900/60 hover:border-rose-500 font-semibold transition cursor-pointer"
          >
            Xong
          </button>
        </div>
      </div>
    </div>
  );
};
