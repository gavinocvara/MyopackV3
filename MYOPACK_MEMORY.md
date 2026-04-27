# MyoPack Memory / Handoff

Last updated: 2026-04-27

## Current architecture

- Next.js 14 app with App Router routes: `/today`, `/vitals`, `/health`.
- `app/page.tsx` redirects to `/today`.
- Global providers are composed in `app/layout.tsx`:
  - `EMGProvider` owns telemetry, simulation, device connection, monitoring state, timers, and history.
  - `MuscleSelectionProvider` owns selected muscle group, side mode, and sensor pair.
- Device telemetry comes from the ESP32 WebSocket server on port 81 through `lib/device/websocket.ts`.
- UI shell remains `components/layout/app-chrome.tsx` plus bottom nav and device connect modal.

## Changes made

- Added a full-body muscle selection model:
  - `MuscleGroup = quads | hamstrings | biceps | shoulders`
  - `SideMode = left | right | bilateral`
  - `SensorPair = pairA | pairB`
- Added `lib/muscle-selection.ts` and `lib/muscle-selection-context.tsx`.
- Placement notes are split into per-muscle guide files under `lib/placement-guides/`:
  - `quads.ts`
  - `hamstrings.ts`
  - `biceps.ts`
  - `shoulders.ts`
  - `index.ts` exports `PLACEMENT_GUIDES` and `getPlacementGuide()`.
- Added a procedural React Three Fiber model in `components/dashboard/muscle-model.tsx`.
- The 3D muscle model now supports independent left/right heat values through `sideActivations={{ left, right }}`. Selected muscle surfaces heat per side instead of using one average value.
- The 3D muscle model now supports `showElectrodes`, rendering red/green/yellow placement markers on both sides of the selected muscle group.
- Rebuilt `/today` as:
  - 3D muscle selection first
  - electrode-placement tutorial after selection
  - immediate zoom/highlight transition through selection state
  - selected-region evaluation with live/frozen state, side mode, sensor pair, graph, and compact heated 3D model
