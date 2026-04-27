// ─────────────────────────────────────────────────────────────
// config.h — MyoPack firmware constants
//   Single source of truth for pin assignments, timing, and
//   build-time feature flags. Change here, not anywhere else.
// ─────────────────────────────────────────────────────────────
#pragma once

// ───── WiFi credentials ──────────────────────────────────────
// For the demo, hardcode here OR use runtime provisioning via
// serial console (see wifi_manager.cpp — `wifi-set <ssid> <pw>`).
// Stored in NVS once set; survives reboot.
#ifndef MP_DEFAULT_SSID
  #define MP_DEFAULT_SSID     "YOUR_SSID"
#endif
#ifndef MP_DEFAULT_PASSWORD
  #define MP_DEFAULT_PASSWORD "YOUR_PASSWORD"
#endif

// ───── WebSocket server ──────────────────────────────────────
#define MP_WS_PORT            81
#define MP_WS_STREAM_HZ       20      // app frame rate (50 ms period)

// ───── Physical side assignment ──────────────────────────────
// U1 (CS=MP_PIN_CS_LEFT)  → LEFT  body side: ch[0]=primary, ch[1]=secondary
// U4 (CS=MP_PIN_CS_RIGHT) → RIGHT body side: ch[2]=primary, ch[3]=secondary
//
// If live board testing proves the chips are physically reversed,
// swap the two CS #defines below — nothing else needs to change.
#define MP_PIN_CS_LEFT        21      // U1 — LEFT  body side by default
#define MP_PIN_CS_RIGHT       22      // U4 — RIGHT body side by default

// ───── ADS1292 SPI pins ──────────────────────────────────────
// Derived from current bench wiring provided by the user.
//
// Shared bus (VSPI):
#define MP_PIN_SCLK           18      // VSPI SCK
#define MP_PIN_MOSI           23      // VSPI MOSI  → ADS1292 DIN
#define MP_PIN_MISO           19      // VSPI MISO  ← ADS1292 DOUT
//
// Per-chip (aliased from physical side defines above):
#define MP_PIN_CS_U1          MP_PIN_CS_LEFT
#define MP_PIN_CS_U4          MP_PIN_CS_RIGHT
#define MP_PIN_DRDY_U1        4       // U1 DRDY#
#define MP_PIN_DRDY_U4        16      // U4 DRDY#
//
// Optional GPIO controls. START is wired to GPIO26 on the current
// bench setup, so drive it high during bring-up in addition to the
// ADS1292 START command for a more hardware-friendly init path.
#define MP_PIN_START         26
// #define MP_PIN_PWDN_RESET  16

// ───── ADS1292 SPI timing ────────────────────────────────────
// Datasheet: SCLK max 20 MHz; tCSSC 6 ns; use 4 MHz for stability
// with breadboard/flex-cable routing.
#define MP_SPI_HZ             250000
#define MP_SPI_MODE           SPI_MODE1   // CPOL=0, CPHA=1

// ───── Sampling / signal path ────────────────────────────────
#define MP_SAMPLE_RATE_HZ     500     // ADS1292 CONFIG1 = 0x02 (500 SPS)
#define MP_CHANNELS_PER_CHIP  2
#define MP_TOTAL_CHANNELS     4       // left primary, left alt, right primary, right alt
#define MP_RMS_WINDOW_MS      50      // 50 ms envelope window = 25 samples @ 500 Hz
#define MP_PGA_GAIN           6       // CH1SET/CH2SET = 0x60 (PGA=6)

// Channel index convention used throughout firmware + app:
// U1 (CS_LEFT)  provides both left-side channels (0 and 1).
// U4 (CS_RIGHT) provides both right-side channels (2 and 3).
// Primary (CH1 of each chip) is the main measurement channel.
// Secondary (CH2) is available as a fallback if primary contact is poor.
enum MpChannel : uint8_t {
  MP_CH_L1 = 0,   // U1 (CS_LEFT)  CH1 — Left body side, primary
  MP_CH_L2 = 1,   // U1 (CS_LEFT)  CH2 — Left body side, secondary
  MP_CH_R1 = 2,   // U4 (CS_RIGHT) CH1 — Right body side, primary
  MP_CH_R2 = 3,   // U4 (CS_RIGHT) CH2 — Right body side, secondary
};

// ───── Debug / mode flags ────────────────────────────────────
// Compile-time switch to force simulation output over WebSocket
// even if no ADS1292 is connected — useful for testing the app
// wiring without the electrode rig plugged in.
#ifndef MP_SIM_MODE
  #define MP_SIM_MODE         0
#endif

// mDNS hostname — lets the app discover the device as `myopack.local`
// on networks where mDNS works (macOS, iOS, most Linux, modern Windows).
#define MP_MDNS_HOSTNAME      "myopack"

// ───── Channel labels ────────────────────────────────────────
// Human-readable muscle names for each of the 4 ADC channels.
// Stored in NVS; survive reboot. Set via serial `label <0-3> <name>`
// or WebSocket {"cmd":"label","ch":N,"name":"..."}.
#define MP_LABEL_MAX_LEN      24          // max chars incl. null terminator
#define MP_NVS_KEY_LABEL0     "lbl0"
#define MP_NVS_KEY_LABEL1     "lbl1"
#define MP_NVS_KEY_LABEL2     "lbl2"
#define MP_NVS_KEY_LABEL3     "lbl3"
// Default labels reflect physical side ownership.
// The app overwrites these via syncDeviceLabels() when a muscle group is selected.
#define MP_DEFAULT_LABEL0     "Left Primary"
#define MP_DEFAULT_LABEL1     "Left Alt"
#define MP_DEFAULT_LABEL2     "Right Primary"
#define MP_DEFAULT_LABEL3     "Right Alt"
