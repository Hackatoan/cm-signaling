const WebSocket = require('ws');
const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('CM Signaling OK');
});

const wss = new WebSocket.Server({ server });
const peers = new Map(); // userId -> { ws, name }

// Flood protection: cap how many signaling messages a single connection can
// send in a rolling window, so one misbehaving client can't spam another
// user with call-requests/ICE candidates.
const RATE_WINDOW_MS = 10_000;
const RATE_MAX_MSGS = 60;

wss.on('connection', (ws) => {
    let userId = null;
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    let msgCount = 0;
    let windowStart = Date.now();

    const send = (data) => {
        try { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); } catch {}
    };
    const relay = (to, payload) => {
        const peer = peers.get(String(to));
        if (peer?.ws.readyState === WebSocket.OPEN) {
            try { peer.ws.send(JSON.stringify({ ...payload, from: userId, fromName: peers.get(userId)?.name })); }
            catch {}
            return true;
        }
        return false;
    };

    ws.on('message', (raw) => {
        const now = Date.now();
        if (now - windowStart > RATE_WINDOW_MS) { windowStart = now; msgCount = 0; }
        if (++msgCount > RATE_MAX_MSGS) return;

        let msg;
        try { msg = JSON.parse(raw); } catch { return; }

        switch (msg.type) {
            case 'register':
                if (userId) peers.delete(userId);
                userId = String(msg.userId);
                peers.set(userId, { ws, name: msg.name || userId });
                send({ type: 'registered', userId });
                break;
            case 'call-request':
                if (!relay(msg.to, msg)) send({ type: 'call-failed', reason: 'User not available' });
                break;
            case 'call-accepted':
            case 'call-declined':
            case 'call-ended':
            case 'offer':
            case 'answer':
            case 'ice':
                relay(msg.to, msg);
                break;
        }
    });

    ws.on('close', () => { if (userId) peers.delete(userId); });
    ws.on('error', () => { if (userId) peers.delete(userId); });
});

// Detect and drop half-open connections (e.g. a laptop that went to sleep
// mid-call) that never sent a close frame — without this, a dead peer can
// sit in the map reporting as "available" until the OS-level TCP timeout,
// which can be minutes, so calls silently fail to connect.
const heartbeatInterval = setInterval(() => {
    for (const ws of wss.clients) {
        if (ws.isAlive === false) { ws.terminate(); continue; }
        ws.isAlive = false;
        try { ws.ping(); } catch {}
    }
}, 30_000);
wss.on('close', () => clearInterval(heartbeatInterval));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`[CM-Signaling] listening on :${PORT}`));
