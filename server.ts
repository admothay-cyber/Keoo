import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';

const PORT = 3000;

interface RemotePlayerState {
  id: string;
  name: string;
  classType: string;
  x: number;
  y: number;
  facingRight: boolean;
  angle: number;
  hp: number;
  maxHp: number;
  level: number;
  hairStyle: string;
  eyeStyle: string;
  skinColor: string;
  eyeColor: string;
  hairColor: string;
  hasSword: boolean;
  isDashing: boolean;
  isAttacking: boolean;
  updatedAt: number;
}

interface RoomState {
  code: string;
  hostId: string;
  maxPlayers: number;
  password?: string;
  players: Map<string, RemotePlayerState>;
  clients: Map<string, WebSocket>;
}

const rooms = new Map<string, RoomState>();

function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function broadcastRoomState(room: RoomState) {
  const payload = JSON.stringify({
    type: 'room:state',
    code: room.code,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    players: Array.from(room.players.values()),
  });

  for (const [, client] of room.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    let currentRoomCode: string | null = null;
    let currentPlayerId: string | null = null;

    const removeFromCurrentRoom = () => {
      if (currentRoomCode && currentPlayerId) {
        const room = rooms.get(currentRoomCode);
        if (room) {
          room.players.delete(currentPlayerId);
          room.clients.delete(currentPlayerId);
          if (room.players.size === 0) {
            rooms.delete(currentRoomCode);
          } else {
            if (room.hostId === currentPlayerId) {
              const firstRemaining = room.players.keys().next().value;
              if (firstRemaining) room.hostId = firstRemaining;
            }
            broadcastRoomState(room);
          }
        }
      }
      currentRoomCode = null;
      currentPlayerId = null;
    };

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'room:create') {
          removeFromCurrentRoom();
          const code = generateRoomCode();
          const maxPlayers = Math.max(2, Math.min(8, Number(msg.maxPlayers) || 4));
          const player: RemotePlayerState = msg.player;
          const password = msg.password ? String(msg.password).trim() : undefined;
          currentPlayerId = player.id;
          currentRoomCode = code;

          const room: RoomState = {
            code,
            hostId: player.id,
            maxPlayers,
            password,
            players: new Map([[player.id, { ...player, updatedAt: Date.now() }]]),
            clients: new Map([[player.id, ws]]),
          };
          rooms.set(code, room);

          ws.send(
            JSON.stringify({
              type: 'room:joined',
              code,
              maxPlayers,
              hostId: room.hostId,
              players: Array.from(room.players.values()),
            })
          );
        } else if (msg.type === 'room:join') {
          const code = String(msg.code || '').trim().toUpperCase();
          const room = rooms.get(code);
          if (!room) {
            ws.send(JSON.stringify({ type: 'room:error', message: 'Không tìm thấy mã phòng này!' }));
            return;
          }

          if (room.password) {
            const reqPass = msg.password ? String(msg.password).trim() : '';
            if (!reqPass) {
              ws.send(
                JSON.stringify({
                  type: 'room:error',
                  code: 'PASSWORD_REQUIRED',
                  message: 'Phòng này yêu cầu mật khẩu!',
                })
              );
              return;
            }
            if (reqPass !== room.password) {
              ws.send(
                JSON.stringify({
                  type: 'room:error',
                  code: 'PASSWORD_INCORRECT',
                  message: 'Mật khẩu phòng không chính xác!',
                })
              );
              return;
            }
          }

          const player: RemotePlayerState = msg.player;
          if (!room.players.has(player.id) && room.players.size >= room.maxPlayers) {
            ws.send(
              JSON.stringify({
                type: 'room:error',
                message: `Phòng đã đầy (${room.players.size}/${room.maxPlayers} người)!`,
              })
            );
            return;
          }

          removeFromCurrentRoom();
          currentPlayerId = player.id;
          currentRoomCode = code;

          room.players.set(player.id, { ...player, updatedAt: Date.now() });
          room.clients.set(player.id, ws);

          ws.send(
            JSON.stringify({
              type: 'room:joined',
              code,
              maxPlayers: room.maxPlayers,
              hostId: room.hostId,
              players: Array.from(room.players.values()),
            })
          );
          broadcastRoomState(room);
        } else if (msg.type === 'player:update') {
          if (!currentRoomCode || !currentPlayerId) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;
          const existing = room.players.get(currentPlayerId);
          if (!existing) return;

          const updated: RemotePlayerState = {
            ...existing,
            ...msg.state,
            id: currentPlayerId,
            updatedAt: Date.now(),
          };
          room.players.set(currentPlayerId, updated);

          // Broadcast delta update to other players in the room
          const deltaPayload = JSON.stringify({
            type: 'player:moved',
            player: updated,
          });
          for (const [pid, client] of room.clients) {
            if (pid !== currentPlayerId && client.readyState === WebSocket.OPEN) {
              client.send(deltaPayload);
            }
          }
        } else if (msg.type === 'room:leave') {
          removeFromCurrentRoom();
        }
      } catch {
        // Ignore malformed packets
      }
    });

    ws.on('close', () => {
      removeFromCurrentRoom();
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
