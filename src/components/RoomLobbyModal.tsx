import React, { useState } from 'react';
import { Play, PlusCircle, KeyRound, Users, Check, Lock, X, ArrowLeft } from 'lucide-react';
import { CharacterCustomization } from '../types/game';
import { sounds } from '../audio/soundEffects';
import { NumpadModal } from './NumpadModal';

interface RoomLobbyModalProps {
  customization: CharacterCustomization;
  onBackToCharacter: () => void;
  onStartSolo: () => void;
  onCreateRoom: (maxPlayers: number, roomPassword?: string) => void;
  onJoinRoom: (roomCode: string, roomPassword?: string) => void;
  errorMsg?: string | null;
  isConnecting?: boolean;
}

export const RoomLobbyModal: React.FC<RoomLobbyModalProps> = ({
  customization,
  onBackToCharacter,
  onStartSolo,
  onCreateRoom,
  onJoinRoom,
  errorMsg,
  isConnecting = false,
}) => {
  const [activeSubView, setActiveSubView] = useState<'main' | 'create_room' | 'join_room'>('main');

  // Create Room state
  const [maxPlayers, setMaxPlayers] = useState<number>(4);
  const [roomPassword, setRoomPassword] = useState<string>('');
  const [isPasswordNumpadOpen, setIsPasswordNumpadOpen] = useState<boolean>(false);

  // Join Room state
  const [isJoinCodeNumpadOpen, setIsJoinCodeNumpadOpen] = useState<boolean>(false);
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [isJoinPasswordNumpadOpen, setIsJoinPasswordNumpadOpen] = useState<boolean>(false);
  const [joinPasswordInput, setJoinPasswordInput] = useState<string>('');

  const handleFinishCreateRoom = () => {
    sounds.playClick();
    onCreateRoom(maxPlayers, roomPassword.trim() || undefined);
  };

  const handleFinishJoinCodeConfirm = () => {
    setIsJoinCodeNumpadOpen(false);
  };

  const handleFinishJoinPasswordConfirm = () => {
    setIsJoinPasswordNumpadOpen(false);
  };

  const handleFinishJoinRoom = () => {
    sounds.playClick();
    if (joinCodeInput.trim().length < 6) return;
    onJoinRoom(joinCodeInput.trim(), joinPasswordInput.trim() || undefined);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 select-none overflow-hidden"
      style={{
        backgroundColor: '#0b1120',
        backgroundImage:
          'repeating-linear-gradient(28.7deg, rgba(56, 189, 248, 0.14) 0px, rgba(56, 189, 248, 0.14) 1px, transparent 1px, transparent 41px), repeating-linear-gradient(-28.7deg, rgba(56, 189, 248, 0.14) 0px, rgba(56, 189, 248, 0.14) 1px, transparent 1px, transparent 41px)',
      }}
    >
      {/* Main Container Scaled Down for Mobile Landscape */}
      <div className="relative w-full max-w-xs sm:max-w-sm bg-slate-900/95 border-2 border-blue-500/80 chamfer-lg shadow-[0_0_40px_rgba(37,99,235,0.35)] p-4 flex flex-col items-center text-center">
        {errorMsg && (
          <div className="w-full mb-3 p-2 chamfer-sm bg-rose-950/80 border border-rose-500/80 text-rose-200 text-xs font-bold">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* MAIN MENU VIEW: ONLY 3 VERTICALLY STACKED SCALED DOWN BLUE BUTTONS */}
        {activeSubView === 'main' && (
          <div className="w-full flex flex-col gap-2.5 my-1">
            {/* 1. Nút [Chơi đơn] */}
            <button
              onClick={() => {
                sounds.playClick();
                onStartSolo();
              }}
              className="w-full py-2.5 px-4 chamfer-lg bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-500 text-white font-black text-xs sm:text-sm tracking-wide border-2 border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.5)] active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white text-white" />
              <span>CHƠI ĐƠN</span>
            </button>

            {/* 2. Nút [Tạo phòng] */}
            <button
              onClick={() => {
                sounds.playClick();
                setActiveSubView('create_room');
              }}
              className="w-full py-2.5 px-4 chamfer-lg bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-500 text-white font-black text-xs sm:text-sm tracking-wide border-2 border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.5)] active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-white" />
              <span>TẠO PHÒNG</span>
            </button>

            {/* 3. Nút [Nhập mã] */}
            <button
              onClick={() => {
                sounds.playClick();
                setJoinCodeInput('');
                setJoinPasswordInput('');
                setActiveSubView('join_room');
                setIsJoinCodeNumpadOpen(true);
              }}
              className="w-full py-2.5 px-4 chamfer-lg bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-500 text-white font-black text-xs sm:text-sm tracking-wide border-2 border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.5)] active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-white" />
              <span>NHẬP MÃ</span>
            </button>
          </div>
        )}

        {/* JOIN ROOM PANEL VIEW */}
        {activeSubView === 'join_room' && (
          <div className="w-full flex flex-col gap-3">
            <div className="text-left border-b border-blue-900/60 pb-1.5 flex items-center justify-between">
              <h3 className="text-xs font-black text-white font-mono uppercase">
                NHẬP MÃ VÀO PHÒNG
              </h3>
              <button
                onClick={() => setActiveSubView('main')}
                className="text-blue-300 hover:text-white text-xs flex items-center gap-1 font-bold cursor-pointer"
              >
                <ArrowLeft size={14} /> Quay lại
              </button>
            </div>

            {/* Room Code field */}
            <div className="text-left space-y-1">
              <label className="block text-[11px] font-bold text-blue-300 uppercase flex items-center gap-1">
                <KeyRound size={12} /> Mã phòng (6 số)
              </label>
              <button
                onClick={() => setIsJoinCodeNumpadOpen(true)}
                className="w-full py-2 px-2.5 chamfer-md bg-slate-950 hover:bg-slate-800 border-2 border-blue-600/70 text-blue-200 font-mono text-xs font-bold flex items-center justify-between transition cursor-pointer"
              >
                <span>{joinCodeInput || 'Chạm để nhập mã 6 số'}</span>
                <span className="text-[10px] px-2 py-0.5 bg-blue-600 text-white font-bold chamfer-sm">
                  {joinCodeInput ? `${joinCodeInput.length}/6 số` : 'Nhập mã'}
                </span>
              </button>
            </div>

            {/* Optional Password field */}
            <div className="text-left space-y-1 pt-1.5 border-t border-slate-800">
              <label className="block text-[11px] font-bold text-blue-300 uppercase flex items-center gap-1">
                <Lock size={12} /> Mật khẩu phòng (nếu có)
              </label>
              <button
                onClick={() => setIsJoinPasswordNumpadOpen(true)}
                className="w-full py-2 px-2.5 chamfer-md bg-slate-950 hover:bg-slate-800 border-2 border-blue-600/70 text-blue-200 font-mono text-xs font-bold flex items-center justify-between transition cursor-pointer"
              >
                <span>{joinPasswordInput ? `**** (${joinPasswordInput.length} số)` : 'Không có mật khẩu'}</span>
                <span className="text-[10px] px-2 py-0.5 bg-blue-600 text-white font-bold chamfer-sm">
                  {joinPasswordInput ? 'Đã nhập' : 'Tùy chọn'}
                </span>
              </button>
            </div>

            {/* Action buttons */}
            <div className="pt-2 flex gap-2">
              <button
                onClick={() => setActiveSubView('main')}
                className="flex-1 py-2 chamfer-md bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-600 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleFinishJoinRoom}
                disabled={joinCodeInput.trim().length < 6 || isConnecting}
                className="flex-1 py-2 chamfer-md bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs border-2 border-blue-300 shadow-[0_0_12px_rgba(37,99,235,0.7)] transition cursor-pointer"
              >
                {isConnecting ? 'Đang kết nối...' : 'Vào phòng'}
              </button>
            </div>
          </div>
        )}

        {/* CREATE ROOM PANEL VIEW */}
        {activeSubView === 'create_room' && (
          <div className="w-full flex flex-col gap-3">
            <div className="text-left border-b border-blue-900/60 pb-1.5 flex items-center justify-between">
              <h3 className="text-xs font-black text-white font-mono uppercase">
                THIẾT LẬP TẠO PHÒNG
              </h3>
              <button
                onClick={() => setActiveSubView('main')}
                className="text-blue-300 hover:text-white text-xs flex items-center gap-1 font-bold cursor-pointer"
              >
                <ArrowLeft size={14} /> Quay lại
              </button>
            </div>

            {/* Max Players Selector */}
            <div className="text-left space-y-1.5">
              <label className="block text-[11px] font-bold text-blue-300 uppercase flex items-center gap-1">
                <Users size={12} /> Số người tối đa
              </label>
              <div className="grid grid-cols-5 gap-1">
                {[2, 3, 4, 6, 8].map((num) => (
                  <button
                    key={num}
                    onClick={() => {
                      sounds.playClick();
                      setMaxPlayers(num);
                    }}
                    className={`py-1.5 chamfer-sm font-black font-mono text-xs border transition cursor-pointer ${
                      maxPlayers === num
                        ? 'bg-blue-600 text-white border-white shadow-[0_0_8px_rgba(56,189,248,0.7)]'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-blue-600'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Password Set Button */}
            <div className="text-left space-y-1 pt-1.5 border-t border-slate-800">
              <label className="block text-[11px] font-bold text-blue-300 uppercase flex items-center gap-1">
                <Lock size={12} /> Mật khẩu phòng
              </label>
              <button
                onClick={() => setIsPasswordNumpadOpen(true)}
                className="w-full py-2 px-2.5 chamfer-md bg-slate-950 hover:bg-slate-800 border-2 border-blue-600/70 text-blue-200 font-mono text-xs font-bold flex items-center justify-between transition cursor-pointer"
              >
                <span>{roomPassword ? `**** (${roomPassword.length} số)` : 'Chưa đặt'}</span>
                <span className="text-[10px] px-2 py-0.5 bg-blue-600 text-white font-bold chamfer-sm">
                  Mật khẩu
                </span>
              </button>
            </div>

            {/* Create Room Submit Button */}
            <div className="pt-2 flex gap-2">
              <button
                onClick={() => setActiveSubView('main')}
                className="flex-1 py-2 chamfer-md bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-600 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleFinishCreateRoom}
                className="flex-1 py-2 chamfer-md bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-500 text-white font-black text-xs border-2 border-blue-300 shadow-[0_0_12px_rgba(37,99,235,0.7)] transition cursor-pointer"
              >
                Tạo phòng
              </button>
            </div>
          </div>
        )}
      </div>

      {/* NUMPAD MODAL: Setting Password for Create Room */}
      <NumpadModal
        isOpen={isPasswordNumpadOpen}
        title="MẬT KHẨU PHÒNG"
        isPasswordMode={true}
        maxLength={6}
        value={roomPassword}
        onChange={setRoomPassword}
        onConfirm={() => setIsPasswordNumpadOpen(false)}
        onClose={() => setIsPasswordNumpadOpen(false)}
      />

      {/* NUMPAD MODAL: Enter 6-digit Room Code */}
      <NumpadModal
        isOpen={isJoinCodeNumpadOpen}
        title="MÃ PHÒNG (6 SỐ)"
        isPasswordMode={false}
        maxLength={6}
        value={joinCodeInput}
        onChange={setJoinCodeInput}
        onConfirm={handleFinishJoinCodeConfirm}
        onClose={() => setIsJoinCodeNumpadOpen(false)}
      />

      {/* NUMPAD MODAL: Enter Password for Joining Room */}
      <NumpadModal
        isOpen={isJoinPasswordNumpadOpen}
        title="MẬT KHẨU VÀO PHÒNG"
        isPasswordMode={true}
        maxLength={6}
        value={joinPasswordInput}
        onChange={setJoinPasswordInput}
        onConfirm={handleFinishJoinPasswordConfirm}
        onClose={() => setIsJoinPasswordNumpadOpen(false)}
      />
    </div>
  );
};