- `/today` now requires “Ready to continue” or “Already placed · Begin” after the placement tutorial before the monitor UI appears.
- `/today` placement tutorial now includes a close-up arm/leg placement diagram. Biceps and shoulders use the arm guide; quads and hamstrings use the leg guide.
- Electrode tutorial language now treats red/green as the active EMG pair and yellow as reference/ground. For biceps, red/green are placed on the biceps belly around the SENIAM-style line between cubital fossa and acromion; yellow can be placed on a quiet bony/reference area such as lateral elbow or wrist, not over the active biceps belly.
- `/today` placement tutorial now shows only the selected muscle group's placement reference. It does not list all four muscle groups in the tutorial panel. The content is sourced from the selected muscle's file in `lib/placement-guides/`.
- Rebuilt `/vitals` around selected muscle group, side mode, sensor pair, raw channel levels, and adaptive single/bilateral graphing.
- Rebuilt `/health` around selected-region rehab progress and future-ready longitudinal framing.
- Added `lib/session-history.ts` for local browser persistence of completed session summaries.
- Added `lib/recovery-intelligence.ts` for local recovery-log analysis. It estimates imbalance severity, risk tier, confidence, likely limited side, corrective focus, and next goals from saved session summaries.
- `/today` now saves a completed run when an active session is stopped, including muscle group, side mode, sensor pair, duration, activation, symmetry, left activation, and right activation.
- `/today` now includes a passive pre-run electrode readiness check before the session button. It listens to existing EMG telemetry/simulation only; it does not inject current or stimulate the user.
- `lib/emg/context.tsx` now supports separate precheck sampling through `precheckSamples`, `isPrechecking`, `startPrecheck`, `stopPrecheck`, and `resetPrecheck`. Precheck samples do not update the live graph/history buffer and do not break freeze-on-stop behavior.
- Added `lib/emg/readiness.ts` and `components/dashboard/electrode-readiness-check.tsx` to score selected left/right electrode arrays for flat signal, saturation, weak response, and gentle-contraction responsiveness.
- `components/dashboard/session-button.tsx` supports disabled idle state. Monitor now asks the user to run the passive pre-check before starting a session unless the selected array is ready/usable.
- `/health` now reads saved local runs, compares attempts for the selected muscle group, shows trend/average/run count, estimates imbalance severity, and gives honest recommendations only when enough data exists.
- Removed the optional external AI recovery coach path. There is no API key requirement and no recovery data transmission route in the app.
- Upgraded `lib/recovery-intelligence.ts` into a richer local Recovery Coach. It now adapts from saved local runs using average score, trend, stability, likely limited side, run count, and current imbalance.
- `/health` now presents local adaptive coaching with Sync Age, near-sync ETA, coach memory, learning signals, adaptive plan, corrective focus, correction queue, next goals, and progress milestones.
- Sync Age is explicitly a motivational symmetry band, not a biological age estimate or medical claim.
- `/vitals` now shows a left/right heat legend beneath the live model so users can compare contraction strength and symmetry visually and numerically.
- `/vitals` no longer exposes Pair A/B or Primary/Secondary sensor selection. The UI now reflects the actual 6-electrode hardware concept: three electrodes allocated to the left side and three to the right side.
- `/today` no longer exposes Pair A/B switching in the Monitor flow. The selected muscle group uses its default internal channel mapping, while the user-facing language stays focused on left/right electrode arrays.
- When Vitals side mode is `Left` or `Right`, the live model readout and electrode layout show only that selected side. Both sides return when `Bilateral` is selected.
- `MuscleSelectionProvider` now restores the saved internal sensor pair for the saved muscle group, while new muscle selections still start from that region's default pair.
- `MuscleSelectionProvider` now persists electrode-placement completion under `myopack:placement_confirmed`. After the user taps "Ready to continue" or "Already placed - Begin", leaving and returning to `/today` opens the selected evaluation graph instead of repeating the tutorial. Resetting the selection from the beginning clears the placement confirmation.
- Sensor Pair A/B is now presented as an assignment for the selected muscle group rather than as fixed LQ/RQ or LH/RH UX language.
- Added visible MyoPack branding and prototype/disclaimer copy explaining the device goal: track minor contraction imbalances over time for recovery monitoring.
- `/vitals` locks the muscle context to the group chosen during onboarding. Non-selected groups are visibly greyed/locked and cannot switch the active evaluation; users must return to the beginning of `/today` to choose a new region.
- `/vitals` no longer shows raw firmware labels such as LQ/RQ/LH/RH in the polished Signal UI. The old raw channel section was replaced with an electrode readiness fingerprint based on activation, left/right drift, capture state, and selected-side electrode arrays.
- `/vitals` no longer presents skin temperature as an electrode-derived metric. Standard EMG electrodes plus ADS1292 channels do not measure skin temperature; a separate temperature sensor would be required.
- `AppChrome` now scrolls to the top on route changes so Monitor, Signal, and Recovery tabs always open from the top.
- Updated `components/dashboard/live-muscle-graph.tsx` to support either one trace or a bilateral pair.
- Refreshed `app/globals.css` with a calmer clinical palette and natural mobile scrolling.
- Hardened `lib/emg/context.tsx` so device telemetry does not update displayed EMG data or graph history when monitoring is stopped.
- Updated `lib/device/types.ts` to tolerate both `t` and `ts` timestamp fields and optional `bal/qsym/hsym/state`.
- Updated upper-body defaults so Biceps and Shoulders use `pairB` by default, then replaced fixed-pair runtime assumptions with a saved left/right `channelRoute`. Left can route from `ch0` or `ch2`; Right can route from `ch1` or `ch3`.
- Added app-to-firmware label sync through the existing WebSocket command path. `lib/device/websocket.ts` can now send JSON commands and labels, `lib/emg/context.tsx` exposes `syncDeviceLabels()`, and `components/device/device-label-sync.tsx` pushes the selected muscle's left/right labels to the ESP32 when the device connects.
- Cleaned firmware label handling in `firmware/src/main.cpp`: NVS label loading now checks `prefs.isKey()` first, avoiding first-boot `Preferences.cpp getString(): ... NOT_FOUND` noise.
- Added a shared firmware preset helper for `preset legs`, `preset arms`, `preset bicep`, and `preset shoulder`. In U4-only mode it prints that `ch2/ch3` are the channels to use for the test.
- Fixed ADS1292 shared-SPI probing by forcing both chip-select pins high before initializing either ADS. This resolved the observed CS detection issue: reboot after flashing showed `CS=21 ID = 0x53` and `CS=22 ID = 0x53`, with both ADS1292s initialized.
- Built and flashed the ESP32 firmware successfully to `COM11` after the CS deselect fix.

## Telemetry mapping

- Incoming device payload must remain channel-based:
  - `ch[0]` = pairA left
  - `ch[1]` = pairA right
  - `ch[2]` = pairB left
  - `ch[3]` = pairB right
  - `labels[]` supplies display labels when available
- Default presentation assignments:
  - Quads -> pairA
  - Hamstrings -> pairB
  - Biceps -> pairB
  - Shoulders -> pairB
