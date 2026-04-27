// ─────────────────────────────────────────────────────────────
// ads1292.cpp — see header for scope.
// Register map reference: TI SBAS502B (ADS1292R datasheet).
// ─────────────────────────────────────────────────────────────
#include "ads1292.h"
#include "config.h"

// ───── Commands (datasheet §9.5.1) ───────────────────────────
static constexpr uint8_t CMD_WAKEUP   = 0x02;
static constexpr uint8_t CMD_STANDBY  = 0x04;
static constexpr uint8_t CMD_RESET    = 0x06;
static constexpr uint8_t CMD_START    = 0x08;
static constexpr uint8_t CMD_STOP     = 0x0A;
static constexpr uint8_t CMD_RDATAC   = 0x10;   // read data continuous
static constexpr uint8_t CMD_SDATAC   = 0x11;   // stop RDATAC
static constexpr uint8_t CMD_RDATA    = 0x12;
static constexpr uint8_t CMD_RREG     = 0x20;   // OR with register addr
static constexpr uint8_t CMD_WREG     = 0x40;

// ───── Register addresses ────────────────────────────────────
static constexpr uint8_t REG_ID       = 0x00;
static constexpr uint8_t REG_CONFIG1  = 0x01;
static constexpr uint8_t REG_CONFIG2  = 0x02;
static constexpr uint8_t REG_LOFF     = 0x03;
static constexpr uint8_t REG_CH1SET   = 0x04;
static constexpr uint8_t REG_CH2SET   = 0x05;
static constexpr uint8_t REG_RLD_SENS = 0x06;
static constexpr uint8_t REG_LOFF_SENS= 0x07;
static constexpr uint8_t REG_LOFF_STAT= 0x08;
static constexpr uint8_t REG_RESP1    = 0x09;
static constexpr uint8_t REG_RESP2    = 0x0A;
static constexpr uint8_t REG_GPIO     = 0x0B;

// ADS1292 ID register returns 0x53 (ADS1292) or 0x73 (ADS1292R).
// We accept either — both have the same SPI+data interface.
static constexpr uint8_t EXPECTED_ID_MASK = 0x0F;  // lower nibble = 0x03 for 1292 family

ADS1292::ADS1292(SPIClass* spi, uint8_t csPin, uint8_t drdyPin)
  : _spi(spi),
    _cs(csPin),
    _drdy(drdyPin),
    _settings(MP_SPI_HZ, MSBFIRST, MP_SPI_MODE) {}

void ADS1292::csLow()  { digitalWrite(_cs, LOW); }
void ADS1292::csHigh() { digitalWrite(_cs, HIGH); }

void ADS1292::sendCommand(uint8_t cmd) {
  _spi->beginTransaction(_settings);
  csLow();
  _spi->transfer(cmd);
  csHigh();
  _spi->endTransaction();
  delayMicroseconds(10);
}

void ADS1292::writeRegister(uint8_t addr, uint8_t value) {
  _spi->beginTransaction(_settings);
  csLow();
  _spi->transfer(CMD_WREG | (addr & 0x1F));
  _spi->transfer(0x00);           // write 1 register (n = 0 → 1 reg)
  _spi->transfer(value);
  csHigh();
  _spi->endTransaction();
  delayMicroseconds(10);
}

uint8_t ADS1292::readRegister(uint8_t addr) {
  _spi->beginTransaction(_settings);
  csLow();
  _spi->transfer(CMD_RREG | (addr & 0x1F));
  _spi->transfer(0x00);           // read 1 register
  uint8_t v = _spi->transfer(0x00);
  csHigh();
  _spi->endTransaction();
  delayMicroseconds(10);
  return v;
}

