import React, { useState } from 'react';
import { User, Globe, Check, X } from 'lucide-react';
import { sounds } from '../audio/soundEffects';

interface LoginScreenProps {
  onLoginSuccess: (guestId: string, nickname: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [isNamingModalOpen, setIsNamingModalOpen] = useState(false);
  const [loginType, setLoginType] = useState<'guest' | 'google'>('guest');
  const [nickname, setNickname] = useState('Dũng Sĩ');

  const handleSelectLoginMethod = (type: 'guest' | 'google') => {
    sounds.playClick();
    setLoginType(type);
    setIsNamingModalOpen(true);
  };

  const handleConfirmName = () => {
    sounds.playClick();
    const randomId = 'hero_' + Math.random().toString(36).substring(2, 9);
    const cleanName = nickname.trim() || 'Dũng Sĩ';
    onLoginSuccess(randomId, cleanName);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 select-none overflow-hidden"
      style={{
        backgroundColor: '#0b1120',
        backgroundImage:
          'repeating-linear-gradient(28.7deg, rgba(56, 189, 248, 0.14) 0px, rgba(56, 189, 248, 0.14) 1px, transparent 1px, transparent 41px), repeating-linear-gradient(-28.7deg, rgba(56, 189, 248, 0.14) 0px, rgba(56, 189, 248, 0.14) 1px, transparent 1px, transparent 41px)',
      }}
    >
      {/* Ambient Background Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full bg-sky-500/15 blur-3xl" />
      </div>

      {/* Main Login Card - Compact for Mobile Landscape */}
      <div className="relative w-full max-w-xs sm:max-w-sm bg-slate-900/95 border-2 border-blue-500/80 chamfer-lg shadow-[0_0_40px_rgba(37,99,235,0.35)] p-4 sm:p-5 flex flex-col items-center text-center max-h-[92vh]">
        {/* Game Logo tràn viền nổi bật */}
        <div className="relative -mt-10 sm:-mt-14 -mb-2 sm:-mb-3 w-[122%] max-w-[340px] sm:max-w-[420px] flex items-center justify-center pointer-events-none select-none">
          <img
            src="/assets/game_logo.png"
            onError={(e) => {
              const target = e.currentTarget;
              if (target.src !== 'https://i.ibb.co/Q3KNqyQw/d405ba5f-793f-4fad-9b09-e9c38ec77d9c-Photoroom-1.png') {
                target.src = 'https://i.ibb.co/Q3KNqyQw/d405ba5f-793f-4fad-9b09-e9c38ec77d9c-Photoroom-1.png';
              }
            }}
            alt="Game Logo"
            className="w-full h-auto object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.85)] filter"
          />
        </div>

        {/* 2 Main Action Buttons: Khách & Đăng nhập Google */}
        <div className="w-full flex flex-col gap-2.5 my-3 sm:my-4">
          {/* 1. Nút Khách */}
          <button
            onClick={() => handleSelectLoginMethod('guest')}
            className="w-full py-2.5 sm:py-3 px-4 chamfer-lg bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-500 text-white font-black text-xs sm:text-sm tracking-wide border-2 border-blue-400 shadow-md shadow-blue-950/60 active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <User className="w-4 h-4 stroke-[2.5]" />
            <span>Khách</span>
          </button>

          {/* 2. Nút Đăng nhập Google */}
          <button
            onClick={() => handleSelectLoginMethod('google')}
            className="w-full py-2.5 sm:py-3 px-4 chamfer-lg bg-slate-800 hover:bg-slate-700 text-white font-black text-xs sm:text-sm tracking-wide border-2 border-slate-600 hover:border-blue-400 active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Globe className="w-4 h-4 text-red-400 stroke-[2.5]" />
            <span>Đăng nhập Google</span>
          </button>
        </div>
      </div>

      {/* Layer Đặt Tên Nhân Vật (Naming Popup Modal) */}
      {isNamingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 select-none animate-fadeIn">
          <div className="relative w-full max-w-xs bg-slate-900 border-2 border-blue-500/80 chamfer-lg shadow-[0_0_40px_rgba(37,99,235,0.4)] p-4 flex flex-col items-center text-center">
            <button
              onClick={() => {
                sounds.playClick();
                setIsNamingModalOpen(false);
              }}
              className="absolute top-2.5 right-2.5 w-7 h-7 chamfer-sm bg-slate-800 hover:bg-blue-900 text-blue-200 flex items-center justify-center transition border border-blue-700/50 cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-1.5 mb-1">
              <User className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-black tracking-wide text-white uppercase font-mono">
                NHẬP TÊN NHÂN VẬT
              </h3>
            </div>

            <div className="w-full text-left my-3">
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={18}
                placeholder="Nhập tên nhân vật..."
                autoFocus
                className="w-full px-3 py-2 chamfer-md bg-slate-950 border-2 border-blue-600/70 focus:border-blue-400 text-sm font-bold text-white text-center outline-none transition"
              />
            </div>

            <button
              onClick={handleConfirmName}
              className="w-full py-2.5 chamfer-lg bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-500 text-white font-black text-xs sm:text-sm tracking-wide border-2 border-blue-300 shadow-[0_0_15px_rgba(37,99,235,0.6)] active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check size={16} strokeWidth={3} />
              <span>XÁC NHẬN</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