- Biceps and shoulders do not imply extra telemetry channels. They use whichever pair the user physically places on that muscle group.
- Current routing model: the app keeps the UI focused on Left / Right / Bilateral, but internally stores `channelRoute = { leftIndex, rightIndex }`. Passive pre-check can independently choose the best left channel from `ch0/ch2` and the best right channel from `ch1/ch3`. This supports CS=21-only, CS=22-only, mixed, or both-chip runs without exposing Pair A/B in the polished UX.
- When the app is connected to the ESP32 and a muscle group is selected, it now sends label commands so firmware labels reflect the selected region rather than stale LQ/RQ/LH/RH-style names.
- One-sided testing uses only the selected side's routed channel, hides symmetry language, and saves the untested side as `0` in the session summary instead of recording floating/noise values as real effort.
- Completed sessions are stored locally in browser `localStorage` under `myopack:session_history`; there is no backend or external file sync in this build.
- New session records include optional `leftActivation` and `rightActivation` so the intelligence layer can infer which side appears lower over time.
- Live model heat scale is continuous, not stepped: dark blue near 0%, purple through low contraction, coral as activation builds, yellow at high contraction, and red near 100%.
- User-facing Signal copy should avoid fixed muscle labels from firmware (`LQ`, `RQ`, `LH`, `RH`) because the same six-electrode array may be placed on quads, hamstrings, biceps, or shoulders. Keep raw labels internal/debug-only unless explicitly requested.
- Recovery Coach uses saved local session summaries only: timestamp, muscle group, side mode, duration, activation, symmetry, left activation, and right activation. It does not send raw live WebSocket frames, continuous EMG history, or saved records to an external service.

## Monitoring behavior

- Simulation updates only during monitoring.
- Passive precheck simulation updates only the precheck sample buffer, not the main live EMG values or session history.
- Device frames may update labels while idle, but live EMG values and history freeze unless `isMonitoring` is true.
- Device frames may populate `precheckSamples` while `isPrechecking` is true. This is separate from monitoring and is intended for pre-run contact readiness only.
- Passive precheck now recommends the usable left/right channel route by comparing left candidates (`ch0`, `ch2`) and right candidates (`ch1`, `ch3`). This keeps the UX focused on left/right electrode arrays instead of exposing Pair A/B.
- Stop clears session and simulation timers and preserves last displayed values/history.
- Start resets session time and history.

## Dependencies added

- `three@^0.168.0`
- `@react-three/fiber@^8.18.0`
- `@react-three/drei@^9.122.0`
- No AI SDK dependency is used.

## Assumptions

- `/today` remains the home experience.
- Full-body v1 active groups are exactly quads, hamstrings, biceps, and shoulders.
- Sensor assignment is user-driven and honest; UI context changes without changing firmware payloads.
- Local/demo progress data remains static until a real session persistence layer is introduced.
- Six-electrode hardware framing means three electrodes are allocated to the left side and three to the right side for the selected region. EMG electrodes are not temperature sensors.
- Saved recovery summaries are sensitive health-adjacent data and should remain local unless a future version adds an explicit consent-based export path.

## Unresolved issues

- `npm audit` reports existing dependency vulnerabilities after installing 3D packages. No audit fix was run because it may introduce breaking upgrades.
- Production build still fails locally on a Next dependency/webpack readlink issue: `EISDIR: illegal operation on a directory, readlink 'D:\myopack-v3\node_modules\next\dist\pages\_app.js'`. The file exists as a normal file, so this appears to be a local Windows/Next install or worker issue rather than a TypeScript error. `node_modules\.bin\tsc.cmd --noEmit` passes.
- No browser visual QA has been performed yet in this run.
- Procedural human model is intentionally code-native; future polish could replace or augment it with a medically accurate optimized asset.
- The Health Recovery Coach is local and rule-based. The disclaimer says guidance is generated from saved session summaries in-browser and is not diagnostic.
- Previous hardware-looking issue was likely shared-SPI chip-select contention: `ADS1292 CS=21` returned `0x11` while `CS=22` returned `0x53` before both CS pins were forced high before probing. After the fix and flash, reboot log showed both `CS=21` and `CS=22` returning `0x53`.
- A constant `100%` reading on a live channel means the data path is active but likely saturated/railed. Use `raw-log` and the passive pre-check to distinguish contraction from electrode/contact/gain issues before recording a session.
- Local dev note: Next.js does not automatically pop open a browser window. Use `http://localhost:3000/today` after `npm.cmd run dev`. On 2026-04-26, stale Node listeners were occupying ports and the dev server had to be restarted after clearing PID 9880 from port 3000.
- Local dev helpers:
  - `npm.cmd run dev:stop` stops stale Next/Node listeners on ports 3000, 3001, and 3002.
  - `npm.cmd run dev:clean` stops stale listeners, deletes generated `.next`, and starts `next dev`.
  - Use normal `npm.cmd run dev` first. Use `dev:stop` when the terminal was closed but the app still thinks a port is busy. Use `dev:clean` only when Next serves 404s for valid routes or logs stale `.next` cache/type errors.

## Next steps

