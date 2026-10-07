import React from 'react';
import { ClassType } from '../types/game';
import { CLASS_PRESETS } from '../data/classPresets';
import { sounds } from '../audio/soundEffects';
import { X, Check, Swords, Shield, Sparkles, Target, Zap } from 'lucide-react';

interface ClassSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeClass: ClassType;
  onSelectClass: (c: ClassType) => void;
}

export const ClassSelectModal: React.FC<ClassSelectModalProps> = ({
  isOpen,
  onClose,
  activeClass,
  onSelectClass,
}) => {
  if (!isOpen) return null;

  const CLASSES: {
    id: ClassType;
    vietnameseName: string;
    role: string;
    icon: React.ReactNode;
    color: string;
    chargeFeature: string;
  }[] = [
    {
      id: 'Fighter',
      vietnameseName: 'Đấu Sĩ',
      role: 'Cận chiến uy lực & Chém diện rộng',
      icon: <Swords size={20} className="text-red-400" />,
      color: '#ef4444',
      chargeFeature: 'Gồng đòn đánh thường: Khi full lực tăng 40% Xuyên Giáp (bỏ qua phòng thủ kẻ địch).',
    },
    {
      id: 'Tank',
      vietnameseName: 'Đỡ Đòn',
      role: 'Phòng thủ kiên cố & Đập đất uy lực',
      icon: <Shield size={20} className="text-blue-400" />,
      color: '#3b82f6',
      chargeFeature: 'Gồng đòn đánh thường: Lao tới húc văng kẻ địch gây 50 sát thương + 10% máu tối đa bản thân.',
    },
    {
      id: 'Mage',
      vietnameseName: 'Pháp Sư',
      role: 'Sát thương phép nguyên tố tầm xa',
      icon: <Sparkles size={20} className="text-amber-400" />,
      color: '#eab308',
      chargeFeature: 'Gồng đòn đánh thường: Bắn ra quả cầu ma pháp nổ lan hủy diệt (không xuyên thấu).',
    },
    {
      id: 'Assassin',
      vietnameseName: 'Sát Thủ',
      role: 'Nhanh nhẹn bóng tối & Tuyệt kỹ chí mạng',
      icon: <Zap size={20} className="text-purple-400" />,
      color: '#a855f7',
      chargeFeature: 'Gồng đòn đánh thường: Khi full lực lướt đi để lại tàn ảnh, sóng xung kích mũi nhọn, +100% chí mạng & +50% ST chí mạng.',
    },
    {
      id: 'Marksman',
      vietnameseName: 'Xạ Thủ',
      role: 'Bắn tỉa tầm xa & Đẩy lùi kẻ thù',
      icon: <Target size={20} className="text-emerald-400" />,
      color: '#10b981',
      chargeFeature: 'Gồng đòn đánh thường: Khi full lực bắn mũi tên cực mạnh đẩy lùi kẻ địch văng xa 70px.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md select-none touch-auto animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-950/95 border-2 border-rose-600/70 chamfer-lg shadow-[0_0_35px_rgba(159,18,57,0.3)] flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-rose-900/50 bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 chamfer-md bg-gradient-to-tr from-rose-950 via-red-900 to-rose-700 flex items-center justify-center text-rose-100 shadow-md border border-rose-500/50">
              <Swords size={20} className="stroke-[2.5] text-rose-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wide text-rose-200">
                CHỌN HỆ PHÁI CHIẾN ĐẤU
              </h2>
              <p className="text-xs text-slate-400">
                5 Hệ Phái: Đấu sĩ, Đỡ đòn, Pháp sư, Sát thủ, Xạ thủ
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

        {/* Classes List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 custom-scrollbar">
          {CLASSES.map((cls) => {
            const preset = CLASS_PRESETS[cls.id];
            const isSelected = activeClass === cls.id;

            return (
              <div
                key={cls.id}
                onClick={() => {
                  sounds.playClick();
                  onSelectClass(cls.id);
                }}
                className={`p-3.5 sm:p-4 chamfer-md border-2 transition cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  isSelected
                    ? 'border-rose-500 bg-rose-950/40 shadow-[0_0_15px_rgba(225,29,72,0.4)]'
                    : 'border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 hover:border-rose-900/60'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className="w-11 h-11 chamfer-sm flex items-center justify-center flex-shrink-0 shadow-md"
                    style={{ backgroundColor: `${cls.color}25`, border: `1.5px solid ${cls.color}` }}
                  >
                    {cls.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-black text-white">
                        {cls.vietnameseName} ({preset.name})
                      </h3>
                      {isSelected && (
                        <span className="flex items-center gap-1 text-[10px] text-rose-300 bg-rose-950/80 px-2 py-0.5 chamfer-sm font-bold border border-rose-500/50">
                          <Check size={11} /> Đang chọn
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-300 font-medium mt-0.5">
                      {cls.role} • Vũ khí: <span className="text-rose-300">{preset.weaponType}</span>
                    </p>
                    <div className="mt-1.5 p-2 chamfer-sm bg-slate-950/70 border border-slate-800/80 text-[10px] text-slate-300 flex items-center gap-1.5">
                      <span className="text-rose-400 font-bold flex-shrink-0">⚡ Đặc trưng gồng:</span>
                      <span>{cls.chargeFeature}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center flex-shrink-0">
                  <div className="text-right text-xs font-mono hidden sm:block">
                    <div className="text-rose-400 font-bold">{preset.maxHp} HP</div>
                    <div className="text-rose-300 font-bold">{preset.baseDamage} ATK</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      sounds.playClick();
                      onSelectClass(cls.id);
                      onClose();
                    }}
                    className={`px-3 py-1.5 chamfer-sm text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-r from-red-950 via-rose-900 to-red-950 text-rose-100 border border-rose-500/80 shadow-[0_0_12px_rgba(225,29,72,0.6)]'
                        : 'bg-slate-900 hover:bg-slate-800 text-rose-200 border border-rose-900/50'
                    }`}
                  >
                    {isSelected ? 'Đang Sử Dụng' : 'Chọn Hệ'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
          <span>* Chuyển đổi hệ phái giữ nguyên cấp độ và trang bị hiện tại</span>
          <button
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="px-4 py-1.5 chamfer-md bg-slate-900 hover:bg-slate-800 text-rose-200 border border-rose-900/60 hover:border-rose-500 font-semibold transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