bool ADS1292::begin() {
  pinMode(_cs, OUTPUT);
  digitalWrite(_cs, HIGH);
  pinMode(_drdy, INPUT);         // DRDY is an output from the ADS1292

#ifdef MP_PIN_START
  pinMode(MP_PIN_START, OUTPUT);
  digitalWrite(MP_PIN_START, HIGH);
#endif

  // Power-up wait — datasheet recommends ≥ 1 s after supplies stable
  // before first command. Your TP4056 + LDO rail comes up long before
  // we reach here, but be safe.
  delay(50);

  // ── Reset + stop continuous mode ─────────────────────────
  sendCommand(CMD_RESET);
  delay(10);                       // tPOR ≥ 18 tCLK (@ 2.048 MHz internal)
  sendCommand(CMD_SDATAC);         // must stop RDATAC before any RREG

  // ── Verify chip ID ──────────────────────────────────────
  uint8_t id = readRegister(REG_ID);
  Serial.printf("[ADS1292 CS=%u] ID = 0x%02X\n", _cs, id);
  // Accept 0x53 (ADS1292) or 0x73 (ADS1292R) — both have 0x03 in low nibble
  if ((id & EXPECTED_ID_MASK) != 0x03) {
    Serial.printf("[ADS1292 CS=%u] ID mismatch (got 0x%02X) — check SPI wiring\n", _cs, id);
    return false;
  }

  // ── Configure registers (datasheet §9.6) ─────────────────
  // CONFIG1: continuous mode, 500 SPS
  //   DR[2:0] = 010 → 500 SPS when using 512 kHz modulator
  //   We stay on internal clock → 500 SPS is fine for EMG.
  writeRegister(REG_CONFIG1, 0x02);

  // CONFIG2: internal reference ON, internal clock output disabled,
  //   test signal OFF.
  //   Bit7=1 reserved(1), bit5=1 (PDB_REFBUF on), rest default.
  writeRegister(REG_CONFIG2, 0xA0);

  // LOFF: default lead-off detection comparator off (we're not using
  //   lead-off on MyoPack — PT electrodes are direct-contact).
  writeRegister(REG_LOFF, 0x10);

  // CH1SET / CH2SET: PGA gain = 6, normal electrode input
  //   0x60 = MUX[2:0]=000 (normal input), GAIN[2:0]=110 (PGA=6), PD=0
  writeRegister(REG_CH1SET, 0x60);
  writeRegister(REG_CH2SET, 0x60);

  // RLD_SENS: disabled (0x20 = PDB_RLD=1 but no channels routed)
  writeRegister(REG_RLD_SENS, 0x20);

  // LOFF_SENS: no channels routed to lead-off comparator
  writeRegister(REG_LOFF_SENS, 0x00);

  // RESP1 / RESP2 — not used on MyoPack (EMG only, no respiration)
  writeRegister(REG_RESP1, 0x02);
  writeRegister(REG_RESP2, 0x03);

  // ── Verify a readback on CONFIG1 ────────────────────────
  uint8_t readBack = readRegister(REG_CONFIG1);
  if (readBack != 0x02) {
    Serial.printf("[ADS1292 CS=%u] CONFIG1 readback failed (got 0x%02X)\n", _cs, readBack);
    return false;
  }

  // ── Start continuous conversion ─────────────────────────
  sendCommand(CMD_START);
  delay(1);
  sendCommand(CMD_RDATAC);
  delayMicroseconds(10);

  Serial.printf("[ADS1292 CS=%u] initialized OK — 500 SPS, PGA=6\n", _cs);
  return true;
}

bool ADS1292::waitForData(uint32_t timeoutMs) {
  uint32_t t0 = millis();
  while (digitalRead(_drdy) == HIGH) {
    if (millis() - t0 > timeoutMs) return false;
    yield();                       // don't starve the watchdog
  }
  return true;
}

bool ADS1292::readSample(int32_t samples[2]) {
  // DRDY# goes LOW when a new sample is ready.
  if (digitalRead(_drdy) == HIGH) return false;

  _spi->beginTransaction(_settings);
  csLow();

  // 3 bytes of status (lead-off + GPIO state — ignored here)
  _spi->transfer(0x00);
  _spi->transfer(0x00);
  _spi->transfer(0x00);

  // 2 channels × 24 bits MSB-first, two's complement
  for (int ch = 0; ch < 2; ++ch) {
    uint32_t raw = 0;
    raw  = ((uint32_t)_spi->transfer(0x00)) << 16;
    raw |= ((uint32_t)_spi->transfer(0x00)) << 8;
    raw |=  (uint32_t)_spi->transfer(0x00);
    // Sign-extend from 24 → 32 bits
    if (raw & 0x00800000) raw |= 0xFF000000;
    samples[ch] = (int32_t)raw;
  }

  csHigh();
  _spi->endTransaction();
  return true;
}
