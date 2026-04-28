#include "cloud_relay.h"
#include "config.h"
#include "signal_processing.h"
#include "wifi_manager.h"

#include <ArduinoJson.h>
#include <Preferences.h>
#include <PubSubClient.h>
#include <WiFiClientSecure.h>

namespace {
  WiFiClientSecure tlsClient;
  PubSubClient mqtt(tlsClient);
  MpCloudRelay::LabelChangeHandler labelChangeHandler = nullptr;

  struct Latched {
    float l1, l2, r1, r2;
    bool monitoring;
  };

  Latched latched = { 0, 0, 0, 0, false };
  char chLabels[4][MP_LABEL_MAX_LEN] = {
    MP_DEFAULT_LABEL0,
    MP_DEFAULT_LABEL1,
    MP_DEFAULT_LABEL2,
    MP_DEFAULT_LABEL3,
  };

  uint32_t lastPublishMs = 0;
  uint32_t lastConnectAttemptMs = 0;
  uint32_t frameSeq = 0;
  bool configured = false;

  String telemetryTopic() {
    return String("myopack:") + MP_ABLY_DEVICE_ID + ":telemetry";
  }

  String controlTopic() {
    return String("myopack:") + MP_ABLY_DEVICE_ID + ":control";
  }

  void persistLabel(uint8_t ch, const char* name) {
    const char* keys[4] = {
      MP_NVS_KEY_LABEL0, MP_NVS_KEY_LABEL1,
      MP_NVS_KEY_LABEL2, MP_NVS_KEY_LABEL3
    };
    Preferences prefs;
    prefs.begin("myopack", false);
    prefs.putString(keys[ch], name);
    prefs.end();
  }

  void applyLabelCommand(uint8_t ch, const char* name) {
    if (ch >= 4 || !name) return;
    strncpy(chLabels[ch], name, MP_LABEL_MAX_LEN - 1);
    chLabels[ch][MP_LABEL_MAX_LEN - 1] = '\0';
    persistLabel(ch, chLabels[ch]);
    Serial.printf("[Ably] label ch%u -> \"%s\"\n", ch, chLabels[ch]);

    if (labelChangeHandler) {
      labelChangeHandler(ch, chLabels[ch]);
    }
  }

  void onMessage(char* topic, byte* payload, unsigned int length) {
    if (String(topic) != controlTopic()) return;

    JsonDocument cmd;
    DeserializationError err = deserializeJson(cmd, payload, length);
    if (err) {
      Serial.printf("[Ably] control JSON ignored: %s\n", err.c_str());
      return;
    }

    const char* action = cmd["cmd"];
    if (!action || strcmp(action, "label") != 0) return;

    int ch = cmd["ch"] | -1;
    const char* name = cmd["name"];
    if (ch >= 0 && ch < 4 && name) {
      applyLabelCommand((uint8_t)ch, name);
    }
  }

  bool hasCredentials() {
    return strlen(MP_ABLY_KEY_NAME) > 0 && strlen(MP_ABLY_KEY_SECRET) > 0;
  }

  void configureTls() {
    if (strlen(MP_ABLY_ROOT_CA) > 0) {
      tlsClient.setCACert(MP_ABLY_ROOT_CA);
      Serial.println("[Ably] TLS root CA configured");
    } else if (MP_ABLY_ALLOW_INSECURE_TLS) {
      tlsClient.setInsecure();
      Serial.println("[Ably] WARNING: TLS encryption enabled without certificate verification");
    } else {
      Serial.println("[Ably] missing MP_ABLY_ROOT_CA; relay disabled until trusted TLS is configured");
      configured = false;
      return;
    }

    mqtt.setServer(MP_ABLY_HOST, MP_ABLY_PORT);
    mqtt.setCallback(onMessage);
    mqtt.setKeepAlive(MP_ABLY_KEEPALIVE_SEC);
    mqtt.setBufferSize(768);
    configured = true;
  }

  void connectIfNeeded() {
    if (!configured || mqtt.connected()) return;
    if (!MpWiFi::isConnected()) return;

    const uint32_t now = millis();
    if (now - lastConnectAttemptMs < 5000) return;
    lastConnectAttemptMs = now;

    String clientId = String("myopack-esp32-") + MP_ABLY_DEVICE_ID;
    Serial.printf("[Ably] connecting to mqtts://%s:%u as %s\n",
                  MP_ABLY_HOST, MP_ABLY_PORT, clientId.c_str());

    if (!mqtt.connect(clientId.c_str(), MP_ABLY_KEY_NAME, MP_ABLY_KEY_SECRET)) {
      Serial.printf("[Ably] connect failed, mqtt state=%d\n", mqtt.state());
      return;
    }

    String control = controlTopic();
    mqtt.subscribe(control.c_str(), 0);
    Serial.printf("[Ably] connected; pub %s, sub %s\n",
                  telemetryTopic().c_str(), control.c_str());
  }

  void publishTelemetry() {
    if (!configured || !mqtt.connected()) return;

    const uint32_t period = 1000UL / MP_WS_STREAM_HZ;
    const uint32_t now = millis();
    if (now - lastPublishMs < period) return;
    lastPublishMs = now;

    BalanceResult b = computeBalance(latched.l1, latched.l2, latched.r1, latched.r2);

    JsonDocument doc;
    doc["t"] = now;
    doc["seq"] = frameSeq++;
    doc["streamHz"] = MP_WS_STREAM_HZ;
    doc["sampleHz"] = MP_SAMPLE_RATE_HZ;

    JsonArray ch = doc["ch"].to<JsonArray>();
    ch.add(latched.l1);
    ch.add(latched.l2);
    ch.add(latched.r1);
    ch.add(latched.r2);

    JsonArray labs = doc["labels"].to<JsonArray>();
    for (int i = 0; i < 4; ++i) labs.add(chLabels[i]);

    doc["bal"] = b.balance;
    doc["qsym"] = b.quadSym;
    doc["hsym"] = b.hamSym;
    doc["state"] = latched.monitoring ? "monitoring" : "idle";

    char buf[512];
    size_t n = serializeJson(doc, buf);
    String topic = telemetryTopic();
    if (!mqtt.publish(topic.c_str(), reinterpret_cast<const uint8_t*>(buf), n, false)) {
      Serial.println("[Ably] telemetry publish failed");
    }
  }
}

namespace MpCloudRelay {

void begin() {
#if MP_ABLY_ENABLED
  if (!hasCredentials()) {
    Serial.println("[Ably] MP_ABLY_ENABLED=1 but key name/secret are empty");
    return;
  }
  configureTls();
#else
  Serial.println("[Ably] cloud relay disabled (MP_ABLY_ENABLED=0)");
#endif
}

void loop() {
#if MP_ABLY_ENABLED
  connectIfNeeded();
  mqtt.loop();
  publishTelemetry();
#endif
}

void update(float l1, float l2, float r1, float r2, bool monitoring) {
  latched.l1 = l1;
  latched.l2 = l2;
  latched.r1 = r1;
  latched.r2 = r2;
  latched.monitoring = monitoring;
}

void setLabel(uint8_t ch, const char* name) {
  if (ch >= 4 || !name) return;
  strncpy(chLabels[ch], name, MP_LABEL_MAX_LEN - 1);
  chLabels[ch][MP_LABEL_MAX_LEN - 1] = '\0';
}

void setLabelChangeHandler(LabelChangeHandler handler) {
  labelChangeHandler = handler;
}

bool isConnected() {
#if MP_ABLY_ENABLED
  return mqtt.connected();
#else
  return false;
#endif
}

} // namespace MpCloudRelay
