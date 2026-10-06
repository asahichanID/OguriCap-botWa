/**
 * Snake 2 MMO Realtime WebSocket Server & Bridge Engine
 * Handles /ws/snake2 for HTTPS browser clients and bridges seamlessly with ws://medium.lynzz.id:2252
 */

import { WebSocketServer, WebSocket } from 'ws';

const UPSTREAM_WS_URL = 'ws://medium.lynzz.id:2252';
const DEFAULT_ROOM = 'snake2_global';

export class Snake2WsManager {
  static wss = null;
  static upstreamWs = null;
  static isUpstreamConnected = false;
  static upstreamReconnectTimer = null;
  static rooms = new Map(); // roomId -> Map(playerId -> { ws, playerInfo })

  static init(httpServer) {
    if (this.wss) return this.wss;
    try {
      this.wss = new WebSocketServer({
        noServer: true
      });

      this.wss.on('connection', (ws, req) => {
        this.handleClientConnection(ws, req);
      });

      this.connectUpstream();

      console.log('🐍 Snake 2 MMO WebSocket Server & Bridge aktif di /ws/snake2');
    } catch (err) {
      console.error('❌ Gagal inisialisasi Snake 2 WebSocket Server:', err);
    }
    return this.wss;
  }

  static connectUpstream() {
    if (this.upstreamReconnectTimer) {
      clearTimeout(this.upstreamReconnectTimer);
      this.upstreamReconnectTimer = null;
    }

    try {
      this.upstreamWs = new WebSocket(UPSTREAM_WS_URL);

      this.upstreamWs.on('open', () => {
        this.isUpstreamConnected = true;
        console.log(`[SNAKE2-BRIDGE] Terhubung ke upstream engine ${UPSTREAM_WS_URL}`);

        // Join global room on upstream
        this.upstreamWs.send(JSON.stringify({
          type: 'join_room',
          roomId: DEFAULT_ROOM,
          playerId: 'server_bridge_oguricap',
          playerName: 'OguriCap_Server',
          state: { active: true }
        }));
      });

      this.upstreamWs.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          const roomId = msg.roomId || DEFAULT_ROOM;

          // Broadcast upstream events (players from other servers) to our local clients
          if (msg.type === 'player_state' || msg.type === 'player_joined' || msg.type === 'player_left' || msg.type === 'room_joined') {
            this.broadcastToRoom(roomId, msg, null);
          }
        } catch (_) {}
      });

      this.upstreamWs.on('error', (err) => {
        this.isUpstreamConnected = false;
      });

      this.upstreamWs.on('close', () => {
        this.isUpstreamConnected = false;
        this.upstreamReconnectTimer = setTimeout(() => this.connectUpstream(), 3500);
      });
    } catch (err) {
      this.isUpstreamConnected = false;
      this.upstreamReconnectTimer = setTimeout(() => this.connectUpstream(), 5000);
    }
  }

  static handleClientConnection(ws, req) {
    ws.isAlive = true;
    ws.playerId = null;
    ws.roomId = DEFAULT_ROOM;
    ws.playerName = 'Pemain';

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (!msg || typeof msg !== 'object') return;

        const type = msg.type;
        const roomId = msg.roomId || ws.roomId || DEFAULT_ROOM;
        ws.roomId = roomId;

        if (type === 'ping') {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong', timestamp: msg.timestamp || Date.now() }));
          }
          if (this.upstreamWs && this.upstreamWs.readyState === WebSocket.OPEN) {
            this.upstreamWs.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          }
          return;
        }

        if (type === 'join_room') {
          ws.playerId = msg.playerId || ('p_' + Math.random().toString(36).substring(2, 8));
          ws.playerName = (msg.playerName || 'Pemain').substring(0, 12);

          let room = this.rooms.get(roomId);
          if (!room) {
            room = new Map();
            this.rooms.set(roomId, room);
          }

          room.set(ws.playerId, {
            ws,
            id: ws.playerId,
            name: ws.playerName,
            state: msg.state || {},
            joinedAt: Date.now(),
            lastUpdatedAt: Date.now()
          });

          // Compile all players in this room to return to joining client
          const playersList = [];
          room.forEach((p, id) => {
            playersList.push({
              id: p.id,
              name: p.name,
              state: p.state
            });
          });

          // Send confirmation back to joining client
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'room_joined',
              roomId: roomId,
              playerId: ws.playerId,
              players: playersList
            }));
          }

          // Broadcast to other local players
          this.broadcastToRoom(roomId, {
            type: 'player_joined',
            roomId: roomId,
            player: {
              id: ws.playerId,
              name: ws.playerName,
              state: msg.state || {}
            }
          }, ws);

          // Forward to upstream
          if (this.upstreamWs && this.upstreamWs.readyState === WebSocket.OPEN) {
            this.upstreamWs.send(JSON.stringify(msg));
          }
          return;
        }

        if (type === 'player_state') {
          const pId = msg.playerId || ws.playerId;
          const pName = msg.playerName || ws.playerName;

          const room = this.rooms.get(roomId);
          if (room && pId && room.has(pId)) {
            const entry = room.get(pId);
            entry.state = msg.state || entry.state;
            entry.name = pName;
            entry.lastUpdatedAt = Date.now();
          }

          // Broadcast state to all other local clients
          this.broadcastToRoom(roomId, {
            type: 'player_state',
            roomId: roomId,
            playerId: pId,
            playerName: pName,
            state: msg.state
          }, ws);

          // Forward to upstream
          if (this.upstreamWs && this.upstreamWs.readyState === WebSocket.OPEN) {
            this.upstreamWs.send(JSON.stringify(msg));
          }
          return;
        }

        if (type === 'leave_room') {
          this.handleClientLeave(ws);
          if (this.upstreamWs && this.upstreamWs.readyState === WebSocket.OPEN) {
            this.upstreamWs.send(JSON.stringify(msg));
          }
        }
      } catch (err) {
        console.error('[SNAKE2 WS MSG ERROR]', err);
      }
    });

    ws.on('close', () => {
      this.handleClientLeave(ws);
    });

    ws.on('error', () => {
      this.handleClientLeave(ws);
    });
  }

  static handleClientLeave(ws) {
    if (!ws.playerId || !ws.roomId) return;
    const room = this.rooms.get(ws.roomId);
    if (room) {
      room.delete(ws.playerId);
      if (room.size === 0) {
        this.rooms.delete(ws.roomId);
      }
    }

    this.broadcastToRoom(ws.roomId, {
      type: 'player_left',
      roomId: ws.roomId,
      playerId: ws.playerId
    }, ws);

    if (this.upstreamWs && this.upstreamWs.readyState === WebSocket.OPEN) {
      try {
        this.upstreamWs.send(JSON.stringify({
          type: 'leave_room',
          roomId: ws.roomId,
          playerId: ws.playerId
        }));
      } catch (_) {}
    }
  }

  static broadcastToRoom(roomId, payload, senderWs = null) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    room.forEach((entry) => {
      if (entry.ws !== senderWs && entry.ws.readyState === WebSocket.OPEN) {
        try {
          entry.ws.send(data);
        } catch (_) {}
      }
    });
  }
}

export const initSnake2Ws = (httpServer) => Snake2WsManager.init(httpServer);
export default initSnake2Ws;
