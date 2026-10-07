import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { LoginScreen } from './components/LoginScreen';
import { CharacterCreationModal } from './components/CharacterCreationModal';
import { QuickClassSelectModal } from './components/QuickClassSelectModal';
import { RoomLobbyModal } from './components/RoomLobbyModal';
import { ClassType, CharacterCustomization, RemotePlayer } from './types/game';

type AppStep = 'login' | 'character_create' | 'quick_class_select' | 'lobby' | 'playing';

export default function App() {
  const [step, setStep] = useState<AppStep>('login');
  const [guestId, setGuestId] = useState<string>(() => 'hero_' + Math.random().toString(36).substring(2, 9));
  const [activeClass, setActiveClass] = useState<ClassType>('Fighter');

  const [customization, setCustomization] = useState<CharacterCustomization>({
    name: 'Dũng Sĩ',
    classType: 'Fighter',
    hairStyle: 'hair_black',
    eyeStyle: 'dots',
    skinColor: 'original',
    eyeColor: '#0f172a',
    hairColor: 'original',
  });

  // Multiplayer Room & Pending Mode State
  const [gameMode, setGameMode] = useState<'solo' | 'multiplayer'>('solo');
  const [pendingModeConfig, setPendingModeConfig] = useState<{
    action: 'solo' | 'create' | 'join';
    maxPlayers?: number;
    roomCode?: string;
    roomPassword?: string;
  }>({ action: 'solo' });
  const [roomCode, setRoomCode] = useState<string>('');
  const [maxPlayers, setMaxPlayers] = useState<number>(4);
  const [remotePlayers, setRemotePlayers] = useState<RemotePlayer[]>([]);
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const lockLandscape = async () => {
      try {
        if (window.screen?.orientation && 'lock' in window.screen.orientation) {
          await (window.screen.orientation as any).lock('landscape');
        }
      } catch {
        // Ignore rejection on desktop or unsupported devices
      }
    };
    lockLandscape();
    window.addEventListener('touchstart', lockLandscape, { once: true });
    window.addEventListener('orientationchange', lockLandscape);
    return () => window.removeEventListener('orientationchange', lockLandscape);
  }, []);

  const connectWebSocket = useCallback(
    (onOpenAction: (ws: WebSocket) => void) => {
      setLobbyError(null);
      setIsConnecting(true);

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        onOpenAction(ws);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'room:joined') {
            setIsConnecting(false);
            setRoomCode(msg.code);
            setMaxPlayers(msg.maxPlayers || 4);
            setRemotePlayers((msg.players || []).filter((p: RemotePlayer) => p.id !== guestId));
            setGameMode('multiplayer');
            setStep('playing');
          } else if (msg.type === 'room:state') {
            setRoomCode(msg.code);
            setMaxPlayers(msg.maxPlayers || 4);
            setRemotePlayers((msg.players || []).filter((p: RemotePlayer) => p.id !== guestId));
          } else if (msg.type === 'player:moved') {
            const movedPlayer: RemotePlayer = msg.player;
            if (movedPlayer.id === guestId) return;
            setRemotePlayers((prev) => {
              const exists = prev.some((p) => p.id === movedPlayer.id);
              if (!exists) return [...prev, movedPlayer];
              return prev.map((p) => (p.id === movedPlayer.id ? movedPlayer : p));
            });
          } else if (msg.type === 'room:error') {
            setIsConnecting(false);
            setLobbyError(msg.message || 'Không thể vào phòng!');
            setStep('lobby');
          }
        } catch {
          // Ignore invalid JSON
        }
      };

      ws.onerror = () => {
        setIsConnecting(false);
        setLobbyError('Không thể kết nối máy chủ phòng!');
        setStep('lobby');
      };

      ws.onclose = () => {
        setIsConnecting(false);
      };
    },
    []
  );

  const launchMultiplayerSession = (
    custom: CharacterCustomization,
    config: typeof pendingModeConfig
  ) => {
    const initialPlayer: RemotePlayer = {
      id: guestId,
      name: custom.name,
      classType: custom.classType,
      x: 0,
      y: 0,
      facingRight: true,
      angle: 0,
      hp: 100,
      maxHp: 100,
      level: 1,
      hairStyle: custom.hairStyle,
      eyeStyle: custom.eyeStyle,
      skinColor: custom.skinColor,
      eyeColor: custom.eyeColor,
      hairColor: custom.hairColor,
      hasSword: false,
      isDashing: false,
      isAttacking: false,
    };

    if (config.action === 'create') {
      connectWebSocket((ws) => {
        ws.send(
          JSON.stringify({
            type: 'room:create',
            maxPlayers: config.maxPlayers || 4,
            password: config.roomPassword,
            player: initialPlayer,
          })
        );
      });
    } else if (config.action === 'join' && config.roomCode) {
      connectWebSocket((ws) => {
        ws.send(
          JSON.stringify({
            type: 'room:join',
            code: config.roomCode,
            password: config.roomPassword,
            player: initialPlayer,
          })
        );
      });
    }
  };

  const handleSendPlayerState = useCallback((state: Partial<RemotePlayer>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'player:update',
          state,
        })
      );
    }
  }, []);

  const handleLeaveRoom = useCallback(() => {
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'room:leave' }));
      }
      wsRef.current.close();
      wsRef.current = null;
    }
    setRemotePlayers([]);
    setRoomCode('');
    setStep('lobby');
  }, []);

  return (
    <div
      className="fixed inset-0 w-screen h-screen overflow-hidden bg-slate-900 text-slate-100 flex flex-col font-sans select-none touch-none"
      style={{
        backgroundColor: '#0b1120',
        backgroundImage:
          'repeating-linear-gradient(28.7deg, rgba(56, 189, 248, 0.14) 0px, rgba(56, 189, 248, 0.14) 1px, transparent 1px, transparent 41px), repeating-linear-gradient(-28.7deg, rgba(56, 189, 248, 0.14) 0px, rgba(56, 189, 248, 0.14) 1px, transparent 1px, transparent 41px)',
      }}
    >
      <main className="w-full h-full relative overflow-hidden">
        {/* 1. Đăng nhập (Login) */}
        {step === 'login' && (
          <LoginScreen
            onLoginSuccess={(id, name) => {
              setGuestId(id);
              setCustomization((prev) => ({ ...prev, name }));
              setLobbyError(null);
              setStep('lobby');
            }}
          />
        )}

        {/* 2. Chọn Chế độ chơi (Game Mode Select) */}
        {step === 'lobby' && (
          <RoomLobbyModal
            customization={customization}
            onBackToCharacter={() => setStep('login')}
            onStartSolo={() => {
              setLobbyError(null);
              setPendingModeConfig({ action: 'solo' });
              setGameMode('solo');
              setRoomCode('');
              setRemotePlayers([]);
              setStep('character_create');
            }}
            onCreateRoom={(maxCount, roomPassword) => {
              setLobbyError(null);
              setPendingModeConfig({
                action: 'create',
                maxPlayers: maxCount,
                roomPassword,
              });
              setMaxPlayers(maxCount);
              setStep('character_create');
            }}
            onJoinRoom={(code, roomPassword) => {
              setLobbyError(null);
              setPendingModeConfig({
                action: 'join',
                roomCode: code,
                roomPassword,
              });
              setStep('character_create');
            }}
            errorMsg={lobbyError}
            isConnecting={isConnecting}
          />
        )}

        {/* 3. Màn hình Tạo ngoại hình (Character Creation) */}
        {step === 'character_create' && (
          <CharacterCreationModal
            isOpen={true}
            canClose={true}
            onClose={() => setStep('lobby')}
            initialClass={customization.classType}
            initialName={customization.name}
            initialEyeStyle={customization.eyeStyle}
            initialHairStyle={customization.hairStyle}
            initialSkinColor={customization.skinColor as any}
            initialHairColor={customization.hairColor as any}
            onConfirm={(name, selectedClass, eyeStyle, hairStyle, hairColor, skinColor) => {
              setActiveClass(selectedClass);
              setCustomization({
                name,
                classType: selectedClass,
                eyeStyle,
                hairStyle,
                skinColor: skinColor || 'default',
                hairColor: hairColor || 'black',
              });
              setStep('quick_class_select');
            }}
          />
        )}

        {/* 4. Màn hình Chọn Class (Quick Class Select - BƯỚC CUỐI CÙNG) */}
        {step === 'quick_class_select' && (
          <QuickClassSelectModal
            isOpen={true}
            customization={customization}
            onBackToCustomization={() => setStep('character_create')}
            onConfirmClass={(selectedClass) => {
              const updatedCustom: CharacterCustomization = {
                ...customization,
                classType: selectedClass,
              };
              setActiveClass(selectedClass);
              setCustomization(updatedCustom);

              if (pendingModeConfig.action === 'solo') {
                setGameMode('solo');
                setRoomCode('');
                setRemotePlayers([]);
                setStep('playing');
              } else {
                launchMultiplayerSession(updatedCustom, pendingModeConfig);
              }
            }}
          />
        )}

        {step === 'playing' && (
          <GameCanvas
            activeClass={activeClass}
            onClassChange={(c) => {
              setActiveClass(c);
              setCustomization((prev) => ({ ...prev, classType: c }));
            }}
            initialCustomization={customization}
            onCustomizationChange={(nextCustom) => {
              setCustomization(nextCustom);
            }}
            roomInfo={{
              mode: gameMode,
              roomCode,
              maxPlayers,
              playerId: guestId,
            }}
            remotePlayers={remotePlayers}
            onSendPlayerState={gameMode === 'multiplayer' ? handleSendPlayerState : undefined}
            onLeaveRoom={handleLeaveRoom}
          />
        )}
      </main>
    </div>
  );
}
