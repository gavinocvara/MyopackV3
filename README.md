# MyoPack v3

Wearable EMG biofeedback system. 4-channel muscle activation monitoring for
physical therapy and rehabilitation — targeting bilateral symmetry as the
primary clinical insight.

**This repo contains:**
- `firmware/` — ESP32 firmware (PlatformIO, Arduino framework)
- `app/`, `components/`, `lib/` — Next.js 14 companion app
- `ARCHITECTURE.md` — system design + Vercel constraints
- `TESTING.md` — staged validation procedure
- `DISCLAIMER.md` — safety + security posture

## Quick start

**App:**
```bash
npm install
npm run dev            # http://localhost:3000
```

**Firmware:**
```bash
cd firmware
pio run -t upload      # flash ESP32
pio device monitor     # 115200 baud
# then on serial:
wifi-set <ssid> <password>
```

**Connect them locally:**
1. Serial monitor prints the device IP after it joins WiFi.
2. In the app, tap the status pill (top right) → enter IP → Connect.
3. Start a session on Monitor.

**Connect through Vercel:**
1. Set `ABLY_API_KEY` in Vercel and optionally `NEXT_PUBLIC_MYOPACK_DEVICE_ID`.
2. Flash firmware with `firmware/src/secrets.h` based on `firmware/src/secrets.example.h`.
3. In the app, choose Cloud Relay. The trusted path is Ably WSS/MQTT TLS, not a private ESP32 IP.

## Features

- **Three data sources:** simulated, live LAN WebSocket, or Ably cloud relay
- **4 EMG channels:** L/R quadriceps, L/R hamstrings
- **Bilateral symmetry scoring:** the clinical differentiator — shows
  activation imbalance that standard PT misses
- **Three pages:** Monitor (today), Signal (channel detail), Recovery (trends)
- **Premium UI:** dark surfaces, typographic hero metrics, Framer Motion
  transitions, `prefers-reduced-motion` support
- **Offline-capable demo:** works on a phone hotspot with zero internet

## Deploy

The app is a stock Next.js 14 project. For simulation and local LAN demos no
env vars are required. For Vercel-hosted live sync, set `ABLY_API_KEY` as a
server-only variable and `NEXT_PUBLIC_MYOPACK_DEVICE_ID` if the device ID is
not `demo-01`.

## Hardware reference

- MCU: ESP32-WROOM-32E-N8
- AFE: 2× TI ADS1292IRSMT (24-bit, 2-ch each, shared SPI bus)
- Battery: MakerHawk 3000mAh 1S LiPo
- Charging: TP4056
- Regulators: AP2112K (1.8V + 3.3V rails)
- USB: Type-C via CP2102N UART bridge

See `firmware/README.md` for the full pin map.

## License

Capstone project — for academic review and demonstration. See `DISCLAIMER.md`.