- Run the app in-browser and inspect `/today`, `/vitals`, and `/health` on iPhone-sized viewport.
- Verify touch rotation does not interfere with vertical page scroll.
- Test with ESP32 payloads shaped like `{ "ch": [lq, rq, lh, rh], "labels": ["LQ", "RQ", "LH", "RH"], "ts": 1234567 }`.
- For live tests: connect both laptop and ESP32 to the same WiFi/hotspot, run `ip` in serial, connect the app to `ws://<device-ip>:81`, select the muscle, choose Left/Right/Bilateral, run passive pre-check, let the app auto-route to the live channel(s), then start the session.
- If serial labels still show stale saved values after flashing, send `preset bicep` or reconnect the app after selecting Biceps; the app will push selected-region labels over WebSocket once connected.
- Consider adding export/import for local recovery session history once capstone demo needs portable longitudinal records.
- If external intelligence is added later, connect it to saved session summaries only after explicit user consent and keep the disclaimer accurate.

---

## Contribution log

### Session: EMG channel routing overhaul
**Date:** 2026-04-26  
**Approximate time:** Evening session  
**Model:** claude-sonnet-4-6 (Claude Code CLI, VSCode extension)  
**Author type:** Claude — acting as Channel Routing Auditor + Frontend Architect + Device Protocol Liaison (per AGENTS.md roles)

---

#### Context for next agent reading this

This session was a targeted correctness fix, not a UI pass. The app looked fine visually but the live EMG signal was routing to the wrong body side for every muscle group except quads on pairA. Before this session, selecting hamstrings and testing your LEFT side would show signal only when you clicked RIGHT in the app. This document section describes exactly what was broken, exactly what was changed, and what still needs live board validation before the next UI or product pass.

---

#### What was discovered (the bugs)

The previous routing model made one foundational assumption that was wrong: it grouped channels by muscle, not by physical body side.

The ADS1292 chips on the board are:
- **U1 at CS=21** — has two ADC channels, now confirmed to be the **LEFT body side chip**
- **U4 at CS=22** — has two ADC channels, now confirmed to be the **RIGHT body side chip**

But the firmware and app were treating them as:
- U1 (CS=21) → "Left Quad" (ch[0]) and "Right Quad" (ch[1]) — one chip, BOTH sides, quads only
- U4 (CS=22) → "Left Ham" (ch[2]) and "Right Ham" (ch[3]) — one chip, BOTH sides, hams only

This meant `pairA = {leftIndex:0, rightIndex:1}` — both indices from U1, both physically on the same LEFT chip. When the app showed "Right" for quads, it was actually showing U1's second channel, which is also LEFT body side hardware.

For `pairB = {leftIndex:2, rightIndex:3}` — both from U4, both physically RIGHT chip. So for hamstrings, biceps, and shoulders (which all defaulted to pairB), "Left" was actually the RIGHT chip and "Right" was also the RIGHT chip.

Additionally:
- `LEFT_CANDIDATES` in readiness.ts was `[0, 2]` — ch[0] from the LEFT chip and ch[2] from the RIGHT chip. This meant precheck could "recommend" swapping from the LEFT chip to the RIGHT chip thinking it was finding a better LEFT signal.
- `RIGHT_CANDIDATES` was `[1, 3]` — ch[1] from the LEFT chip and ch[3] from the RIGHT chip. Same cross-chip error.
- `parseChannelRoute` in the context validated `leftOk = index is 0 or 2` and `rightOk = index is 1 or 3`, which locked in the wrong cross-chip assumption.
- `calculateBalance` was computing `leftAvg = (ch[0] + ch[2]) / 2` and `rightAvg = (ch[1] + ch[3]) / 2`, averaging one channel from each chip to get each "side" — fundamentally backwards for the physical layout.
- `DEVICE_LABELS` in `device-label-sync.tsx` was syncing "Right Quad" to ch[1] and "Left Ham" to ch[2], mislabeling both across chip boundaries.
- All muscle regions except quads defaulted to `pairB`, which made the hardware side assignment wrong for hamstrings, biceps, and shoulders.

---

#### The corrected physical truth

```
ch[0] = U1 (CS=21) CH1  →  LEFT body side,  primary channel
ch[1] = U1 (CS=21) CH2  →  LEFT body side,  secondary channel
ch[2] = U4 (CS=22) CH1  →  RIGHT body side, primary channel
ch[3] = U4 (CS=22) CH2  →  RIGHT body side, secondary channel
```

The corrected pair model:
```
pairA = { leftIndex: 0, rightIndex: 2 }  ← cross-chip, primary (default for ALL muscle groups)
pairB = { leftIndex: 1, rightIndex: 3 }  ← cross-chip, secondary (fallback if primary contact is poor)
```

The corrected candidates:
```
LEFT_CHANNEL_CANDIDATES  = [0, 1]  ← both from U1/CS=21 (left chip)
RIGHT_CHANNEL_CANDIDATES = [2, 3]  ← both from U4/CS=22 (right chip)
```

