// ─────────────────────────────────────────────────────────────
// main.cpp — MyoPack ESP32 entry
//
// Boot sequence:
//   1. Serial @ 115200
//   2. SPI bus (VSPI) init
//   3. Init ADS1292 left/U1 (CS=GPIO21, DRDY=GPIO4)
//   4. Init ADS1292 right/U4 (CS=GPIO22, DRDY=GPIO16)
//   5. Load channel labels from NVS
//   6. WiFi connect (from NVS or default)
//   7. WebSocket server on :81
//
// Runtime loop:
//   - Poll both DRDY lines; on fall, read 2 samples/chip
//   - Push each sample through per-channel filter + RMS pipeline
//   - Every 50 ms: broadcast latest 4-channel % + labels to WS clients
//
// Serial console commands:
//   wifi-set <ssid> <password>   store + connect
//   wifi-status | ip             show connection state
//   wifi-clear                   erase stored creds
//   sim-on  | sim-off            force simulated data stream
//   label <0-3> <name>           set channel label (e.g. label 0 Left Bicep)
//   preset legs | arms           apply built-in muscle group presets
//   raw-log                      toggle raw ADC count printing (diagnosis)
//   stats                        print sample rate + channel values + labels
//   reboot                       soft-reset the ESP32
// ─────────────────────────────────────────────────────────────
#include <Arduino.h>
#include <SPI.h>
#include <Preferences.h>
#include <string.h>

#include "config.h"
#include "ads1292.h"
#include "signal_processing.h"
#include "wifi_manager.h"
#include "telemetry_server.h"
#include "cloud_relay.h"

// ── Globals ─────────────────────────────────────────────────
static SPIClass  vspi(VSPI);
// ads_left  → U1, CS=MP_PIN_CS_LEFT  → LEFT  body side (ch[0], ch[1])
// ads_right → U4, CS=MP_PIN_CS_RIGHT → RIGHT body side (ch[2], ch[3])
static ADS1292   ads_left(&vspi,  MP_PIN_CS_LEFT,  MP_PIN_DRDY_U1);
static ADS1292   ads_right(&vspi, MP_PIN_CS_RIGHT, MP_PIN_DRDY_U4);
static EmgChannel chL1, chL2, chR1, chR2;

static bool ads_left_ok  = false;
static bool ads_right_ok = false;
static bool sim_force = false;
static bool rawLog    = false;    // toggles live raw ADC count printing

// Live channel % values (0–100), updated at MP_SAMPLE_RATE_HZ
// L1/L2 = left body side (U1/CS_LEFT); R1/R2 = right body side (U4/CS_RIGHT)
static volatile float pct_L1 = 0, pct_L2 = 0, pct_R1 = 0, pct_R2 = 0;

// ── Channel labels ───────────────────────────────────────────
static char chLabels[4][MP_LABEL_MAX_LEN];

static const char* NVS_LABEL_KEYS[4] = {
  MP_NVS_KEY_LABEL0, MP_NVS_KEY_LABEL1,
  MP_NVS_KEY_LABEL2, MP_NVS_KEY_LABEL3,
};
static const char* NVS_LABEL_DEFAULTS[4] = {
  MP_DEFAULT_LABEL0, MP_DEFAULT_LABEL1,
  MP_DEFAULT_LABEL2, MP_DEFAULT_LABEL3,
};

static void saveLabel(uint8_t ch, const char* name);

static void loadLabelsFromNvs() {
  Preferences prefs;
  prefs.begin("myopack", /*readOnly=*/true);
  for (int i = 0; i < 4; ++i) {
    String v = prefs.isKey(NVS_LABEL_KEYS[i])
      ? prefs.getString(NVS_LABEL_KEYS[i], NVS_LABEL_DEFAULTS[i])
      : String(NVS_LABEL_DEFAULTS[i]);
    strncpy(chLabels[i], v.c_str(), MP_LABEL_MAX_LEN - 1);
    chLabels[i][MP_LABEL_MAX_LEN - 1] = '\0';
  }
  prefs.end();
}

