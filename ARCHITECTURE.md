# MyoPack Architecture

MyoPack combines an ESP32 dual-ADS1292 EMG device with a Next.js 14 companion
app. The product is built around signal truth: routed left/right activation,
passive electrode readiness, freeze-on-stop monitoring, local session history,
and restrained, non-diagnostic recovery interpretation.

## System overview

```text
Electrodes
  -> ADS1292 x2 at 500 SPS
  -> ESP32 signal pipeline
  -> 20 Hz normalized JSON telemetry
  -> Next.js app
  -> Today, Vitals, and Health experiences
```

The browser app supports three runtime sources:

```text
Simulation
  Browser-only synthetic EMG

Local LAN
  ESP32 WebSocket server on ws://<device-ip>:81

Cloud Relay
  ESP32 MQTT/TLS publish to Ably
  Browser Ably Realtime WSS subscription
```

## Frontend application

The app is a Next.js 14 App Router project.

- `app/page.tsx` redirects to `/today`.
- `/today` is the guided monitor flow.
- `/vitals` is the signal instrumentation and diagnostics view.
- `/health` is local longitudinal recovery interpretation.
- `app/layout.tsx` composes global providers and the shared shell.
- `components/layout/app-chrome.tsx` owns the app chrome and route scroll reset.

Primary frontend state owners:

- `EMGProvider` in `lib/emg/context.tsx` owns telemetry source, device or relay
  connection state, live EMG values, graph history, precheck samples,
  monitoring state, timers, simulation, diagnostics, and label sync.
- `MuscleSelectionProvider` in `lib/muscle-selection-context.tsx` owns selected
  muscle group, side mode, selected sensor pair, channel route, and placement
  confirmation.

The UI keeps polished user-facing language focused on left, right, bilateral,
selected muscle group, readiness, activation, and recovery trends. Raw channel
or firmware labels are kept diagnostic/internal unless a debug surface needs
them.

## Firmware application

The firmware runs on an ESP32 with two ADS1292 chips on a shared SPI bus.

Primary firmware files:

| File | Role |
| --- | --- |
| `firmware/src/main.cpp` | Main loop, serial commands, device orchestration |
| `firmware/src/config.h` | Pins, timing, labels, relay defaults |
| `firmware/src/ads1292.cpp` | ADS1292 SPI driver and register setup |
| `firmware/src/signal_processing.cpp` | Filters, RMS, normalization, balance |
| `firmware/src/telemetry_server.cpp` | Local WebSocket server on port 81 |
| `firmware/src/cloud_relay.cpp` | Ably MQTT/TLS relay path |
| `firmware/src/wifi_manager.cpp` | WiFi provisioning, NVS credentials, mDNS |

Per channel, raw ADS samples flow through:

1. 4th-order Butterworth bandpass from 20 to 150 Hz
2. 60 Hz notch
3. Full-wave rectification
4. 50 ms rolling RMS
5. Normalization to 0 to 100 percent
6. 20 Hz JSON telemetry publication

The app receives processed activation envelopes, not raw EMG waveforms.

## Physical channel mapping

The current app and firmware agree on this physical-side model:

```text
ch[0] = U1 / CS=21 / left body side / primary
ch[1] = U1 / CS=21 / left body side / secondary
ch[2] = U4 / CS=22 / right body side / primary
ch[3] = U4 / CS=22 / right body side / secondary
```

Derived routing:

```text
pairA = { leftIndex: 0, rightIndex: 2 }
pairB = { leftIndex: 1, rightIndex: 3 }
left readiness candidates = [0, 1]
right readiness candidates = [2, 3]
```

All active muscle groups default to `pairA`. Selecting Quadriceps, Hamstrings,
Biceps, or Shoulders changes placement guidance, labels, local interpretation,
and firmware label sync; it does not change chip-side ownership.

The board-side assumption `CS=21 = left` still needs live electrode validation.
If live testing shows left and right are reversed:

1. Set `SWAP_PHYSICAL_SIDES = true` in `lib/muscle-selection.ts`.
2. Rerun left-only, right-only, and bilateral tests.
3. If confirmed, swap `MP_PIN_CS_LEFT` and `MP_PIN_CS_RIGHT` in
   `firmware/src/config.h` and reflash.

## Telemetry contract

The firmware emits the same frame shape over local WebSocket and Ably relay:

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

