/** Socket.IO: salas por campanha e por usuário (tempo real do Escudo do Mestre). */
import { Server } from 'socket.io';
import { get } from '../db/connection.js';
import { verifyToken } from '../lib/auth.js';

export const campaignRoom = (campaignId) => `campaign:${campaignId}`;
export const userRoom = (userId) => `user:${userId}`;

let io = null;

export function initRealtime(httpServer, { corsOrigins = [] } = {}) {
  io = new Server(httpServer, {
    cors: { origin: corsOrigins, credentials: true },
  });

  // Todo socket precisa de um JWT válido (mesmo token do REST).
  io.use((socket, next) => {
    const headerToken = String(socket.handshake.headers?.authorization ?? '').replace('Bearer ', '');
    const token = socket.handshake.auth?.token ?? headerToken;
    try {
      socket.data.user = verifyToken(token);
      next();
    } catch (error) {
      next(new Error(error.message ?? 'Não autorizado.'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    socket.join(userRoom(user.id));
    socket.emit('connected', { userId: user.id, name: user.name });

    // Entra na sala da campanha (apenas DM ou membro).
    socket.on('campaign:join', (payload = {}) => {
      const campaignId = Number(payload.campaignId);
      if (!campaignId) return;

      const isDm = get('SELECT id FROM campaigns WHERE id = ? AND dm_id = ?', [campaignId, user.id]);
      const isMember = get('SELECT id FROM campaign_members WHERE campaign_id = ? AND user_id = ?', [campaignId, user.id]);

      if (!isDm && !isMember) {
        socket.emit('error:forbidden', { message: 'Você não participa desta campanha.' });
        return;
      }

      socket.join(campaignRoom(campaignId));
      socket.emit('campaign:joined', { campaignId });
    });

    socket.on('campaign:leave', (payload = {}) => {
      const campaignId = Number(payload.campaignId);
      if (campaignId) socket.leave(campaignRoom(campaignId));
    });
  });

  return io;
}

export function emitToCampaign(campaignId, event, payload) {
  io?.to(campaignRoom(campaignId)).emit(event, payload);
}

export function emitToUser(userId, event, payload) {
  io?.to(userRoom(userId)).emit(event, payload);
}

export function getIo() {
  return io;
}
