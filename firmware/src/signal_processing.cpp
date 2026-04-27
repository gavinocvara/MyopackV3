// ─────────────────────────────────────────────────────────────
// signal_processing.cpp
//   Filter coefficients pre-computed for fs = 500 Hz. If you
//   change fs, regenerate with scipy:
//     from scipy.signal import butter, iirnotch
//     b,a = butter(2, [20/250, 150/250], btype='band')
//     b,a = iirnotch(60/250, 30)
// ─────────────────────────────────────────────────────────────
#include "signal_processing.h"
#include "config.h"
#include <math.h>

#if MP_SAMPLE_RATE_HZ != 500
  #error "signal_processing.cpp coefficients are currently valid only for MP_SAMPLE_RATE_HZ=500. Regenerate filters before changing sample rate."
#endif

// ───── Biquad sections for 4th-order Butterworth bandpass 20–150 Hz
// @ fs=500. Cascaded as two 2nd-order biquads.
// Coefficients from scipy.signal.butter(2, [20/250, 150/250], 'band')
// then factored into SOS form. Tune later if needed.
//
// Section 1 (lower pair):
static const float BP1_B0 =  0.39133f;
static const float BP1_B1 =  0.00000f;
static const float BP1_B2 = -0.39133f;
static const float BP1_A1 = -0.66076f;
static const float BP1_A2 =  0.60851f;
//
// Section 2 (upper pair):
static const float BP2_B0 =  0.39133f;
static const float BP2_B1 =  0.00000f;
static const float BP2_B2 = -0.39133f;
static const float BP2_A1 = -1.53743f;
static const float BP2_A2 =  0.78413f;

// ───── 60 Hz IIR notch @ fs=500, Q=30 ────────────────────────
// scipy.signal.iirnotch(60/250, 30)
static const float NOTCH_B0 =  0.98439f;
static const float NOTCH_B1 = -1.59181f;
static const float NOTCH_B2 =  0.98439f;
static const float NOTCH_A1 = -1.59181f;
static const float NOTCH_A2 =  0.96878f;

EmgChannel::EmgChannel() {
  _bp1  = { BP1_B0, BP1_B1, BP1_B2, BP1_A1, BP1_A2, 0, 0 };
  _bp2  = { BP2_B0, BP2_B1, BP2_B2, BP2_A1, BP2_A2, 0, 0 };
  _notch= { NOTCH_B0, NOTCH_B1, NOTCH_B2, NOTCH_A1, NOTCH_A2, 0, 0 };
  reset();
}

void EmgChannel::reset() {
  _bp1.reset();
  _bp2.reset();
  _notch.reset();
  for (uint16_t i = 0; i < RMS_N; ++i) _window[i] = 0.0f;
  _wIdx = 0;
  _wSumSq = 0.0f;
  _lastRaw = 0.0f;
  _lastRms = 0.0f;
}

float EmgChannel::pushSample(int32_t raw) {
  _lastRaw = (float)raw;

  // 1. Bandpass (cascaded biquads)
  float y = _bp1.process(_lastRaw);
  y = _bp2.process(y);

  // 2. 60 Hz notch
  y = _notch.process(y);

  // 3. Full-wave rectify
  float r = fabsf(y);

  // 4. Rolling RMS window
  float rr = r * r;
  _wSumSq -= _window[_wIdx];
  _window[_wIdx] = rr;
  _wSumSq += rr;
  _wIdx = (_wIdx + 1) % RMS_N;

  // Guard against tiny negative drift from float rounding
  if (_wSumSq < 0.0f) _wSumSq = 0.0f;
  float rms = sqrtf(_wSumSq / (float)RMS_N);
  _lastRms = rms;

  // 5. Normalize → 0–100 %
  float pct = (rms / MP_FULL_SCALE_COUNTS) * 100.0f;
  if (pct < 0.0f)   pct = 0.0f;
  if (pct > 100.0f) pct = 100.0f;
  return pct;
}

BalanceResult computeBalance(float lq, float rq, float lh, float rh) {
  // Mirrors lib/emg/calculations.ts after the physical-side routing fix:
  // lq/rq are historical parameter names, but they now represent ch0/ch1
  // from the LEFT chip. lh/rh represent ch2/ch3 from the RIGHT chip.
  float leftAvg  = (lq + rq) * 0.5f;
  float rightAvg = (lh + rh) * 0.5f;
  float diff     = fabsf(leftAvg - rightAvg);
  if (diff > 100.0f) diff = 100.0f;

  BalanceResult r;
  r.balance  = 100.0f - diff;
  r.quadSym  = 100.0f - fminf(fabsf(lq - lh), 100.0f); // primary cross-side symmetry
  r.hamSym   = 100.0f - fminf(fabsf(rq - rh), 100.0f); // secondary cross-side symmetry
  return r;
}
