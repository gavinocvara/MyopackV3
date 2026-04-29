// ─────────────────────────────────────────────────────────────
// telemetry_server.h
//   On-device WebSocket server on port MP_WS_PORT. Accepts any
//   number of clients and broadcasts compact JSON frames at
//   MP_WS_STREAM_HZ. No auth for v1 (LAN only).
//
// Telemetry frame (sent every 50 ms):
//   {
//     "t":  <uint32 ms since boot>,
//     "seq": <uint32 frame counter>,
//     "streamHz": 20, "sampleHz": 500,
//     "ch": [67.3, 71.2, 83.1, 79.4],          // [left primary,left alt,right primary,right alt]
//     "labels": ["Left Bicep","Left Bicep B","Right Bicep","Right Bicep B"],
//     "bal": 84.6, "qsym": 96.0, "hsym": 93.0,
//     "state": "monitoring" | "idle"
//   }
//
// Incoming commands from app (WStype_TEXT, JSON):
//   {"cmd":"label","ch":0,"name":"Left Bicep"}
// ─────────────────────────────────────────────────────────────
#pragma once
#include <Arduino.h>
#include "config.h"

namespace MpTelemetry {
  void begin();
  void loop();

  // Feed the current channel % values (0–100) — latched internally
  // and broadcast on next tick.
  void update(float lq, float rq, float lh, float rh, bool monitoring);

  // Set the human-readable label for a channel (0–3).
  // Call after loading from NVS in setup(); call again on serial/WS change.
  void setLabel(uint8_t ch, const char* name);

  using LabelChangeHandler = void (*)(uint8_t ch, const char* name);
  void setLabelChangeHandler(LabelChangeHandler handler);

  // Number of currently connected WebSocket clients.
  uint8_t clientCount();
}