The corrected balance formula:
```
leftAvg  = (ch[0] + ch[1]) / 2  ← both U1 channels = left body side
rightAvg = (ch[2] + ch[3]) / 2  ← both U4 channels = right body side
```

---

#### The single-line swap point

If live board testing proves that CS=21 is actually RIGHT and CS=22 is actually LEFT, there is now a single constant to flip. No other code needs to change:

```typescript
// lib/muscle-selection.ts, near the top
export const SWAP_PHYSICAL_SIDES = false  // set true if board proves CS=21 is RIGHT
```

All `PHYSICAL_LEFT_PRIMARY`, `PHYSICAL_LEFT_SECONDARY`, `PHYSICAL_RIGHT_PRIMARY`, `PHYSICAL_RIGHT_SECONDARY`, `LEFT_CHANNEL_CANDIDATES`, `RIGHT_CHANNEL_CANDIDATES`, `SENSOR_PAIRS`, and `pairFromRoute` derive from this constant.

In the firmware, the equivalent single swap point is:
```c
// firmware/src/config.h
#define MP_PIN_CS_LEFT   21   // swap with MP_PIN_CS_RIGHT if board proves reversed
#define MP_PIN_CS_RIGHT  22
```
`MP_PIN_CS_U1` and `MP_PIN_CS_U4` are now aliased from these, so swapping the two #defines covers the whole firmware.

---

#### Files changed and why

| File | Change made | Why |
|------|------------|-----|
| `lib/muscle-selection.ts` | Added `SWAP_PHYSICAL_SIDES`, four `PHYSICAL_*` index constants, `LEFT_CHANNEL_CANDIDATES`, `RIGHT_CHANNEL_CANDIDATES`. Fixed `SENSOR_PAIRS.pairA` to `{left:0, right:2}` and `pairB` to `{left:1, right:3}`. All four muscle groups now default to `pairA`. Fixed `pairFromRoute` to recognize the new cross-chip pairs. | This is the single source of truth for physical side mapping. Every other routing decision derives from here. |
| `lib/emg/readiness.ts` | Replaced hardcoded `LEFT_CANDIDATES=[0,2]` and `RIGHT_CANDIDATES=[1,3]` with imported `LEFT_CHANNEL_CANDIDATES=[0,1]` and `RIGHT_CHANNEL_CANDIDATES=[2,3]`. | Precheck was crossing chip boundaries when scoring or recommending channels. Left candidates must come only from the left chip; right candidates only from the right chip. |
| `lib/muscle-selection-context.tsx` | Fixed `parseChannelRoute` validation. Was: `leftOk = index===0 or 2`, `rightOk = index===1 or 3`. Now: uses `LEFT_CHANNEL_CANDIDATES.includes()` and `RIGHT_CHANNEL_CANDIDATES.includes()`. | Stale saved routes from the old model (e.g. `{left:0, right:1}`) are now automatically rejected and rebuilt correctly on app load. Also respects the swap flag. |
| `lib/emg/calculations.ts` | Fixed `calculateBalance`. Was mixing chips: `leftAvg=(ch[0]+ch[2])/2`, `rightAvg=(ch[1]+ch[3])/2`. Now: `leftAvg=(ch[0]+ch[1])/2` (both U1), `rightAvg=(ch[2]+ch[3])/2` (both U4). Added a block comment mapping each `EMGData` field name to its physical channel index. | The balance fallback (used when firmware does not send `bal`) was computing a meaningless average. Field names `leftQuad/rightQuad/leftHam/rightHam` are historical names that no longer reflect the physical side, so the comment clarifies this for future contributors. |
| `lib/emg/context.tsx` | Updated default `channelLabels` from `['Left Quad','Right Quad','Left Ham','Right Ham']` to `['Left Primary','Left Alt','Right Primary','Right Alt']`. | The old defaults implied muscle-grouped ownership. The new names reflect physical side truth for when the firmware hello frame has not yet arrived. |
| `components/device/device-label-sync.tsx` | Fixed `DEVICE_LABELS` for all four muscle groups to use correct physical channel order: `[Left muscle, Left muscle B, Right muscle, Right muscle B]` for indices `[0, 1, 2, 3]`. | Was sending "Right Quad" to ch[1] and "Left Ham" to ch[2], which are both physically on the wrong chip. |
| `firmware/src/config.h` | Added `MP_PIN_CS_LEFT=21` and `MP_PIN_CS_RIGHT=22` as the single-swap point. Aliased `MP_PIN_CS_U1/U4` from those. Renamed `MpChannel` enum: `MP_CH_LQ/RQ/LH/RH` → `MP_CH_L1/L2/R1/R2` with correct side documentation. Updated default labels to `Left Primary / Left Alt / Right Primary / Right Alt`. | Firmware variable names and labels were telling a muscle-grouped story when the truth is physical-side-based. The enum rename makes the side ownership unambiguous at the C++ level. |
| `firmware/src/main.cpp` | Renamed `ads_u1/u4` → `ads_left/right`, `ads_u1_ok/u4_ok` → `ads_left_ok/right_ok`, `chLQ/RQ/LH/RH` → `chL1/L2/R1/R2`, `pct_LQ/RQ/LH/RH` → `pct_L1/L2/R1/R2`. Fixed all preset label strings (e.g. `preset arms` now syncs `Left Bicep / Left Bicep B / Right Bicep / Right Bicep B`). Updated log strings. `MpTelemetry::update()` call order unchanged (ch[0..3] wire order preserved). | Cosmetic but important for maintainability. The old variable names implied the wrong muscle groups owned the channels. Channel wire order was already correct — this was a naming-only fix at the firmware level. |

