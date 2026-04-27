// ─────────────────────────────────────────────────────────────
// wifi_manager.cpp
// ─────────────────────────────────────────────────────────────
#include "wifi_manager.h"
#include "config.h"

#include <WiFi.h>
#include <ESPmDNS.h>
#include <Preferences.h>

namespace {
  Preferences prefs;
  const char* NVS_NS  = "myopack";
  const char* K_SSID  = "ssid";
  const char* K_PASS  = "pass";

  bool connectInternal(const String& ssid, const String& password, uint32_t timeoutMs) {
    WiFi.mode(WIFI_STA);  // init TCP/IP stack even if no SSID yet
    if (ssid.isEmpty()) {
      Serial.println("[WiFi] no SSID configured — run `wifi-set <ssid> <pass>` over serial");
      return false;
    }

    Serial.printf("[WiFi] connecting to \"%s\" ...\n", ssid.c_str());
    WiFi.mode(WIFI_STA);
    WiFi.disconnect(true, true);
    delay(50);
    WiFi.setSleep(false);           // lower latency for WS stream
    WiFi.begin(ssid.c_str(), password.c_str());

    uint32_t t0 = millis();
    while (WiFi.status() != WL_CONNECTED) {
      if (millis() - t0 > timeoutMs) {
        Serial.println("\n[WiFi] connect timeout");
        return false;
      }
      delay(250);
      Serial.print('.');
    }
    Serial.println();
    Serial.printf("[WiFi] connected — IP %s  RSSI %d dBm\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());

    // Start mDNS so the app can reach ws://myopack.local:81
    if (!MDNS.begin(MP_MDNS_HOSTNAME)) {
      Serial.println("[mDNS] start failed — device still reachable by IP");
    } else {
      MDNS.addService("ws", "tcp", MP_WS_PORT);
      Serial.printf("[mDNS] advertising as %s.local (ws :%u)\n",
                    MP_MDNS_HOSTNAME, MP_WS_PORT);
    }
    return true;
  }
}

namespace MpWiFi {

bool begin(uint32_t timeoutMs) {
  prefs.begin(NVS_NS, /*readOnly=*/false);
  String ssid = prefs.getString(K_SSID, MP_DEFAULT_SSID);
  String pass = prefs.getString(K_PASS, MP_DEFAULT_PASSWORD);
  prefs.end();
  return connectInternal(ssid, pass, timeoutMs);
}

bool setCredentials(const String& ssid, const String& password) {
  prefs.begin(NVS_NS, /*readOnly=*/false);
  prefs.putString(K_SSID, ssid);
  prefs.putString(K_PASS, password);
  prefs.end();
  Serial.printf("[WiFi] stored creds for \"%s\"\n", ssid.c_str());
  return connectInternal(ssid, password, 15000);
}

bool   isConnected()  { return WiFi.status() == WL_CONNECTED; }
String getIpAddress() { return WiFi.localIP().toString(); }
String getSsid()      { return WiFi.SSID(); }

void handleSerialCommand(const String& line) {
  String s = line; s.trim();
  if (s.isEmpty()) return;

  if (s.startsWith("wifi-set ")) {
    // Format: wifi-set <ssid> <password>
    // Password may contain spaces — assume last word-boundary is split.
    int firstSp = s.indexOf(' ');
    int secondSp = s.indexOf(' ', firstSp + 1);
    if (secondSp < 0) {
      Serial.println("usage: wifi-set <ssid> <password>");
      return;
    }
    String ssid = s.substring(firstSp + 1, secondSp);
    String pass = s.substring(secondSp + 1);
    setCredentials(ssid, pass);
    return;
  }

  if (s == "wifi-clear") {
    prefs.begin(NVS_NS, false);
    prefs.clear();
    prefs.end();
    Serial.println("[WiFi] NVS cleared");
    return;
  }

  if (s == "wifi-status" || s == "ip") {
    if (isConnected()) {
      Serial.printf("[WiFi] SSID=%s  IP=%s  RSSI=%d\n",
                    getSsid().c_str(), getIpAddress().c_str(), WiFi.RSSI());
    } else {
      Serial.println("[WiFi] not connected");
    }
    return;
  }
}

} // namespace
