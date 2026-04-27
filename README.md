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

**Connect them:**
1. Serial monitor prints the device IP after it joins WiFi.
2. In the app, tap the status pill (top right) → enter IP → Connect.
3. Start a session on Monitor.

## Features

- **Dual data source:** simulated (in-browser) or live device (WebSocket)
- **4 EMG channels:** L/R quadriceps, L/R hamstrings
- **Bilateral symmetry scoring:** the clinical differentiator — shows
  activation imbalance that standard PT misses
- **Three pages:** Monitor (today), Signal (channel detail), Recovery (trends)
- **Premium UI:** dark surfaces, typographic hero metrics, Framer Motion
  transitions, `prefers-reduced-motion` support
- **Offline-capable demo:** works on a phone hotspot with zero internet

## Deploy

The app is a stock Next.js 14 project — push to GitHub, import to Vercel,
done. No env vars needed for Phase 1.

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
