# Canvas Messenger — Signaling Server

> **🔗 Part of Canvas Messenger:** [canvas-messenger](https://github.com/Hackatoan/canvas-messenger) (extension) · [cm-relay](https://github.com/Hackatoan/cm-relay) (REST API) · [cm-signaling](https://github.com/Hackatoan/cm-signaling) (WebRTC signaling)

The WebRTC signaling backend for [Canvas Messenger](https://github.com/Hackatoan/canvas-messenger), a Discord-style messaging layer for Canvas LMS.

☕ **Support:** [Buy Me a Coffee](https://buymeacoffee.com/hackatoa)

## Overview

`cm-signaling` brokers WebRTC peer connections over Socket.IO so Canvas Messenger clients can establish direct, low-latency channels. It pairs with [`cm-relay`](https://github.com/Hackatoan/cm-relay) (REST API) and the [`canvas-messenger`](https://github.com/Hackatoan/canvas-messenger) browser extension.

## Features

- Socket.IO-based WebRTC signaling (offer/answer/ICE exchange)
- Lightweight and stateless
- Container-friendly

## Tech Stack

Node.js · Socket.IO · Docker

## Development

```bash
npm install
npm start   # listens on :3000
```

## Configuration

- `PORT` — listen port (default `3000`).
- `RELAY_URL` — base URL of the paired [`cm-relay`](https://github.com/Hackatoan/cm-relay) instance (e.g. `https://relay.hackatoa.com`). When set, `register` requests are verified against relay's `GET /api/me` (bearer token) before a client is allowed to claim a `userId`. **Requires** a `/api/me` endpoint on cm-relay and the `canvas-messenger` client to send its relay `authToken` on register — do not set this in production until both are in place. Left unset, `register` behaves as before this option was added (no identity verification).

## Deployment

Docker image `ghcr.io/hackatoan/cm-signaling:latest` built by GitHub Actions; runs on the homelab behind NPMplus at `signaling.hackatoa.com`.

## Support

If this project is useful to you, consider supporting development:

☕ **[Buy Me a Coffee](https://buymeacoffee.com/hackatoa)**

---

Part of the **[Hackatoa](https://hackatoa.com)** ecosystem — self-hosted apps, browser games, and bots. · [All repositories »](https://github.com/Hackatoan)

