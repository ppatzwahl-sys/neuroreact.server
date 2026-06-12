const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const rooms = new Map();

function genCode() {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

const server = http.createServer((req, res) => {
  // Railway health check + CORS preflight
  const headers = {
    'Content-Type': 'text/plain',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Upgrade, Connection',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'X-Accel-Buffering': 'no',   // disables Railway nginx buffering
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, headers); res.end(); return; }
  res.writeHead(200, headers);
  res.end('NeuroReact WS Server running');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  console.log('Client connected from:', req.headers['x-forwarded-for'] || req.socket.remoteAddress);
  ws.room = null;
  ws.role = null;
  ws.isAlive = true;

  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      console.log('MSG:', msg.type, '| role:', ws.role || 'new');

      if (msg.type === 'create') {
        const code = genCode();
        rooms.set(code, { host: ws, clients: new Set() });
        ws.room = code; ws.role = 'host';
        ws.send(JSON.stringify({ type: 'created', code }));
        console.log('Room created:', code);

      } else if (msg.type === 'join') {
        const code = (msg.code || '').toUpperCase().trim();
        const room = rooms.get(code);
        if (!room) { ws.send(JSON.stringify({ type: 'error', msg: 'Raum nicht gefunden' })); return; }
        room.clients.add(ws);
        ws.room = code; ws.role = 'client';
        ws.send(JSON.stringify({ type: 'joined', code, clients: room.clients.size }));
        room.host.send(JSON.stringify({ type: 'client_joined', clients: room.clients.size }));
        console.log('Client joined:', code, '| total clients:', room.clients.size);

      } else if (['stimulus', 'pause', 'stop'].includes(msg.type)) {
        const room = rooms.get(ws.room);
        if (room && ws === room.host) {
          const p = JSON.stringify(msg);
          room.clients.forEach(c => { if (c.readyState === 1) c.send(p); });
        }
      }
    } catch (e) { console.error('Parse error:', e.message); }
  });

  ws.on('close', () => {
    if (!ws.room || !rooms.has(ws.room)) return;
    const room = rooms.get(ws.room);
    if (ws.role === 'host') {
      room.clients.forEach(c => c.send(JSON.stringify({ type: 'host_left' })));
      rooms.delete(ws.room);
      console.log('Room deleted:', ws.room);
    } else {
      room.clients.delete(ws);
      if (room.host.readyState === 1)
        room.host.send(JSON.stringify({ type: 'client_left', clients: room.clients.size }));
    }
  });

  ws.on('error', e => console.error('WS error:', e.message));
});

// Heartbeat — keeps connections alive through Railway proxy (60s timeout)
const heartbeat = setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) { ws.terminate(); return; }
    ws.isAlive = false;
    ws.ping();
  });
}, 25000);

wss.on('close', () => clearInterval(heartbeat));

server.listen(PORT, '0.0.0.0', () => {
  console.log('NeuroReact WS Server on port', PORT);
});