---

#### What did NOT change (intentionally preserved)

- The WebSocket JSON wire format is unchanged: `{ ch: [v0,v1,v2,v3], labels: [...], bal, qsym, hsym, state }`. ch[0] has always been the first sample from U1 and ch[2] the first from U4 — the physical order was correct, only the app-side interpretation was wrong.
- `MpTelemetry::update(pct_L1, pct_L2, pct_R1, pct_R2)` — same argument order as before, just renamed variables. The wire is not touched.
- Session save schema in `lib/session-history.ts` is unchanged. `sensorPair` is still stored (always `pairA` now for all groups, but the field remains for schema compat with any existing saved records).
- `EMGData` field names (`leftQuad`, `rightQuad`, `leftHam`, `rightHam`) are preserved as historical aliases. The routing is index-based through `channelRoute`, not name-based. Renaming these fields would touch dozens of call sites with no functional benefit.
- Freeze-on-stop behavior, precheck isolation, session timer logic, monitoring lifecycle — all untouched.
- The 3D model, Today/Vitals/Health page layouts — all untouched.

---

#### Superseded entries in this memory file

The following entries written in earlier sessions are now **incorrect** and should be treated as superseded:

1. **Telemetry mapping section** — The old mapping listed:
   - `ch[0] = pairA left`, `ch[1] = pairA right`, `ch[2] = pairB left`, `ch[3] = pairB right`
   - This is now wrong. Correct mapping: `ch[0]/ch[1] = U1/LEFT chip`, `ch[2]/ch[3] = U4/RIGHT chip`.
   - Default assignments listed (Quads → pairA, Hamstrings/Biceps/Shoulders → pairB) are now wrong. All groups default to pairA after this session.

2. **Monitoring behavior section** — The entry reading:
   - *"Passive precheck now recommends the usable left/right channel route by comparing left candidates (ch0, ch2) and right candidates (ch1, ch3)"*
   - This is now wrong. Left candidates are `[0, 1]` (both U1). Right candidates are `[2, 3]` (both U4).

3. **Changes made section** — The entry reading:
   - *"Updated upper-body defaults so Biceps and Shoulders use pairB by default... Left can route from ch0 or ch2; Right can route from ch1 or ch3"*
   - This is now wrong. All groups default to pairA (cross-chip). Left routes from ch0 or ch1 (same chip). Right routes from ch2 or ch3 (same chip).

---

#### Updated telemetry mapping (replaces old section)

```
ch[0] = U1 (CS=21=LEFT chip) CH1   →  Left body side, primary
ch[1] = U1 (CS=21=LEFT chip) CH2   →  Left body side, secondary / alt
ch[2] = U4 (CS=22=RIGHT chip) CH1  →  Right body side, primary
ch[3] = U4 (CS=22=RIGHT chip) CH2  →  Right body side, secondary / alt

pairA = { leftIndex: 0, rightIndex: 2 }  —  primary cross-chip pair, default for all muscle groups
pairB = { leftIndex: 1, rightIndex: 3 }  —  secondary cross-chip pair, used when primary contact is poor

Left candidates (for readiness precheck):  [0, 1]  — both U1/LEFT chip
Right candidates (for readiness precheck): [2, 3]  — both U4/RIGHT chip

All four muscle groups (quads, hamstrings, biceps, shoulders) default to pairA.
Muscle group selection changes labels, interpretation, and UI context only.
It does NOT change which chip is LEFT or which chip is RIGHT.
```

The firmware wire payload format is unchanged:
```json
{ "ch": [L1, L2, R1, R2], "labels": ["Left ...", "Left ... B", "Right ...", "Right ... B"], "bal": N, "qsym": N, "hsym": N, "state": "monitoring|idle" }
```

---

#### What still needs live board validation

1. **CS=21 = LEFT assumption** — If physical testing shows the left electrode array only produces signal when the app is set to RIGHT (or vice versa), flip `SWAP_PHYSICAL_SIDES = true` in `lib/muscle-selection.ts`. That single flag propagates to all routing constants automatically.

