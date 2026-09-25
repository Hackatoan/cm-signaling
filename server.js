const WebSocket = require('ws');
const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('CM Signaling OK');
});

// Optional identity verification against cm-relay (the REST API that owns
// user accounts and bearer tokens). SECURITY: without this, 'register'
// accepts any client-supplied userId with no proof of ownership, so anyone
// who can reach this WebSocket endpoint can claim another user's signaling
// identity and receive their call-requests/offers/answers/ICE. Set RELAY_URL
// to turn on enforcement; left unset, behavior is unchanged from before this
// patch (see PR description for why this is opt-in rather than on by default).
const RELAY_URL = (process.env.RELAY_URL || '').replace(/\/$/, '');
const RELAY_TIMEOUT_MS = 3_000;
if (!RELAY_URL) {
    console.warn('[CM-Signaling] RELAY_URL not set — register is UNAUTHENTICATED (any client can claim any userId). See README/PR notes before enabling in production.');
}

async function verifyOwnership(userId, token) {
    if (!RELAY_URL) return true; // legacy/unconfigured: no verification available
    if (!token || typeof token !== 'string') return false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RELAY_TIMEOUT_MS);
    try {
        const res = await fetch(`${RELAY_URL}/api/me`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
        });
        if (!res.ok) return false;
        const body = await res.json();
        // Compare against canvasUserId, not relay's own `id` (a different
        // identity namespace) — canvasUserId is what call routing/userId
        // already means throughout this file.
        return body && body.canvasUserId != null && String(body.canvasUserId) === String(userId);
    } catch {
        return false; // fail closed: relay unreachable/erroring means we can't prove ownership
    } finally {
        clearTimeout(timer);
    }
}

const MAX_ID_LEN = 200;
const MAX_NAME_LEN = 100;

const wss = new WebSocket.Server({ server, maxPayload: 64 * 1024 }); // cap frame size: SDP/ICE messages are small; without this a client can send up to ws's 100MB default per-message, a cheap DoS lever on a public endpoint
const peers = new Map(); // userId -> { ws, name }

// Flood protection: cap how many signaling messages a single connection can
// send in a rolling window, so one misbehaving client can't spam another
// user with call-requests/ICE candidates.
const RATE_WINDOW_MS = 10_000;
const RATE_MAX_MSGS = 60;

wss.on('connection', (ws) => {
    let userId = null;
    // Cached alongside userId at register time so relay() doesn't need a
    // second peers.get() per message just to read back our own name.
    let userName = null;
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
            try { peer.ws.send(JSON.stringify({ ...payload, from: userId, fromName: userName })); }
            catch {}
            return true;
        }
        return false;
    };

    ws.on('message', async (raw) => {
        const now = Date.now();
        if (now - windowStart > RATE_WINDOW_MS) { windowStart = now; msgCount = 0; }
        if (++msgCount > RATE_MAX_MSGS) return;

        let msg;
        try { msg = JSON.parse(raw); } catch { return; }

        switch (msg.type) {
            case 'register': {
                const candidateId = String(msg.userId ?? '').slice(0, MAX_ID_LEN);
                const candidateName = String(msg.name || candidateId).slice(0, MAX_NAME_LEN);
                if (!candidateId) return;
                if (!(await verifyOwnership(candidateId, msg.token))) {
                    send({ type: 'register-failed', reason: 'Unauthorized' });
                    return;
                }
                if (userId) peers.delete(userId);
                userId = candidateId;
                userName = candidateName;
                peers.set(userId, { ws, name: candidateName });
                send({ type: 'registered', userId });
                break;
            }
            case 'call-request':
                if (!userId) return;
                if (!relay(msg.to, msg)) send({ type: 'call-failed', reason: 'User not available' });
                break;
            case 'call-accepted':
            case 'call-declined':
            case 'call-ended':
            case 'offer':
            case 'answer':
            case 'ice':
                if (!userId) return;
                relay(msg.to, msg);
                break;
        }
    });

    // Only remove the map entry if it still points at *this* socket — a user
    // reconnecting (e.g. a second tab) overwrites the entry with the new
    // socket, and the old socket's close/error must not evict it.
    const unregister = () => { if (userId && peers.get(userId)?.ws === ws) peers.delete(userId); };
    ws.on('close', unregister);
    ws.on('error', unregister);
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
