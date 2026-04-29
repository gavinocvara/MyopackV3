// ─────────────────────────────────────────────────────────────
// telemetry_server.cpp
// ─────────────────────────────────────────────────────────────
#include "telemetry_server.h"
#include "signal_processing.h"
#include "config.h"

#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include <Preferences.h>

namespace {
  WebSocketsServer ws(MP_WS_PORT);
  uint8_t          clients = 0;
  MpTelemetry::LabelChangeHandler labelChangeHandler = nullptr;

  struct Latched {
    float lq, rq, lh, rh;
    bool  monitoring;
    const char* source;
  };
  Latched latched = { 0, 0, 0, 0, false, "ads" };

  // Channel labels — updated via setLabel(), persisted in NVS by caller
  char chLabels[4][MP_LABEL_MAX_LEN] = {
    MP_DEFAULT_LABEL0,
    MP_DEFAULT_LABEL1,
    MP_DEFAULT_LABEL2,
    MP_DEFAULT_LABEL3,
  };

  uint32_t lastBroadcastMs = 0;
  uint32_t frameSeq = 0;

  // Forward-declare so onEvent can call it
  void applyLabelCommand(uint8_t ch, const char* name);

  void onEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t length) {
    switch (type) {
      case WStype_CONNECTED: {
        IPAddress ip = ws.remoteIP(num);
        ++clients;
        Serial.printf("[WS] client %u connected from %s  (%u total)\n",
                      num, ip.toString().c_str(), clients);
        // Send hello with current config + labels
        JsonDocument hello;
        hello["hello"]   = "myopack";
        hello["version"] = MP_FIRMWARE_VERSION;
        hello["rate"]    = MP_WS_STREAM_HZ;
        hello["sampleHz"] = MP_SAMPLE_RATE_HZ;
        JsonArray labs = hello["labels"].to<JsonArray>();
        for (int i = 0; i < 4; ++i) labs.add(chLabels[i]);
        char buf[256];
        size_t n = serializeJson(hello, buf);
        ws.sendTXT(num, buf, n);
        break;
      }
      case WStype_DISCONNECTED:
        if (clients > 0) --clients;
        Serial.printf("[WS] client %u disconnected  (%u total)\n", num, clients);
        break;

      case WStype_TEXT: {
        // Incoming command from app: {"cmd":"label","ch":N,"name":"..."}
        JsonDocument cmd;
        DeserializationError err = deserializeJson(cmd, payload, length);
        if (err) break;
        const char* c = cmd["cmd"];
        if (!c) break;
        if (strcmp(c, "label") == 0) {
          int ch = cmd["ch"] | -1;
          const char* name = cmd["name"];
          if (ch >= 0 && ch < 4 && name) {
            applyLabelCommand((uint8_t)ch, name);
          }
        }
        break;
      }

      default: break;
    }
  }

  void applyLabelCommand(uint8_t ch, const char* name) {
    strncpy(chLabels[ch], name, MP_LABEL_MAX_LEN - 1);
    chLabels[ch][MP_LABEL_MAX_LEN - 1] = '\0';
    Serial.printf("[label] ch%u → \"%s\"\n", ch, chLabels[ch]);

    // Persist to NVS
    const char* keys[4] = {
      MP_NVS_KEY_LABEL0, MP_NVS_KEY_LABEL1,
      MP_NVS_KEY_LABEL2, MP_NVS_KEY_LABEL3
    };
    Preferences prefs;
    prefs.begin("myopack", false);
    prefs.putString(keys[ch], chLabels[ch]);
    prefs.end();

    if (labelChangeHandler) {
      labelChangeHandler(ch, chLabels[ch]);
    }
  }
}

namespace MpTelemetry {

void begin() {
  ws.begin();
  ws.onEvent(onEvent);
  Serial.printf("[WS] listening on :%u (path /, %u Hz)\n",
                MP_WS_PORT, MP_WS_STREAM_HZ);
}

void setLabel(uint8_t ch, const char* name) {
  if (ch >= 4 || !name) return;
  strncpy(chLabels[ch], name, MP_LABEL_MAX_LEN - 1);
  chLabels[ch][MP_LABEL_MAX_LEN - 1] = '\0';
}

void setLabelChangeHandler(LabelChangeHandler handler) {
  labelChangeHandler = handler;
}

void update(float lq, float rq, float lh, float rh, bool monitoring, const char* source) {
  latched.lq = lq;
  latched.rq = rq;
  latched.lh = lh;
  latched.rh = rh;
  latched.monitoring = monitoring;
  latched.source = source ? source : "ads";
}

uint8_t clientCount() { return clients; }

void loop() {
  ws.loop();

  const uint32_t period = 1000UL / MP_WS_STREAM_HZ;
  uint32_t now = millis();
  if (now - lastBroadcastMs < period) return;
  lastBroadcastMs = now;

  if (clients == 0) return;

  BalanceResult b = computeBalance(latched.lq, latched.rq, latched.lh, latched.rh);

  JsonDocument doc;
  doc["t"]   = now;
  doc["seq"] = frameSeq++;
  doc["streamHz"] = MP_WS_STREAM_HZ;
  doc["sampleHz"] = MP_SAMPLE_RATE_HZ;
  // Channel values as array — aligns with labels[] index order
  JsonArray ch = doc["ch"].to<JsonArray>();
  ch.add(latched.lq);
  ch.add(latched.rq);
  ch.add(latched.lh);
  ch.add(latched.rh);
  // Labels so the app always knows which muscle each index is
  JsonArray labs = doc["labels"].to<JsonArray>();
  for (int i = 0; i < 4; ++i) labs.add(chLabels[i]);

  doc["bal"]   = b.balance;
  doc["qsym"]  = b.quadSym;
  doc["hsym"]  = b.hamSym;
  doc["source"] = latched.source;
  doc["state"] = latched.monitoring ? "monitoring" : "idle";

  char buf[512];
  size_t n = serializeJson(doc, buf);
  ws.broadcastTXT(buf, n);
}

} // namespace