The parser in `lib/device/types.ts` normalizes frames, accepts `t` or `ts`,
rejects malformed or non-finite channel values, clamps out-of-range activation
with warnings, and tolerates optional labels and diagnostics fields.

The app computes displayed balance locally from `ch[]` so older firmware with
stale `bal`, `qsym`, or `hsym` fields cannot mislead the UI.

## Local LAN transport

Local LAN is the lowest-latency bench path:

```text
ESP32 WebSocket server
  ws://<device-ip>:81
  -> browser DeviceClient
  -> EMGProvider
```

Benefits:

- no cloud dependency
- no account requirement
- works from a laptop on the same WiFi or phone hotspot
- good for serial-monitor debugging and capstone bench validation

Limit:

- Vercel-hosted HTTPS pages cannot directly open plain `ws://` ESP32 links
  from mobile browsers because that is mixed active content.

## Cloud relay transport

Cloud Relay is the trusted hosted path for Vercel and phones:

```text
ESP32
  -> main.mqtt.ably.net:8883 over MQTT/TLS
  -> myopack:<device-id>:telemetry
  -> browser Ably Realtime WSS subscription
  -> EMGProvider

Browser label commands
  -> /api/ably-token token-scoped Ably client
  -> myopack:<device-id>:control
  -> ESP32 cloud_relay.cpp label handler
  -> NVS label persistence
```

The Next.js API route `app/api/ably-token/route.ts` runs in the Node runtime and
uses server-only `ABLY_API_KEY` to issue short-lived token requests. Browser
tokens are scoped to:

- subscribe: `myopack:<device-id>:telemetry`
- publish: `myopack:<device-id>:control`

The ESP32 relay is disabled unless `MP_ABLY_ENABLED=1` and credentials are
provided in the local, ignored `firmware/src/secrets.h`.

Trusted relay demos should use a real root CA in `MP_ABLY_ROOT_CA` and keep
`MP_ABLY_ALLOW_INSECURE_TLS` disabled.

## Monitoring lifecycle

Monitoring truth is enforced in `EMGProvider`:

- simulation updates live values only during monitoring
- device and relay frames may update labels while idle
- device and relay frames may populate precheck samples while prechecking
- live EMG values and main graph history update only when `isMonitoring` is true
- start clears graph history, resets session time, and starts timers
- stop clears timers and freezes the last displayed values and graph
- passive precheck has an isolated sample buffer and cannot pollute session
  history

This is a core invariant. A polished UI must never imply live intake when the
session is stopped.

## Session history and recovery intelligence

Completed session summaries are stored locally in browser `localStorage` under
`myopack:session_history`.

Saved summaries can include:

- timestamp and certified start time
- selected muscle group
- side mode
- selected sensor pair and channel route
- duration
- activation
- symmetry
- left and right activation
- data source
- input rate, dropped frames, parser errors, and precheck score

`lib/recovery-intelligence.ts` reads saved summaries only. It generates local,
rule-based, non-diagnostic interpretation for trend, imbalance severity,
confidence, likely limited side, corrective focus, next goals, Sync Age, and
near-sync ETA. There is no external AI service or backend recovery database in
this build.

## Deployment

The app deploys as a normal Next.js 14 project.

For simulation and local LAN demos, no environment variables are required.

For hosted live telemetry:

```text
ABLY_API_KEY=<server-only Ably API key>
NEXT_PUBLIC_MYOPACK_DEVICE_ID=demo-01  # optional
```

Vercel serves the frontend and token route. It does not host a WebSocket server.
Persistent realtime transport is handled either by the ESP32 on LAN or by Ably
for hosted demos.

## Validation priorities

Highest-risk validation remains hardware-facing:

1. Confirm `CS=21` is physically the left body side.
2. Confirm left-only activation raises `ch[0]` or `ch[1]` and not right-side
   channels.
3. Confirm right-only activation raises `ch[2]` or `ch[3]` and not left-side
   channels.
4. Confirm bilateral left-harder and right-harder tests display the correct
   side direction.
5. Confirm passive precheck recommends within-side alternates only.
6. Confirm Ably Cloud Relay receives telemetry and returns label commands when
   `ABLY_API_KEY` and firmware secrets are configured.

Software checks currently available:

```bash
npm run test:emg
npm run lint
npm run build
npm run test:relay
```

`npm run test:relay` requires `ABLY_API_KEY`. Firmware compilation requires
PlatformIO in the shell PATH.
