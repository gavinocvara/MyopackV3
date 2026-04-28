# MyoPack v3

MyoPack is a wearable EMG biofeedback and recovery-monitoring system. It pairs
ESP32 firmware for a dual-ADS1292, 4-channel EMG board with a Next.js 14
companion app for live activation, bilateral symmetry, electrode readiness, and
local recovery trends.

MyoPack is health-adjacent but non-diagnostic. Its goal is to help visualize
minor contraction imbalance and session-to-session recovery patterns, not to
provide medical diagnosis or treatment guidance.

## Repository layout

- `app/`, `components/`, `lib/` - Next.js 14 App Router companion app
- `firmware/` - ESP32 firmware built with PlatformIO and Arduino
- `scripts/` - local validation, dev-server cleanup, and relay smoke helpers
- `ARCHITECTURE.md` - system design, telemetry flow, and deployment paths
- `TESTING.md` - staged app, signal, and hardware validation procedure
- `DISCLAIMER.md` - safety, privacy, and prototype posture
- `MYOPACK_MEMORY.md` - running handoff notes from prior implementation sessions

## Quick start

Install app dependencies and start the local Next.js app:

```bash
npm install
npm run dev
```

Open `http://localhost:3000/today`.

Useful local scripts:

```bash
npm run dev:stop   # stop stale Next/Node listeners on common dev ports
npm run dev:clean  # stop listeners, clear .next, and start dev
npm run test:emg   # offline EMG parser/routing/lifecycle validation
npm run test:relay # Ably smoke publish when ABLY_API_KEY is available
```

Build and lint:

```bash
npm run lint
npm run build
```

## Firmware quick start

Install PlatformIO, then flash and monitor the ESP32:

```bash
cd firmware
pio run -t upload
pio device monitor
```

Provision WiFi once from the serial monitor:

```text
wifi-set <ssid> <password>
```

The serial monitor prints the local IP and `myopack.local` target once the
device joins WiFi.

## App data sources

MyoPack can run from three sources:

- `simulated` - in-browser synthetic EMG for demos without hardware
- `device` - direct LAN WebSocket from the ESP32 at `ws://<device-ip>:81`
- `relay` - Ably cloud relay for Vercel-hosted HTTPS phone demos

The app opens to `/today`; `/vitals` shows deeper signal instrumentation and
diagnostics; `/health` shows local saved-session recovery trends.

## Local LAN connection

Use Local LAN when the app is served over local HTTP, such as
`http://localhost:3000`, and the browser is on the same network or hotspot as
the ESP32.

1. Flash firmware and connect the ESP32 to WiFi.
2. Open the app locally.
3. Tap the device status control.
4. Choose Local LAN.
5. Enter the printed IP or `myopack.local`.
6. Run the passive precheck, then start monitoring.

Direct LAN uses plain `ws://` and is intentionally kept for bench testing and
low-latency local demos.

## Vercel hosted connection

Use Cloud Relay for a deployed Vercel app. Mobile browsers block direct
`ws://` ESP32 connections from an HTTPS page, so the trusted hosted path is:

```text
ESP32 -> Ably MQTT over TLS -> Ably Realtime WSS -> Next.js browser app
```

Vercel environment variables:

```text
ABLY_API_KEY=<server-only Ably API key>
NEXT_PUBLIC_MYOPACK_DEVICE_ID=demo-01  # optional; defaults to demo-01
```

Firmware setup:

1. Copy `firmware/src/secrets.example.h` to `firmware/src/secrets.h`.
2. Set `MP_ABLY_ENABLED`, `MP_ABLY_DEVICE_ID`, `MP_ABLY_KEY_NAME`,
   `MP_ABLY_KEY_SECRET`, and `MP_ABLY_ROOT_CA`.
3. Keep `MP_ABLY_ALLOW_INSECURE_TLS` set to `0` for trusted demos.
4. Flash the ESP32 and choose Cloud Relay in the app.

The app requests short-lived Ably token requests from `/api/ably-token`. Browser
tokens can subscribe to `myopack:<device-id>:telemetry` and publish control
commands to `myopack:<device-id>:control`.

## Telemetry model

The firmware emits normalized processed activation, not raw EMG:

```json
{
  "t": 1234567,
  "seq": 42,
  "streamHz": 20,
  "sampleHz": 500,
  "ch": [67.3, 61.2, 83.1, 79.4],
  "labels": ["Left Bicep", "Left Bicep B", "Right Bicep", "Right Bicep B"],
  "bal": 84.6,
  "qsym": 96.0,
  "hsym": 93.0,
  "state": "monitoring"
}
```

Current physical-side mapping:

```text
ch[0] = U1 / CS=21 / left body side / primary
ch[1] = U1 / CS=21 / left body side / secondary
ch[2] = U4 / CS=22 / right body side / primary
ch[3] = U4 / CS=22 / right body side / secondary

pairA = { leftIndex: 0, rightIndex: 2 }
pairB = { leftIndex: 1, rightIndex: 3 }
left candidates = [0, 1]
right candidates = [2, 3]
```

All muscle groups currently default to `pairA`. Muscle selection changes app
labels, placement guidance, interpretation, and firmware label sync; it does
not change which chip is physically left or right.

If live board validation proves the chips are physically reversed, flip
`SWAP_PHYSICAL_SIDES` in `lib/muscle-selection.ts` and then update the firmware
pin-side definitions in `firmware/src/config.h`.

## Product behavior

- `/today` guides muscle selection, placement confirmation, passive electrode
  readiness, monitoring, freeze-on-stop behavior, and completed session saves.
- `/vitals` shows live routed signal, model heat, selected-side context,
  transport diagnostics, graph rate, dropped frames, parser errors, and frame
  age.
- `/health` reads local browser session history and generates rule-based,
  non-diagnostic recovery coaching from saved summaries only.
- Completed sessions are stored in browser `localStorage` under
  `myopack:session_history`.
- There is no backend database and no external recovery-intelligence service in
  this build.

## Hardware reference

- MCU: ESP32-WROOM-32E-N8
- AFE: two TI ADS1292IRSMT chips, 24-bit, 2 channels each, shared SPI bus
- Sample rate: 500 SPS per channel
- Transport rate: 20 Hz processed telemetry
- Battery: MakerHawk 3000 mAh 1S LiPo
- Charging: TP4056
- Regulators: AP2112K for 1.8 V and 3.3 V rails
- USB: Type-C through CP2102N UART bridge

See `firmware/README.md` for pin map, serial commands, firmware relay setup,
and troubleshooting.

## License

Capstone project for academic review and demonstration. See `DISCLAIMER.md`.
