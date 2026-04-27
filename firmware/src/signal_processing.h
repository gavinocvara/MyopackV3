// ─────────────────────────────────────────────────────────────
// signal_processing.h
//   EMG signal pipeline per channel:
//     raw int32 → bandpass (20–150 Hz)
//                → 60 Hz notch
//                → full-wave rectify
//                → RMS envelope (50 ms window)
//                → normalize 0–100 for UI
//
// Designed for MP_SAMPLE_RATE_HZ = 500 Hz. If you change the
// sample rate, re-derive the Biquad coefficients.
// ─────────────────────────────────────────────────────────────
#pragma once
#include <Arduino.h>
#include "config.h"

// Single 2nd-order IIR biquad (direct form II transposed)
struct Biquad {
  float b0, b1, b2;
  float a1, a2;
  float z1, z2;

  void reset() { z1 = z2 = 0.0f; }
  float process(float x) {
    float y = b0 * x + z1;
    z1 = b1 * x - a1 * y + z2;
    z2 = b2 * x - a2 * y;
    return y;
  }
};

class EmgChannel {
public:
  EmgChannel();

  // Feed one raw int32 sample from the ADS1292. Returns the
  // latest normalized 0–100 activation percentage — updated
  // every sample, but the envelope has 50 ms smoothing.
  float pushSample(int32_t raw);

  // Reset all filter state + RMS window. Call on session start.
  void reset();

  // Diagnostics
  float rawLast()   const { return _lastRaw; }
  float rmsLast()   const { return _lastRms; }

private:
  Biquad _bp1, _bp2;   // 2× biquad = 4th-order bandpass
  Biquad _notch;       // 60 Hz notch

  static constexpr uint16_t RMS_N = (MP_SAMPLE_RATE_HZ * MP_RMS_WINDOW_MS) / 1000;
  float _window[RMS_N];
  uint16_t _wIdx;
  float _wSumSq;       // rolling sum of squares (for RMS)

  float _lastRaw;
  float _lastRms;

  // Calibration: maps RMS envelope → 0–100%. Tune during bench test.
  // Initial guess: peak voluntary contraction RMS ≈ 80 µV on 24-bit
  // 2.42 V-ref → ≈ 2700 counts. Adjust MP_FULL_SCALE_COUNTS below.
  static constexpr float MP_FULL_SCALE_COUNTS = 3500.0f;
};

// Top-level bilateral symmetry calculation (mirrors TS/C++ port)
struct BalanceResult {
  float balance;      // 0–100, 100 = perfect symmetry
  float quadSym;      // primary cross-side symmetry, retained as qsym on the wire
  float hamSym;       // secondary cross-side symmetry, retained as hsym on the wire
};
BalanceResult computeBalance(float lq, float rq, float lh, float rh);