2. **One-sided operation** — Plug only the left electrode array (U1/CS=21). Confirm ch[0] responds, ch[2] stays near zero. Then test right-only (U4/CS=22), confirm ch[2] responds, ch[0] stays near zero.

3. **Balance direction** — With both sides plugged: contract left harder than right. Confirm the app shows LEFT > RIGHT. If the values are flipped, use the swap flag.

4. **Precheck channel recommendation** — With mismatched electrode contact quality between sides, confirm the precheck recommends within the same chip (e.g. suggests switching from ch[0] to ch[1] for the left side, not from ch[0] to ch[2]).

5. **Label sync on connect** — After selecting "Biceps" in the app and connecting the ESP32, run `stats` in serial. Confirm ch[0]="Left Bicep", ch[1]="Left Bicep B", ch[2]="Right Bicep", ch[3]="Right Bicep B".

---

#### Test protocol for next session (copy-paste ready)

**Left-only test:**
1. Plug left electrode array into U1 (CS=21).
2. Leave right side unplugged.
3. Open app → select any muscle group → set side mode to Left.
4. Start monitoring. Contract left muscle. Left activation % should rise. Right should show ~0.

**Right-only test:**
1. Plug right electrode array into U4 (CS=22).
2. Leave left side unplugged.
3. Open app → set side mode to Right.
4. Start monitoring. Contract right muscle. Right activation % should rise. Left should show ~0.

**Bilateral test:**
1. Both sides plugged.
2. Set side mode to Bilateral.
3. Contract left only → Left bar rises, Right stays low.
4. Contract right only → Right bar rises, Left stays low.
5. Contract both equally → symmetry % should be high (near 100%).

**Muscle group switch test:**
1. Start in bilateral mode, both plugged.
2. Run a short session on Quads.
3. Stop and go back to muscle selector.
4. Select Hamstrings.
5. Confirm routing is identical (still ch[0]=left, ch[2]=right). Only labels and UI context should update.
6. Run short session on Hamstrings. Confirm left/right sides still map correctly.

**Swap validation (if needed):**
1. If LEFT electrode produces signal only when RIGHT is selected → set `SWAP_PHYSICAL_SIDES = true` in `lib/muscle-selection.ts`.
2. Rerun the left-only and right-only tests above.
3. If correct now, leave the swap flag as true and update the firmware:
   - Swap `MP_PIN_CS_LEFT` and `MP_PIN_CS_RIGHT` values in `firmware/src/config.h` and reflash.

---

#### What is safe to work on next without re-validating routing

- UI polish, spacing, typography, color refinements on any page.
- Today / Vitals / Health page layout improvements.
- Motion, animation, transition work.
- Health page coaching copy and longitudinal display.
- Session history display improvements.
- Any work that does not touch `lib/muscle-selection.ts`, `lib/emg/readiness.ts`, `lib/emg/context.tsx`, `lib/emg/calculations.ts`, `lib/muscle-selection-context.tsx`, or the firmware.

If you touch any of the above routing files: re-read this section and the corrected telemetry mapping before making changes. The routing model is now internally consistent. Do not reintroduce the old pairA/pairB muscle-grouped logic.

---

#### Confidence level

App-side routing logic: **high confidence** — all path through `pairA={0,2}`, candidates `[0,1]/[2,3]`, and validation are consistent and verified in code.  
Firmware variable naming: **high confidence** — old names fully replaced, no remaining references to `pct_LQ/RQ/LH/RH` or `ads_u1/u4`.  
Physical board truth (CS=21=LEFT): **unverified** — based on user assertion. Requires live electrode test to confirm. The swap flag exists precisely because this needs hardware validation.

---

### Session: EMG software validation hardening
**Date/time:** 2026-04-27 11:17:21 -05:00
**Model:** GPT-5 Codex
**Author type:** Codex acting as Signal Integrity Director + Device Protocol Liaison + Monitoring Logic Guardian + Build Reliability Engineer

#### Scope

This was a real software-path validation pass before live EMG hardware testing. The goal was to rule out app, parser, routing, and timing-code issues as much as possible before blaming electrodes, placement, or wiring.

#### Files changed

