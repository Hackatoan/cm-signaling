const WebSocket = require('ws');
const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('CM Signaling OK');
});

const wss = new WebSocket.Server({ server });
const peers = new Map(); // userId -> { ws, name }

wss.on('connection', (ws) => {
    let userId = null;

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

server.listen(3000, () => console.log('[CM-Signaling] listening on :3000'));
