# MyoPack Cloud Relay Setup

Use this checklist to connect the ESP32 board to the live Vercel app through
Ably. This is the path for the deployed HTTPS app.

```text
ESP32 -> Ably MQTT/TLS -> Vercel app via Ably Realtime WSS
```

## 1. Vercel environment variables

In the Vercel project, set both variables for Production and Preview:

```text
ABLY_API_KEY=<full Ably API key, including the colon>
NEXT_PUBLIC_MYOPACK_DEVICE_ID=demo-01
```

Then redeploy the Vercel project. Environment variable changes do not apply to
already-built deployments.

## 2. Firmware secrets

Open:

```text
firmware/src/secrets.h
```

Set:

```cpp
#define MP_ABLY_DEVICE_ID "demo-01"
#define MP_ABLY_KEY_NAME "part.before.colon"
#define MP_ABLY_KEY_SECRET "part_after_colon"
```

If your full Ably key is:

```text
abc123.def456:someLongSecretValue
```

then firmware should use:

```cpp
#define MP_ABLY_KEY_NAME "abc123.def456"
#define MP_ABLY_KEY_SECRET "someLongSecretValue"
```

For first bench bring-up, the local `secrets.h` currently uses:

```cpp
#define MP_ABLY_ALLOW_INSECURE_TLS 1
#define MP_ABLY_ROOT_CA ""
```

That is okay for quick testing with your own board, but before a trusted public
demo set `MP_ABLY_ALLOW_INSECURE_TLS` to `0` and paste the root CA that
validates `main.mqtt.ably.net` into `MP_ABLY_ROOT_CA`.

## 3. Flash the ESP32

From the repo:

```bash
cd firmware
pio run -t upload
pio device monitor
```

If WiFi is not configured yet, use the serial monitor:

```text
wifi-set YourWiFiName YourWiFiPassword
```

The ESP32 needs internet access for Cloud Relay because it connects outbound to:

```text
main.mqtt.ably.net:8883
```

## 4. Connect in the live app

Open the deployed Vercel app.

1. Tap the device status control.
2. Choose `Cloud Relay`.
3. Enter `demo-01`.
4. Click `Connect Cloud Relay`.
5. Open `/vitals`.

Expected result:

```text
Source: RELAY
Input rate: around 20 Hz
Dropped frames: low/zero
Parser errors: 0
```

## 5. If it does not connect

Check the ESP32 serial monitor first.

Useful signs:

```text
[Ably] connected
[Ably] telemetry publish failed
[Ably] connect failed, mqtt state=<number>
[Ably] MP_ABLY_ENABLED=1 but key name/secret are empty
```

Also check the Vercel app:

- If Cloud Relay says token/API error, verify `ABLY_API_KEY` is set in Vercel
  and redeployed.
- If the app connects but shows no data, verify the ESP32 serial monitor says
  Ably connected and that the firmware device ID matches the app device ID.
- If left/right values are flipped during live testing, change
  `SWAP_PHYSICAL_SIDES` in `lib/muscle-selection.ts`, then rerun left-only and
  right-only validation.
