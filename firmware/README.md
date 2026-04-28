# MyoPack ESP32 Firmware

Production firmware for the dual-ADS1292 EMG pipeline on the MyoPack PCB.
Streams 4-channel muscle activation to the Next.js companion app over
WebSocket at 20 Hz. For Vercel-hosted phone demos, it can also publish the
same normalized telemetry through Ably MQTT over TLS.

## Flash

Install [PlatformIO](https://platformio.org) (as a VSCode extension is easiest),
open the `firmware/` folder, then:

```bash
pio run -t upload
pio device monitor
```

Or from the PlatformIO sidebar: **Upload** → **Monitor** on the `esp32dev` env.

## Cloud relay for Vercel

Direct `ws://` links work only for local HTTP demos. A Vercel deployment is
HTTPS, so phones need the cloud relay path:

1. Create an Ably app and a device-scoped key.
2. Copy `src/secrets.example.h` to `src/secrets.h`.
3. Set `MP_ABLY_ENABLED`, `MP_ABLY_DEVICE_ID`, `MP_ABLY_KEY_NAME`,
   `MP_ABLY_KEY_SECRET`, and `MP_ABLY_ROOT_CA`.
4. Flash the ESP32, then connect the web app through Cloud Relay.

The firmware publishes to `myopack:<device-id>:telemetry` and subscribes to
`myopack:<device-id>:control` using `main.mqtt.ably.net:8883`.

## First-boot provisioning

Open the serial monitor (115200 baud) and enter your WiFi credentials once —
they persist in NVS across reboots:

```
wifi-set MyHomeWiFi mypassword
```

The monitor will print the device IP:

```
[WiFi] connected — IP 192.168.1.42  RSSI -52 dBm
[mDNS] advertising as myopack.local (ws :81)
READY
  connect app to: ws://192.168.1.42:81
              or: ws://myopack.local:81
```

## Pin map

| Signal | ESP32 GPIO | Notes |
|--------|-----------|-------|
| SCLK | 18 | VSPI |
| MOSI (→ DIN) | 23 | VSPI |
| MISO (← DOUT) | 19 | VSPI |
| CS# LEFT/U1 | 21 | ADS1292 left-side chip |
| CS# RIGHT/U4 | 22 | ADS1292 right-side chip |
| DRDY# U1 | 4 | left chip data-ready |
| DRDY# U4 | 16 | right chip data-ready |
| PWDN#/RESET# | — | pulled high via R3 / R9 10 kΩ to 3V3 |

Change any of these in `src/config.h` — nothing in the driver hardcodes GPIOs.

## Serial commands

| Command | Action |
|---------|--------|
| `wifi-set <ssid> <pw>` | store + connect |
| `wifi-status` or `ip` | print SSID, IP, RSSI |
| `wifi-clear` | erase stored creds |
| `sim-on` / `sim-off` | force synthesized data (no electrodes needed) |
| `stats` | print sample rate, channel %s, client count |
| `reboot` | soft-reset |

## Telemetry frame

Every 50 ms the ESP32 broadcasts this JSON to all connected WebSocket
clients:

```json
{
  "t": 1234567,
  "seq": 42,
  "streamHz": 20,
  "sampleHz": 500,
  "ch": [67.3, 61.2, 83.1, 79.4],
  "labels": ["Left Bicep", "Left Bicep B", "Right Bicep", "Right Bicep B"],
  "bal": 84.6, "qsym": 96.0, "hsym": 93.0,
  "state": "monitoring"
}
```

On connect, the device also sends a one-shot hello:

```json
{ "hello": "myopack", "version": "1.0.0", "rate": 20, "sampleHz": 500 }
```

## Signal pipeline

Per channel, every raw 24-bit ADS1292 sample goes through:

1. 4th-order Butterworth bandpass 20–150 Hz (two cascaded biquads)
2. 2nd-order IIR notch at 60 Hz (Q=30)
3. Full-wave rectify
4. Rolling RMS over a 50 ms window (25 samples @ 500 SPS)
5. Normalize to 0–100 % against `MP_FULL_SCALE_COUNTS` (tune on bench)

Filter coefficients in `signal_processing.cpp` are pre-computed for
`fs=500 Hz`. If you change the sample rate, regenerate with scipy —
a one-liner is in the file header.

## Troubleshooting

**`ID mismatch (got 0x00)`** — SPI wiring. Check CS, SCK, MISO, MOSI against
the pin map. If both chips fail, check that AVDD (1.8V) and DVDD (3.3V) rails
are present on the ADS pins.

**`connect timeout`** — bad SSID/password or 5 GHz-only network. ESP32-WROOM-32
is 2.4 GHz only.

**Garbage data** — run `sim-on` to confirm the streaming path works with
synthetic data, then diff against the real electrodes to isolate whether the
issue is in the signal chain or the transport.