static void applyPreset(const char* preset, bool save) {
  struct LabelPreset {
    const char* labels[4];
    const char* message;
  };

  // Label order: [ch0=Left primary, ch1=Left alt, ch2=Right primary, ch3=Right alt]
  LabelPreset selected;
  if (strcmp(preset, "arms") == 0) {
    selected = LabelPreset{ { "Left Bicep", "Left Bicep B", "Right Bicep", "Right Bicep B" }, "[preset] arms applied" };
  } else if (strcmp(preset, "legs") == 0) {
    selected = LabelPreset{ { "Left Quad", "Left Quad B", "Right Quad", "Right Quad B" }, "[preset] legs applied" };
  } else if (strcmp(preset, "bicep") == 0) {
    selected = LabelPreset{ { "Left Bicep", "Left Bicep B", "Right Bicep", "Right Bicep B" }, "[preset] bicep applied" };
  } else if (strcmp(preset, "shoulder") == 0) {
    selected = LabelPreset{ { "Left Shoulder", "Left Shoulder B", "Right Shoulder", "Right Shoulder B" }, "[preset] shoulder applied" };
  } else {
    Serial.println("available presets: arms | legs | bicep | shoulder");
    return;
  }

  for (uint8_t ch = 0; ch < 4; ++ch) {
    strncpy(chLabels[ch], selected.labels[ch], MP_LABEL_MAX_LEN - 1);
    chLabels[ch][MP_LABEL_MAX_LEN - 1] = '\0';
    MpTelemetry::setLabel(ch, chLabels[ch]);
    MpCloudRelay::setLabel(ch, chLabels[ch]);
    if (save) saveLabel(ch, chLabels[ch]);
  }

  Serial.println(selected.message);
  if (!ads_left_ok && ads_right_ok) {
    Serial.println("[preset] right chip only — ch2/ch3 live, ch0/ch1 = 0");
  } else if (ads_left_ok && !ads_right_ok) {
    Serial.println("[preset] left chip only — ch0/ch1 live, ch2/ch3 = 0");
  }
}

static void saveLabel(uint8_t ch, const char* name) {
  Preferences prefs;
  prefs.begin("myopack", false);
  prefs.putString(NVS_LABEL_KEYS[ch], name);
  prefs.end();
}

static void applyLabel(uint8_t ch, const char* name) {
  strncpy(chLabels[ch], name, MP_LABEL_MAX_LEN - 1);
  chLabels[ch][MP_LABEL_MAX_LEN - 1] = '\0';
  MpTelemetry::setLabel(ch, chLabels[ch]);
  MpCloudRelay::setLabel(ch, chLabels[ch]);
  saveLabel(ch, chLabels[ch]);
  Serial.printf("[label] ch%u → \"%s\"  (saved to NVS)\n", ch, chLabels[ch]);
}

static void handleRemoteLabelChange(uint8_t ch, const char* name) {
  if (ch >= 4 || !name) return;
  strncpy(chLabels[ch], name, MP_LABEL_MAX_LEN - 1);
  chLabels[ch][MP_LABEL_MAX_LEN - 1] = '\0';
  MpTelemetry::setLabel(ch, chLabels[ch]);
  MpCloudRelay::setLabel(ch, chLabels[ch]);
  Serial.printf("[label] ch%u synced from app → \"%s\"\n", ch, chLabels[ch]);
}

// ── Stats ───────────────────────────────────────────────────
static uint32_t leftSampleCount = 0;
static uint32_t rightSampleCount = 0;
static uint32_t lastStatsMs = 0;

// ── Simulation generator ─────────────────────────────────────
static void tickSimulation() {
  static float phase = 0;
  phase += 0.05f;
  auto vary = [&](float base, float amp, float pshift) {
    return base + amp * sinf(phase + pshift)
         + (float)random(-30, 30) / 10.0f;
  };
  pct_L1 = constrain(vary(65, 15, 0.0f),   0, 100);  // left primary
  pct_L2 = constrain(vary(63, 14, 0.3f),   0, 100);  // left secondary
  pct_R1 = constrain(vary(58, 15, 1.2f),   0, 100);  // right primary
  pct_R2 = constrain(vary(56, 14, 1.5f),   0, 100);  // right secondary
}

