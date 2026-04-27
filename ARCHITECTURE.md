# MyoPack Architecture

**Phase 1 — Local demo (this release)**
**Phase 2 — Remote viewing via Supabase Realtime (scaffolded, not required for capstone)**

---

## Phase 1: Device-hosted WebSocket

```
┌─────────────┐     ws://<ip>:81        ┌─────────────────┐
│   ESP32     │────── JSON frames ─────▶│  Next.js app    │
│  (WS svr)   │        @ 20 Hz          │  (browser)      │
└─────────────┘                          └─────────────────┘
        ▲                                         │
        │                                         │
   electrodes                                local WiFi
   + ADS1292 × 2                            (phone hotspot
                                             works great)
```

**Why this wins for the capstone demo:**

- **Zero backend.** No server to deploy, no account to create, no paid tier.
- **Zero internet dependency.** A phone hotspot + the ESP32 + the laptop running
  the app is a fully self-contained demo environment. This is the safest setup
  for a presentation room where you don't control the network.
- **Sub-50 ms end-to-end latency.** ADS1292 → filter → WebSocket → React →
  screen, no round-trip to the cloud.
- **Simple mental model.** One WebSocket. One data format. One place to debug.
- **The app still deploys to Vercel.** It just connects to an IP on the local
  network. Vercel's WebSocket limitation doesn't apply because we're not running
  a WebSocket server on Vercel — the ESP32 is the server, the browser is the
  client.

**Trade-off:** only reachable on the same LAN as the ESP32. That's fine for
the demo. See Phase 2 for remote access.

---

## Phase 2: Supabase Realtime relay (optional, for remote)

When you need to show the dashboard to someone who isn't physically on your
network (advisor, remote committee member), flip the firmware to also post
frames to Supabase Realtime, and the app subscribes via the Supabase JS
client. No WebSocket on Vercel required — Supabase handles the persistent
transport; Vercel only serves the frontend.

```
ESP32 ──HTTP POST──▶ Supabase Edge Function ──▶ Realtime channel
                                                      │
                                           ┌──────────┴────────┐
                                           ▼                   ▼
                                  browser on home wifi     browser in office
```

This is scaffolded in `lib/device/types.ts` (the frame format is identical)
but not wired up. Turning it on is a ~2-hour task: add a Supabase client in
`lib/device/supabase.ts`, add a second "relay" code path in the firmware's
`telemetry_server.cpp`, point the app at Supabase when `dataSource === 'device'`
and the device isn't reachable on the LAN.

---

## Vercel constraints (why we designed around them)

Vercel's serverless functions are optimized for short-lived HTTP request/response
cycles and do not natively support long-lived WebSocket server connections.
Workarounds exist (third-party realtime providers, streaming SSE), but the
cleanest architecture for a device-driven app is:

1. **Vercel = frontend hosting only** — static/SSR React, zero persistent sockets.
2. **Realtime transport = anywhere else** — in Phase 1, the ESP32 itself. In
   Phase 2, a managed realtime provider (Supabase, Ably, Pusher, etc.).

Our frontend is already Vercel-compatible — it's a stock Next.js 14 app. The
`vercel.json` at the repo root pins the framework and build command. Nothing
in the codebase tries to open a WebSocket *server* inside an API route.

---

## Data flow (end-to-end)

1. 4 electrodes pick up muscle action potentials (µV range)
2. ADS1292 PGA × 6 + 24-bit Σ-Δ ADC @ 500 SPS
3. ESP32 reads via SPI on DRDY# interrupts
4. Per-channel signal pipeline: bandpass 20–150 Hz → 60 Hz notch → rectify
   → 50 ms RMS window → normalize 0–100 %
5. Every 50 ms: 4-channel JSON frame broadcast to WS clients
6. React context receives frame → updates `emgData` state
7. Today / Signal / Recovery pages re-render with live values

The data source can be switched at runtime between `simulated` (in-browser
Math.random walk, for demo-without-hardware) and `device` (WebSocket). The
session timer and the "monitoring" concept are independent of the source —
the device always streams while powered; the app decides whether to treat the
current moment as an active session.

---

## Files touched by this design

| Layer | File | Role |
|-------|------|------|
| Firmware | `firmware/src/main.cpp` | Loop + orchestration |
| Firmware | `firmware/src/ads1292.cpp` | SPI driver, register config, RDATAC |
| Firmware | `firmware/src/signal_processing.cpp` | Biquad filters, RMS |
| Firmware | `firmware/src/wifi_manager.cpp` | NVS creds, mDNS |
| Firmware | `firmware/src/telemetry_server.cpp` | WebSocket server |
| Shared | `lib/device/types.ts` | JSON frame type definition |
| Frontend | `lib/device/websocket.ts` | Client with auto-reconnect |
| Frontend | `lib/emg/context.tsx` | Dual-mode state + timer management |
| Frontend | `components/device/device-connect.tsx` | IP entry modal |
| Frontend | `components/device/device-status.tsx` | Status pill |
