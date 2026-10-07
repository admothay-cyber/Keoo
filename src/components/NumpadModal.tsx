import React from 'react';
import { Delete, Check, X, KeyRound, Hash } from 'lucide-react';
import { sounds } from '../audio/soundEffects';

interface NumpadModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  isPasswordMode?: boolean;
  maxLength?: number;
  value: string;
  onChange: (val: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export const NumpadModal: React.FC<NumpadModalProps> = ({
  isOpen,
  title,
  subtitle,
  isPasswordMode = false,
  maxLength = 6,
  value,
  onChange,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  const handleDigitClick = (digit: string) => {
    sounds.playClick();
    if (value.length < maxLength) {
      onChange(value + digit);
    }
  };

  const handleDelete = () => {
    sounds.playClick();
    if (value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const handleConfirmAction = () => {
    sounds.playClick();
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 bg-slate-950/85 backdrop-blur-md select-none animate-fadeIn">
      <div className="relative w-full max-w-[260px] bg-slate-900 border-2 border-blue-500/80 chamfer-lg shadow-[0_0_30px_rgba(37,99,235,0.4)] p-3 flex flex-col items-center text-slate-100 max-h-[95vh]">
        {/* Close button */}
        <button
          onClick={() => {
            sounds.playClick();
            onClose();
          }}
          className="absolute top-2 right-2 w-6 h-6 chamfer-sm bg-slate-800 hover:bg-blue-900 text-blue-200 flex items-center justify-center transition border border-blue-700/50 cursor-pointer"
        >
          <X size={14} />
        </button>

        {/* Title */}
        <div className="flex items-center gap-1.5 mb-1 pr-5">
          {isPasswordMode ? (
            <KeyRound className="w-4 h-4 text-blue-400" />
          ) : (
            <Hash className="w-4 h-4 text-blue-400" />
          )}
          <h3 className="text-xs font-black tracking-wide text-white uppercase font-mono truncate">
            {title}
          </h3>
        </div>
        {subtitle && <p className="text-[10px] text-slate-400 mb-2 text-center">{subtitle}</p>}

        {/* Display Field */}
        <div className="w-full bg-slate-950 border-2 border-blue-600/70 chamfer-md p-2 mb-3 flex items-center justify-center shadow-inner min-h-[38px]">
          {value.length === 0 ? (
            <span className="text-xs font-bold text-slate-600 italic">
              {isPasswordMode ? 'Mật khẩu...' : 'Nhập 6 số...'}
            </span>
          ) : isPasswordMode ? (
            <div className="flex items-center gap-1.5">
              {Array.from({ length: value.length }).map((_, i) => (
                <span
                  key={i}
                  className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]"
                />
              ))}
            </div>
          ) : (
            <span className="text-lg font-black font-mono tracking-[0.2em] text-blue-300">
              {value}
            </span>
          )}
        </div>

        {/* Rectangular Numpad Grid (3x4) */}
        <div className="w-full grid grid-cols-3 gap-1.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => handleDigitClick(num)}
              className="py-1.5 chamfer-md bg-slate-800/90 hover:bg-blue-600 text-white font-black text-base font-mono border border-blue-800/60 hover:border-blue-300 active:scale-95 transition cursor-pointer flex items-center justify-center"
            >
              {num}
            </button>
          ))}

          {/* Row 4: Delete, 0, Confirm */}
          <button
            onClick={handleDelete}
            title="Xóa"
            className="py-1.5 chamfer-md bg-slate-800/80 hover:bg-rose-700 text-rose-300 hover:text-white font-bold text-xs border border-rose-900/50 hover:border-rose-400 active:scale-95 transition cursor-pointer flex items-center justify-center"
          >
            <Delete size={14} />
          </button>

          <button
            onClick={() => handleDigitClick('0')}
            className="py-1.5 chamfer-md bg-slate-800/90 hover:bg-blue-600 text-white font-black text-base font-mono border border-blue-800/60 hover:border-blue-300 active:scale-95 transition cursor-pointer flex items-center justify-center"
          >
            0
          </button>

          <button
            onClick={handleConfirmAction}
            disabled={!isPasswordMode && value.length === 0}
            title="Xác nhận"
            className="py-1.5 chamfer-md bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs border border-blue-300 shadow-[0_0_10px_rgba(37,99,235,0.6)] active:scale-95 transition cursor-pointer flex items-center justify-center"
          >
            <Check size={16} strokeWidth={3} />
          </button>
        </div>
      </div>
    </div>
  );
};
