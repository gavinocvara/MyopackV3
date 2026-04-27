# MyoPack Safety Disclaimer

**MyoPack is a research prototype built for a senior design capstone. It is
not a medical device. It has not been reviewed or cleared by the FDA or any
regulatory body. Do not use it to diagnose, treat, monitor, or make clinical
decisions about any person.**

## What it is
An educational biofeedback system that reads surface EMG, applies standard
signal processing, and renders a relative activation estimate on a companion
app. It is intended for observation and learning only.

## What it is not
- Not a diagnostic tool
- Not a substitute for clinical judgment
- Not validated against a gold-standard EMG system
- Not intended for use on anyone with a pacemaker, ICD, or other implanted
  electrical device
- Not intended for use on broken skin, over the heart, or across the chest

## Security posture (Phase 1)
- The WebSocket server is unauthenticated. Treat it as LAN-only.
- No encryption in transit (ws://, not wss://). Don't expose port 81 to
  the internet.
- If the demo happens on a shared network (university lab WiFi), anyone on
  that network can read the stream. For a capstone demo this is acceptable;
  for anything beyond that, add a token handshake and migrate to wss://.

## Data handling
- The firmware does not persist samples to flash. The app does not persist
  samples to disk. The only long-lived state is the WiFi creds in NVS and
  the device IP in browser localStorage.
- If you add cloud persistence in Phase 2, add explicit user consent and a
  delete path.
