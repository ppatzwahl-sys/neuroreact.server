const http  = require('http');
const { WebSocketServer } = require('ws');

const PORT  = process.env.PORT || 3000;
const rooms = new Map();

function genCode() {
  return Math.random().toString(36).slice(2,7).toUpperCase();
}

const server = http.createServer((req, res) => {
  // Health check endpoint
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Access-Control-Allow-Origin': '*',
  });
  res.end('NeuroReact WS Server running');
});

const wss = new WebSocketServer({ noServer: true });

// Explicit upgrade handler — required for Railway
server.on('upgrade', (req, socket, head) => {
  console.log('WS upgrade request from:', req.headers.origin || 'unknown');
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws) => {
  ws.roomCode = null;
  ws.role     = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // ── CREATE ROOM (Trainer) ──
    if (msg.type === 'create') {
      const code = genCode();
      rooms.set(code, { host: ws, clients: new Set() });
      ws.roomCode = code;
      ws.role     = 'host';
      ws.send(JSON.stringify({ type: 'created', code }));
      return;
    }

    // ── JOIN ROOM (Spieler) ──
    if (msg.type === 'join') {
      const code = (msg.code || '').toUpperCase().trim();
      const room = rooms.get(code);
      if (!room) { ws.send(JSON.stringify({ type: 'error', msg: 'Raum nicht gefunden' })); return; }
      room.clients.add(ws);
      ws.roomCode = code;
      ws.role     = 'client';
      ws.send(JSON.stringify({ type: 'joined', code, clients: room.clients.size }));
      // Notify host
      room.host.send(JSON.stringify({ type: 'client_joined', clients: room.clients.size }));
      return;
    }

    // ── STIMULUS (Host → alle Clients) ──
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
      // Host disconnected — notify clients and delete room
      room.clients.forEach(c => c.send(JSON.stringify({ type: 'host_left' })));
      rooms.delete(code);
    } else {
      room.clients.delete(ws);
      if (room.host.readyState === 1) {
        room.host.send(JSON.stringify({ type: 'client_left', clients: room.clients.size }));
      }
    }
  });
});

server.listen(PORT, () => console.log(`NeuroReact WS Server on port ${PORT}`));
