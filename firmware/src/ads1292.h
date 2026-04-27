// ─────────────────────────────────────────────────────────────
// ads1292.h — Minimal driver for TI ADS1292 24-bit AFE
//
// Scope: what MyoPack needs. Not a full-feature driver — no
// lead-off, no RLD, no respiration. Just: reset, configure,
// RDATAC, read continuous samples.
// ─────────────────────────────────────────────────────────────
#pragma once
#include <Arduino.h>
#include <SPI.h>

class ADS1292 {
public:
  // csPin: chip-select GPIO. drdyPin: data-ready input (IRQ-capable).
  // The SPI bus is shared — pass a pointer to the owning SPIClass.
  ADS1292(SPIClass* spi, uint8_t csPin, uint8_t drdyPin);

  // Bring the chip up: reset, stop RDATAC, configure registers,
  // verify ID, start continuous conversion.
  // Returns true if the chip ID read matches expected silicon.
  bool begin();

  // Read one data frame (3 status bytes + 3 bytes/channel × 2).
  // `samples[0]` = channel 1, `samples[1]` = channel 2 — in raw
  // signed 24-bit form sign-extended into int32_t.
  // Returns false if no data was ready (non-blocking).
  bool readSample(int32_t samples[2]);

  // Blocking helper: waits up to `timeoutMs` for DRDY# to go low.
  bool waitForData(uint32_t timeoutMs);

  // Register-level helpers (public for debug / reconfiguration)
  uint8_t readRegister(uint8_t addr);
  void    writeRegister(uint8_t addr, uint8_t value);

  // Accessors
  uint8_t  csPin()   const { return _cs; }
  uint8_t  drdyPin() const { return _drdy; }

private:
  SPIClass* _spi;
  uint8_t   _cs;
  uint8_t   _drdy;
  SPISettings _settings;

  void sendCommand(uint8_t cmd);
  void csLow();
  void csHigh();
};
