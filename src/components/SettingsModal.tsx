import React, { useState } from 'react';
import { X, Settings, Volume2, VolumeX, LogOut, Sliders } from 'lucide-react';
import { sounds } from '../audio/soundEffects';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQuitGame: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onQuitGame,
}) => {
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(sounds.enabled);
  const [volume, setVolumeState] = useState<number>(Math.round(sounds.volume * 100));

  if (!isOpen) return null;

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

  const handleConfirmQuit = () => {
    sounds.playClick();
    onQuitGame();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 select-none animate-fadeIn">
      <div className="relative w-full max-w-sm bg-slate-900 border-2 border-blue-500/80 chamfer-lg shadow-[0_0_40px_rgba(37,99,235,0.4)] p-4 flex flex-col text-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-blue-900/60 pb-2 mb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm sm:text-base font-black tracking-wide text-white uppercase font-mono">
              CÀI ĐẶT TRÒ CHƠI
            </h3>
          </div>

          <button
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="w-7 h-7 chamfer-sm bg-slate-800 hover:bg-blue-900 text-blue-200 flex items-center justify-center transition border border-blue-700/50 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Audio Controls */}
        <div className="space-y-3 mb-4">
          {/* Sound Toggle */}
          <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-blue-900/50 chamfer-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-200">
              {isSoundEnabled ? <Volume2 size={16} className="text-blue-400" /> : <VolumeX size={16} className="text-rose-400" />}
              <span>Âm thanh trò chơi</span>
            </div>
            <button
              onClick={handleToggleSound}
              className={`px-3 py-1 chamfer-sm text-xs font-black transition cursor-pointer ${
                isSoundEnabled
                  ? 'bg-blue-600 text-white border border-blue-300'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {isSoundEnabled ? 'BẬT' : 'TẮT'}
            </button>
          </div>

          {/* Volume Slider */}
          <div className="p-2.5 bg-slate-950 border border-blue-900/50 chamfer-sm space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-blue-200">
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
        <div className="pt-2.5 border-t border-slate-800 flex flex-col gap-2">
          <button
            onClick={handleConfirmQuit}
            className="w-full py-2.5 chamfer-lg bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-500 text-white font-black text-xs sm:text-sm tracking-wide border-2 border-blue-300 shadow-[0_0_20px_rgba(37,99,235,0.6)] active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut size={16} />
            <span>THOÁT GAME</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="w-full py-2 chamfer-md bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 cursor-pointer"
          >
            TIẾP TỤC CHƠI
          </button>
        </div>
      </div>
    </div>
  );
};