// ── Serial command router ────────────────────────────────────
static void handleSerial() {
  static String buf;
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\r') continue;
    if (c == '\n') {
      String line = buf; buf = "";
      line.trim();
      if (line.isEmpty()) continue;

      if (line.startsWith("wifi-") || line == "ip") {
        MpWiFi::handleSerialCommand(line);

      } else if (line == "sim-on") {
        sim_force = true;
        Serial.println("[mode] simulation forced ON");

      } else if (line == "sim-off") {
        sim_force = false;
        Serial.println("[mode] simulation forced OFF");

      } else if (line == "raw-log") {
        rawLog = !rawLog;
        Serial.printf("[raw-log] %s  (prints raw ADC counts at ~10 Hz)\n",
                      rawLog ? "ON" : "OFF");

      } else if (line.startsWith("label ")) {
        // label <ch 0-3> <name...>
        int firstSp = line.indexOf(' ');
        int secondSp = line.indexOf(' ', firstSp + 1);
        if (secondSp < 0 || secondSp == line.length() - 1) {
          Serial.println("usage: label <0-3> <muscle name>");
          Serial.println("  e.g. label 0 Left Bicep");
        } else {
          int ch = line.substring(firstSp + 1, secondSp).toInt();
          if (ch < 0 || ch > 3) {
            Serial.println("[label] channel must be 0-3");
          } else {
            String name = line.substring(secondSp + 1);
            name.trim();
            applyLabel((uint8_t)ch, name.c_str());
          }
        }

      } else if (line.startsWith("preset ")) {
        String preset = line.substring(7);
        preset.trim();
        preset.toLowerCase();
        if (preset == "arms") {
          applyPreset("arms", true);
        } else if (preset == "legs") {
          applyPreset("legs", true);
        } else if (preset == "bicep") {
          applyPreset("bicep", true);
        } else if (preset == "shoulder") {
          applyPreset("shoulder", true);
        } else {
          Serial.println("available presets: arms | legs | bicep | shoulder");
        }

      } else if (line == "stats") {
        Serial.printf("[stats] leftSamples=%lu  rightSamples=%lu  wsClients=%u  cloud=%s\n",
                      leftSampleCount, rightSampleCount, MpTelemetry::clientCount(),
                      MpCloudRelay::isConnected() ? "connected" : "offline");
        Serial.printf("        ch0 (%s)=%.1f%%  ch1 (%s)=%.1f%%\n",
                      chLabels[0], pct_L1, chLabels[1], pct_L2);
        Serial.printf("        ch2 (%s)=%.1f%%  ch3 (%s)=%.1f%%\n",
                      chLabels[2], pct_R1, chLabels[3], pct_R2);

      } else if (line == "reboot") {
        Serial.println("[sys] rebooting...");
        delay(100);
        ESP.restart();

      } else {
        Serial.printf("[serial] unknown: %s\n", line.c_str());
      }
    } else {
      buf += c;
      if (buf.length() > 128) buf = "";
    }
  }
}

// ───────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println();
  Serial.printf("=== MyoPack firmware v%s ===\n", MP_FIRMWARE_VERSION);
  Serial.printf("Sample rate: %u Hz · Stream rate: %u Hz\n",
                MP_SAMPLE_RATE_HZ, MP_WS_STREAM_HZ);

  // ── SPI bus ──────────────────────────────────────────────
  vspi.begin(MP_PIN_SCLK, MP_PIN_MISO, MP_PIN_MOSI);
  Serial.printf("[SPI] VSPI up: SCLK=%u MISO=%u MOSI=%u\n",
                MP_PIN_SCLK, MP_PIN_MISO, MP_PIN_MOSI);

  // Keep every ADS1292 deselected before probing either chip. On the shared
  // MISO bus a floating CS line can make the other ADS talk during an ID read.
  pinMode(MP_PIN_CS_LEFT, OUTPUT);
  pinMode(MP_PIN_CS_RIGHT, OUTPUT);
  digitalWrite(MP_PIN_CS_LEFT, HIGH);
  digitalWrite(MP_PIN_CS_RIGHT, HIGH);
  delay(5);

  // ── Init both ADS1292s ───────────────────────────────────
  ads_left_ok  = ads_left.begin();
  ads_right_ok = ads_right.begin();

  if (!ads_left_ok && !ads_right_ok) {
    Serial.println("[WARN] both ADS1292s failed init — falling back to simulation.");
    sim_force = true;
  } else if (ads_left_ok && ads_right_ok) {
    Serial.println("[ADS] both chips online — bilateral 4-channel streaming enabled");
  } else if (ads_left_ok) {
    Serial.printf("[ADS] left chip only (CS=%u) -- ch0/ch1 live, ch2/ch3=0\n", MP_PIN_CS_LEFT);
  } else {
    Serial.printf("[ADS] right chip only (CS=%u) -- ch2/ch3 live, ch0/ch1=0\n", MP_PIN_CS_RIGHT);
  }

#if MP_SIM_MODE
  sim_force = true;
  Serial.println("[mode] MP_SIM_MODE build flag set — simulation forced");
