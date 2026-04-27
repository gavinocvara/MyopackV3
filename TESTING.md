# MyoPack Testing Procedure

Staged validation — each stage gates the next. If a stage fails, fix before
proceeding. Total time: ~45 min if everything works, 1–2 h with debugging.

---

## Stage 1 — Serial-only firmware validation (no WiFi, no app)

**Goal:** confirm both ADS1292 chips are talking over SPI and producing real data.

1. Flash firmware:
   ```bash
   cd firmware && pio run -t upload
   pio device monitor
   ```
2. Expected output:
   ```
   === MyoPack firmware v1.0.0 ===
   [SPI] VSPI up: SCLK=18 MISO=19 MOSI=23
   [ADS1292 CS=5] ID = 0x53   (or 0x73)
   [ADS1292 CS=5] initialized OK — 500 SPS, PGA=6
   [ADS1292 CS=17] ID = 0x53
   [ADS1292 CS=17] initialized OK — 500 SPS, PGA=6
   ```
3. Force simulation mode, confirm heartbeat:
   ```
   sim-on
   ```
   You should see `[hb] 20 Hz ...` once streaming starts.

**Fail modes**
- `ID mismatch (got 0x00)` → SPI wiring. Check MISO continuity from each ADS
  DOUT pin to ESP32 GPIO19.
- `ID mismatch (got 0xFF)` → MISO floating or VDD missing on the ADS.
- Only one chip inits → CS pin swapped, or one PWDN pull-up not connected.

---

## Stage 2 — WiFi + WebSocket (no app yet)

1. Provision:
   ```
   wifi-set <ssid> <password>
   ```
2. Expected:
   ```
   [WiFi] connected — IP 192.168.x.y  RSSI -xx dBm
   [mDNS] advertising as myopack.local (ws :81)
   [WS] listening on :81 ...
   ```
3. From your laptop, test with a browser WebSocket console or `wscat`:
   ```bash
   npm install -g wscat
   wscat -c ws://myopack.local:81
   # or:  wscat -c ws://<ip>:81
   ```
4. You should immediately receive:
   ```
   {"hello":"myopack","version":"1.0.0","rate":20}
   ```
   followed by telemetry frames at 20 Hz.

**Fail modes**
- Can't reach `myopack.local` → your network blocks mDNS. Use the IP from
  the serial monitor instead.
- Connection opens but no frames → no clients is the only case where the
  server throttles, and you just connected. Power-cycle and retry.

---

## Stage 3 — App connects to device

1. `npm run dev` (or `pnpm dev` / `yarn dev`).
2. Open `http://localhost:3000`.
3. Tap the status pill in the top-right (should say **SIM**).
4. Enter your device's IP or `myopack.local` → **Connect**.
5. Pill should go **LINKING → LIVE**.
6. On the Monitor page, tap **Begin Session**. Numbers should update at
   ~20 Hz from the device, not the simulation.

**Fail modes**
- Pill stuck on LINKING → browser can't reach the ESP32. Confirm both
  devices on same WiFi. Try plain IP instead of `.local` hostname.
- Pill goes to OFFLINE → device rebooted or dropped WiFi. Check serial.

---

## Stage 4 — Real electrode signal

1. Electrode placement:
   - LQ: rectus femoris belly, mid-thigh, ~3 cm spacing
   - RQ: mirror on the other leg
   - LH: biceps femoris, mid posterior thigh
   - RH: mirror
   - Reference (if used): bony landmark (kneecap or anterior hip)
2. Turn off sim: `sim-off` on serial.
3. Sit relaxed. All 4 channels should read low (<10%).
4. Contract each muscle individually. Only that channel's value should rise.
5. Stand and shift weight left → LQ + LH should rise together; RQ + RH fall.

**Fail modes**
- All channels read same value → one AIN lead floating and picking up the
  other. Check PGA1N/PGA1P vs PGA2N/PGA2P wiring.
- Huge DC offset / saturation → electrodes drying out or wrong site.
- Looks like a 60 Hz sine → notch isn't killing it; confirm `fs=500` and
  notch coefficients.

---

## Stage 5 — Monitoring stop behavior (bug regression check)

1. Start a session on the Monitor page.
2. Watch values update.
3. Stop the session.
4. **Values should freeze at their last read, not keep fluctuating.**

This was explicitly called out in the redesign brief. The new context
separates the session timer from the data-source timer — the sim interval
is cleared on stop, so in sim mode nothing updates. In device mode the
device keeps streaming, but that's expected (it's a live device); if you
want the UI to freeze in device mode too, add an `isMonitoring` check to
the `onTelemetry` handler in `lib/emg/context.tsx`.

---

## Stage 6 — Vercel deploy

1. Commit, push, connect repo to Vercel.
2. Framework auto-detect picks up Next.js 14.
3. No env vars needed for Phase 1 (app connects directly to LAN device IP).
4. Remote users won't see device data unless they're on the same LAN —
   that's Phase 2's problem.
