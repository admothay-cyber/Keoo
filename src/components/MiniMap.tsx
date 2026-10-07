import React, { useRef, useEffect, memo } from 'react';
import { ClassType, RemotePlayer } from '../types/game';

export interface MiniMapEntity {
  id: string | number;
  x: number;
  y: number;
  hp?: number;
  maxHp?: number;
  type?: string;
  isDummy?: boolean;
  isBot?: boolean;
}

export interface MiniMapGem {
  id: string | number;
  x: number;
  y: number;
  currencyType?: 'gold' | 'red' | 'exp';
}

interface MiniMapProps {
  playerX?: number;
  playerY?: number;
  playerFacingRight?: boolean;
  playerName?: string;
  playerClass?: ClassType;
  enemies?: MiniMapEntity[];
  remotePlayers?: RemotePlayer[];
  gems?: MiniMapGem[];
  forestBoundX?: number;
  forestBoundY?: number;
  spawnerPos?: { x: number; y: number };
  getPlayerState?: () => { x: number; y: number; facingRight: boolean };
  getEnemiesState?: () => MiniMapEntity[];
  getGemsState?: () => MiniMapGem[];
}

export const MiniMap: React.FC<MiniMapProps> = memo(({
  playerX = 0,
  playerY = 0,
  playerFacingRight = true,
  enemies: propEnemies,
  remotePlayers = [],
  gems: propGems,
  forestBoundX = 1760,
  forestBoundY = 1740,
  spawnerPos = { x: 340, y: -140 },
  getPlayerState,
  getEnemiesState,
  getGemsState,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Circular Map Dimension
  const mapSize = 96;
  const radius = mapSize / 2;
  const padding = 5;
  const drawRadius = radius - padding;

  // Running smooth canvas loop
  useEffect(() => {
    let animId: number;

    const render = (now: number) => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Get current state
          const pState = getPlayerState ? getPlayerState() : { x: playerX, y: playerY, facingRight: playerFacingRight };
          const activeEnemies = getEnemiesState ? getEnemiesState() : (propEnemies || []);
          const activeGems = getGemsState ? getGemsState() : (propGems || []);

          // High DPI scaling
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const targetSize = Math.round(mapSize * dpr);
          if (canvas.width !== targetSize || canvas.height !== targetSize) {
            canvas.width = targetSize;
            canvas.height = targetSize;
          }

          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.scale(dpr, dpr);

          // 1. Clip to perfect circle
          ctx.beginPath();
          ctx.arc(radius, radius, drawRadius, 0, Math.PI * 2);
          ctx.clip();

          // 2. Nền bản đồ đất & thảo nguyên hình tròn sạch đẹp
          const grassGrad = ctx.createRadialGradient(
            radius, radius, 4,
            radius, radius, drawRadius
          );
          grassGrad.addColorStop(0, '#8aa84e');
          grassGrad.addColorStop(0.7, '#81a345');
          grassGrad.addColorStop(1, '#5d7d2c');

          ctx.fillStyle = grassGrad;
          ctx.fillRect(0, 0, mapSize, mapSize);

          // World to Minimap conversion (tính theo bán kính hình tròn)
          const worldToMinimap = (wx: number, wy: number) => {
            const normX = wx / forestBoundX; // -1 to 1
            const normY = wy / forestBoundY; // -1 to 1
            const mx = radius + normX * (drawRadius - 3);
            const my = radius + normY * (drawRadius - 3);
            return { x: mx, y: my };
          };

          // 3. Đánh dấu Khu Vực Đánh Quái trên bản đồ (Monster Spawner Zone Marker)
          if (spawnerPos) {
            const sp = worldToMinimap(spawnerPos.x, spawnerPos.y);
            const distFromCenter = Math.hypot(sp.x - radius, sp.y - radius);
            if (distFromCenter <= drawRadius - 3) {
              // Vùng hào quang đỏ cảnh báo nguy hiểm đập nhịp quanh khu vực đánh quái
              const pulse = Math.sin(now * 0.005) * 2.5 + 11;
              const spGrad = ctx.createRadialGradient(sp.x, sp.y, 1, sp.x, sp.y, pulse);
              spGrad.addColorStop(0, 'rgba(239, 68, 68, 0.45)');
              spGrad.addColorStop(0.6, 'rgba(220, 38, 38, 0.25)');
              spGrad.addColorStop(1, 'rgba(185, 28, 28, 0)');
              ctx.fillStyle = spGrad;
              ctx.beginPath();
              ctx.arc(sp.x, sp.y, pulse, 0, Math.PI * 2);
              ctx.fill();

              // Viền nét đứt cảnh báo khu vực quái
              ctx.strokeStyle = 'rgba(248, 113, 113, 0.6)';
              ctx.lineWidth = 0.8;
              ctx.setLineDash([2, 2]);
              ctx.beginPath();
              ctx.arc(sp.x, sp.y, 9, 0, Math.PI * 2);
              ctx.stroke();
              ctx.setLineDash([]);

              // Khối đánh dấu khu vực quái (Biểu tượng vuông đỏ viền trắng nổi bật có tâm trắng)
              ctx.fillStyle = '#dc2626';
              ctx.fillRect(sp.x - 3.5, sp.y - 3.5, 7, 7);
              ctx.fillStyle = '#fef2f2';
              ctx.fillRect(sp.x - 1, sp.y - 1, 2, 2);
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1;
              ctx.strokeRect(sp.x - 3.5, sp.y - 3.5, 7, 7);
            }
          }

          // 4. Vẽ vật phẩm rơi (Gems: Vàng & Đỏ)
          activeGems.forEach((gem) => {
            const gp = worldToMinimap(gem.x, gem.y);
            const distFromCenter = Math.hypot(gp.x - radius, gp.y - radius);
            if (distFromCenter <= drawRadius - 2) {
              ctx.fillStyle = gem.currencyType === 'exp' ? '#06b6d4' : gem.currencyType === 'red' ? '#ef4444' : '#facc15';
              ctx.fillRect(gp.x - 1.2, gp.y - 1.2, 2.4, 2.4);
            }
          });

          // 5. Quái vật & Bot (Enemies & Combat Bots)
          activeEnemies.forEach((enemy) => {
            if (enemy.hp !== undefined && enemy.hp <= 0) return;
            if (enemy.isDummy || enemy.type === 'dummy') return;

            const ep = worldToMinimap(enemy.x, enemy.y);
            const distFromCenter = Math.hypot(ep.x - radius, ep.y - radius);
            if (distFromCenter <= drawRadius - 2) {
              if (enemy.isBot || enemy.type === 'bot') {
                // Bot chiến đấu: Hình vuông cam đỏ viền trắng
                ctx.fillStyle = '#f97316';
                ctx.fillRect(ep.x - 2.5, ep.y - 2.5, 5, 5);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 0.8;
                ctx.strokeRect(ep.x - 2.5, ep.y - 2.5, 5, 5);
              } else {
                // Quái vật thường: Chấm đỏ vuông pixel
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(ep.x - 1.8, ep.y - 1.8, 3.6, 3.6);
                ctx.strokeStyle = '#fecaca';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(ep.x - 1.8, ep.y - 1.8, 3.6, 3.6);
              }
            }
          });

          // 6. Đồng đội / Người chơi khác trong Multiplayer
          remotePlayers.forEach((rp) => {
            const rpPos = worldToMinimap(rp.x, rp.y);
            const distFromCenter = Math.hypot(rpPos.x - radius, rpPos.y - radius);
            if (distFromCenter <= drawRadius - 2) {
              ctx.fillStyle = '#38bdf8';
              ctx.beginPath();
              ctx.arc(rpPos.x, rpPos.y, 2.6, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 0.6;
              ctx.stroke();
            }
          });

          // 7. Người chơi chính (Local Player)
          const pp = worldToMinimap(pState.x, pState.y);

          // Hào quang xanh ngọc đập nhịp
          const pulseR = 4.5 + Math.sin(now * 0.005) * 1.2;
          ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
          ctx.beginPath();
          ctx.arc(pp.x, pp.y, pulseR, 0, Math.PI * 2);
          ctx.fill();

          // Chấm người chơi
          ctx.fillStyle = '#0284c7';
          ctx.beginPath();
          ctx.arc(pp.x, pp.y, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.restore();

          // 8. Viền tròn kim loại bên ngoài (Circular Metallic Outer Ring)
          ctx.save();
          ctx.scale(dpr, dpr);
          ctx.strokeStyle = 'rgba(51, 65, 85, 0.9)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(radius, radius, drawRadius, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(radius, radius, drawRadius - 1.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    mapSize,
    radius,
    drawRadius,
    forestBoundX,
    forestBoundY,
    spawnerPos,
    playerX,
    playerY,
    playerFacingRight,
    propEnemies,
    propGems,
    remotePlayers,
    getPlayerState,
    getEnemiesState,
    getGemsState,
  ]);

  return (
    <div
      className="pointer-events-auto relative rounded-full bg-slate-950/80 backdrop-blur-md border-2 border-slate-700/80 shadow-[0_0_20px_rgba(0,0,0,0.85)] flex items-center justify-center select-none overflow-hidden"
      style={{ width: mapSize, height: mapSize }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: mapSize, height: mapSize }}
        className="block rounded-full"
      />
    </div>
  );
});