- `lib/device/types.ts`: added `parseTelemetryFrame()`, optional labels, finite channel validation, clamping warnings, and optional `seq`, `streamHz`, and `sampleHz`.
- `lib/device/websocket.ts`: added normalized parsing and device diagnostics for input Hz, dropped frames, parse errors, invalid frames, warning frames, reconnect attempts, expected stream Hz, sample Hz, last frame time, and last error.
- `lib/emg/context.tsx`: consumes normalized frames, tolerates missing labels, computes balance locally from `ch[]`, exposes diagnostics, and preserves precheck/live/freeze separation.
- `lib/emg/ingestion.ts`: added pure ingestion helpers for offline tests, including freeze-on-stop behavior.
- `lib/emg/synthetic.ts`: added synthetic EMG generator with idle noise, bursts, amplitude variation, dropout markers, malformed packets, jitter, left/right swap, low-rate, and oversmoothed scenarios.
- `lib/muscle-selection-context.tsx`: restored saved selected muscle and placement confirmation from localStorage.
- `lib/session-history.ts`: added optional route/source/quality metadata and finite-number validation for saved records.
- `app/today/page.tsx`: saved sessions now include channel route, data source, input rate, dropped frames, parse errors, and precheck score.
- `app/vitals/page.tsx`: added software diagnostics panel for input rate, graph buffer rate, dropped frames, parser errors, route, and frame age.
- `components/dashboard/live-muscle-graph.tsx`: graph x-axis now uses timestamps when available and accepts a live rate label.
- `firmware/src/signal_processing.cpp`: fixed firmware balance to left=`ch0/ch1`, right=`ch2/ch3`; corrected `qsym`/`hsym` meanings; added filter/sample-rate guard.
- `firmware/src/signal_processing.h`: RMS window derives from configured sample rate/window duration.
- `firmware/src/telemetry_server.cpp`: telemetry frames now include `seq`, `streamHz`, and `sampleHz`; hello includes `sampleHz`; buffer enlarged.
- `firmware/src/telemetry_server.h`, `firmware/src/config.h`, `firmware/src/main.cpp`, `firmware/README.md`: updated docs/comments/diagnostics to physical-side channel language.
- `.eslintrc.json`: added standard Next lint config so lint runs non-interactively.
- `package.json`: added `npm run test:emg`.
- `scripts/emg-offline-validation.mjs`: added offline validation harness.

#### Tests run

- `npm.cmd run test:emg`: passed.
- `node_modules\.bin\tsc.cmd --noEmit`: passed.
- `npm.cmd run lint`: initially blocked by missing config, then passed after adding `.eslintrc.json`.
- `npm.cmd run build`: failed with existing local Next/Windows/Node issue: `EISDIR: illegal operation on a directory, readlink 'D:\myopack-v3\node_modules\next\dist\pages\_app.js'`.
- `npm.cmd install`: completed and reported dependencies up to date, but did not fix the build issue.
- `pio run`: not available in this shell PATH.

#### Current telemetry mapping

```text
ch[0] = U1 / CS=21 / left body side / primary
ch[1] = U1 / CS=21 / left body side / secondary
ch[2] = U4 / CS=22 / right body side / primary
ch[3] = U4 / CS=22 / right body side / secondary

pairA = { leftIndex: 0, rightIndex: 2 }
pairB = { leftIndex: 1, rightIndex: 3 }
left candidates = [0, 1]
right candidates = [2, 3]
```

The app still parses the required `ch[] + labels[]` payload and accepts both `t` and `ts`.

#### Important notes for next model

- The app now computes displayed balance locally from `ch[]` so older flashed firmware with stale `bal` cannot mislead the UI.
- Firmware source balance is fixed, but the ESP32 must be reflashed before hardware tests benefit from firmware-side fixes.
- Firmware remains 500 SPS. That is usable for rough activation visualization but is not full raw EMG fidelity up to 500 Hz. The code now prevents silently changing sample rate without regenerating filters.
- The app transport is still 20 Hz processed activation, not raw EMG.
- Passive precheck is heuristic and cannot prove electrode contact like true lead-off/contact impedance hardware.

#### Live hardware still required

1. Reflash firmware.
2. Confirm `CS=21` truly maps to left body side. If not, flip `SWAP_PHYSICAL_SIDES` and swap firmware left/right CS defines.
3. Confirm left-only: `ch0/ch1` respond and `ch2/ch3` stay quiet enough.
4. Confirm right-only: `ch2/ch3` respond and `ch0/ch1` stay quiet enough.
5. Confirm bilateral direction with left-harder and right-harder contractions.
6. Watch Vitals diagnostics during testing: input rate near 20 Hz, dropped/parse errors at 0, and route `L0/R2` for primary.

#### Remaining blockers

Software fixed:
- Missing labels no longer crash telemetry.
- Malformed/non-finite channel data is rejected.
- Route math, balance math, readiness recommendation, freeze-on-stop ingestion, and synthetic stream handling are covered by offline tests.
- Firmware source balance now matches physical-side mapping.
- Vitals exposes transport/routing diagnostics.

Software uncertain:
- Production build still blocked by local Next/Node/Windows `EISDIR readlink` issue.
- Firmware compile not verified because PlatformIO is unavailable in PATH.
- Browser visual QA was not rerun after diagnostics UI changes.

Hardware/electrode/placement dependent:
- Actual left/right chip physical truth.
- Whether floating or unplugged electrodes produce enough noise to look active.
- ADS placement, reference placement, gain, and contact quality.
- Whether 500 SPS and current 20-150 Hz envelope are sufficient for the first live capstone demo.