#endif

  // ── Channel labels (NVS → telemetry) ─────────────────────
  loadLabelsFromNvs();
  for (int i = 0; i < 4; ++i) {
    MpTelemetry::setLabel(i, chLabels[i]);
    MpCloudRelay::setLabel(i, chLabels[i]);
  }
  MpTelemetry::setLabelChangeHandler(handleRemoteLabelChange);
  MpCloudRelay::setLabelChangeHandler(handleRemoteLabelChange);
  Serial.printf("[labels] ch0=%s  ch1=%s  ch2=%s  ch3=%s\n",
                chLabels[0], chLabels[1], chLabels[2], chLabels[3]);

  // ── WiFi ─────────────────────────────────────────────────
  if (!MpWiFi::begin()) {
    Serial.println("[WiFi] not connected — run: wifi-set <ssid> <password>");
  }

  // ── WebSocket server ─────────────────────────────────────
  MpTelemetry::begin();
  MpCloudRelay::begin();

  Serial.println();
  Serial.println("READY");
  Serial.println("  serial cmds: wifi-set | wifi-status | ip | stats | sim-on | sim-off");
  Serial.println("               label <0-3> <name> | preset legs|arms|bicep|shoulder");
  Serial.println("               raw-log | reboot");
  if (MpWiFi::isConnected()) {
    Serial.printf("  connect app to: ws://%s:%u\n",
                  MpWiFi::getIpAddress().c_str(), MP_WS_PORT);
    Serial.printf("              or: ws://%s.local:%u\n",
                  MP_MDNS_HOSTNAME, MP_WS_PORT);
  }
}

// ───────────────────────────────────────────────────────────
void loop() {
  handleSerial();
  MpTelemetry::loop();
  MpCloudRelay::loop();

  // ── Acquisition ──────────────────────────────────────────
  if (sim_force) {
    static uint32_t lastSim = 0;
    if (millis() - lastSim >= 50) {
      lastSim = millis();
      tickSimulation();
    }
  } else {
    int32_t s[2];

    // Left chip (CS=MP_PIN_CS_LEFT) → ch[0] and ch[1]
    if (!ads_left_ok) {
      pct_L1 = 0;
      pct_L2 = 0;
    }
    if (ads_left_ok && ads_left.readSample(s)) {
      pct_L1 = chL1.pushSample(s[0]);
      pct_L2 = chL2.pushSample(s[1]);
      leftSampleCount++;

      // raw-log: throttle to ~10 Hz (every 50 samples at 500 Hz)
      if (rawLog && (leftSampleCount % 50 == 0)) {
        Serial.printf("[raw] LEFT ch0=%ld  ch1=%ld  pct0=%.1f%%  pct1=%.1f%%\n",
                      s[0], s[1], pct_L1, pct_L2);
      }
    }

    // Right chip (CS=MP_PIN_CS_RIGHT) → ch[2] and ch[3]
    if (!ads_right_ok) {
      pct_R1 = 0;
      pct_R2 = 0;
    }
    if (ads_right_ok && ads_right.readSample(s)) {
      pct_R1 = chR1.pushSample(s[0]);
      pct_R2 = chR2.pushSample(s[1]);
      rightSampleCount++;

      if (rawLog && (rightSampleCount % 50 == 0)) {
        Serial.printf("[raw] RIGHT ch2=%ld  ch3=%ld  pct2=%.1f%%  pct3=%.1f%%\n",
                      s[0], s[1], pct_R1, pct_R2);
      }
    }
  }

  const char* telemetrySource = sim_force ? "firmware-sim" : "ads";
  MpTelemetry::update(pct_L1, pct_L2, pct_R1, pct_R2, /*monitoring=*/true, telemetrySource);
  MpCloudRelay::update(pct_L1, pct_L2, pct_R1, pct_R2, /*monitoring=*/true, telemetrySource);

  // Heartbeat log every 5 s
  uint32_t now = millis();
  if (now - lastStatsMs > 5000) {
    uint32_t elapsed = now - lastStatsMs;
    lastStatsMs = now;
    float leftHz = elapsed > 0 ? ((float)leftSampleCount * 1000.0f) / (float)elapsed : 0.0f;
    float rightHz = elapsed > 0 ? ((float)rightSampleCount * 1000.0f) / (float)elapsed : 0.0f;
    leftSampleCount = 0;
    rightSampleCount = 0;
    if (MpWiFi::isConnected()) {
      Serial.printf("[hb] L=%.0f Hz R=%.0f Hz ws=%u cloud=%s %s=%.0f %s=%.0f %s=%.0f %s=%.0f\n",
                    leftHz, rightHz, MpTelemetry::clientCount(),
                    MpCloudRelay::isConnected() ? "up" : "down",
                    chLabels[0], pct_L1, chLabels[1], pct_L2,
                    chLabels[2], pct_R1, chLabels[3], pct_R2);
    }
  }

  yield();
}
