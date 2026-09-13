# Canvas Messenger — Signaling Server

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

## Deployment

Docker image `ghcr.io/hackatoan/cm-signaling:latest` built by GitHub Actions; runs on the homelab behind NPMplus at `signaling.hackatoa.com`.

## Support

If this project is useful to you, consider supporting development:

☕ **[Buy Me a Coffee](https://buymeacoffee.com/hackatoa)**

---

Part of the **[Hackatoa](https://hackatoa.com)** ecosystem — self-hosted apps, browser games, and bots. · [All repositories »](https://github.com/Hackatoan)

