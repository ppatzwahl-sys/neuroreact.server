const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const rooms = new Map();

function genCode() {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

// HTTP server — handles health checks AND WebSocket upgrades
const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
  });
  res.end('NeuroReact WS Server running');
});

// WebSocket server attached to HTTP server directly (not noServer)
// This ensures Railway proxy forwards WS upgrades correctly
const wss = new WebSocketServer({
  server,
  verifyClient: (info, cb) => {
    console.log('WS connect from origin:', info.origin || 'no-origin');
    cb(true); // accept all origins
  }
});

wss.on('connection', (ws, req) => {
  console.log('Client connected. Rooms active:', rooms.size);
  ws.roomCode = null;
  ws.role = null;
  ws.isAlive = true;

  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    console.log('MSG:', msg.type, ws.role || 'new');

    if (msg.type === 'create') {
      const code = genCode();
      rooms.set(code, { host: ws, clients: new Set() });
      ws.roomCode = code;
      ws.role = 'host';
      ws.send(JSON.stringify({ type: 'created', code }));
      console.log('Room created:', code);
      return;
    }

    if (msg.type === 'join') {
      const code = (msg.code || '').toUpperCase().trim();
      const room = rooms.get(code);
      if (!room) {
        ws.send(JSON.stringify({ type: 'error', msg: 'Raum nicht gefunden' }));
        return;
      }
      room.clients.add(ws);
      ws.roomCode = code;
      ws.role = 'client';
      ws.send(JSON.stringify({ type: 'joined', code, clients: room.clients.size }));
      room.host.send(JSON.stringify({ type: 'client_joined', clients: room.clients.size }));
      console.log('Client joined room:', code, '— total:', room.clients.size);
      return;
    }

    if (msg.type === 'stimulus' || msg.type === 'pause' || msg.type === 'stop') {
      const room = rooms.get(ws.roomCode);
      if (!room || ws !== room.host) return;
      const payload = JSON.stringify(msg);
      room.clients.forEach(c => { if (c.readyState === 1) c.send(payload); });
      return;
    }
  });

  ws.on('close', () => {
    const code = ws.roomCode;
    if (!code || !rooms.has(code)) return;
    const room = rooms.get(code);
    if (ws.role === 'host') {
      room.clients.forEach(c => c.send(JSON.stringify({ type: 'host_left' })));
      rooms.delete(code);
      console.log('Room deleted:', code);
    } else {
      room.clients.delete(ws);
      if (room.host.readyState === 1) {
        room.host.send(JSON.stringify({ type: 'client_left', clients: room.clients.size }));
      }
    }
  });

  ws.on('error', (e) => console.error('WS client error:', e.message));
});

// Heartbeat — ping every 30s to keep connections alive through Railway proxy
const heartbeat = setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) { ws.terminate(); return; }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => clearInterval(heartbeat));

server.listen(PORT, '0.0.0.0', () => {
  console.log(`NeuroReact WS Server on port ${PORT}`);
});
