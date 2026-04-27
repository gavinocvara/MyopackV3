// ─────────────────────────────────────────────────────────────
// wifi_manager.h
//   Connects to WiFi. Credentials are stored in NVS so they
//   survive reboot. First-time setup via serial console:
//     wifi-set <ssid> <password>
//   Then:
//     wifi-connect
//   mDNS advertises the device as `myopack.local`.
// ─────────────────────────────────────────────────────────────
#pragma once
#include <Arduino.h>

namespace MpWiFi {
  // Try to connect using stored or default creds. Blocks up to
  // `timeoutMs`. Returns true if we got an IP.
  bool begin(uint32_t timeoutMs = 15000);

  // Set + persist new creds (also calls connect()).
  bool setCredentials(const String& ssid, const String& password);

  // Serial command parser — hook into loop():
  //   wifi-set <ssid> <password>
  //   wifi-status
  //   wifi-clear
  //   ip
  void handleSerialCommand(const String& line);

  // Accessors
  bool      isConnected();
  String    getIpAddress();
  String    getSsid();
}
