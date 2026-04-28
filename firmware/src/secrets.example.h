#pragma once

// Copy to firmware/src/secrets.h for local flashing.
// Do not commit the real secrets.h file.

#define MP_ABLY_ENABLED 1
#define MP_ABLY_DEVICE_ID "demo-01"

// Ably MQTT basic auth uses the API key name as username and the key secret
// as password. Use a separate key scoped to this one device.
#define MP_ABLY_KEY_NAME "app.key-name"
#define MP_ABLY_KEY_SECRET "key-secret"

// Preferred: paste the PEM root CA that validates main.mqtt.ably.net.
// Keep MP_ABLY_ALLOW_INSECURE_TLS at 0 for a trusted live demo.
#define MP_ABLY_ROOT_CA \
"-----BEGIN CERTIFICATE-----\n" \
"PASTE_ROOT_CA_CERTIFICATE_HERE\n" \
"-----END CERTIFICATE-----\n"

#define MP_ABLY_ALLOW_INSECURE_TLS 0
