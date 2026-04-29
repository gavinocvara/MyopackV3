import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const requireNode = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const moduleCache = new Map()

function loadTs(relativePath) {
  const fullPath = path.resolve(root, relativePath)
  return loadTsFile(fullPath)
}

function loadTsFile(fullPath) {
  const normalized = normalizePath(fullPath)
  if (moduleCache.has(normalized)) return moduleCache.get(normalized).exports

  const source = fs.readFileSync(normalized, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
    },
    fileName: normalized,
  }).outputText

  const module = { exports: {} }
  moduleCache.set(normalized, module)
  const localRequire = (specifier) => resolveRequire(specifier, normalized)
  const context = {
    module,
    exports: module.exports,
    require: localRequire,
    console,
    Date,
    Math,
    Number,
    JSON,
    setTimeout,
    clearTimeout,
  }
  vm.runInNewContext(output, context, { filename: normalized })
  return module.exports
}

function resolveRequire(specifier, fromFile) {
  if (specifier.startsWith('@/')) {
    return loadTsFile(resolveTsPath(path.join(root, specifier.slice(2))))
  }
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    return loadTsFile(resolveTsPath(path.resolve(path.dirname(fromFile), specifier)))
  }
  return requireNode(specifier)
}

function resolveTsPath(base) {
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ]
  const found = candidates.find((candidate) => fs.existsSync(candidate))
  if (!found) throw new Error(`Unable to resolve TS module: ${base}`)
  return found
}

function normalizePath(value) {
  return path.normalize(value)
}

function test(name, fn) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function plain(value) {
  return JSON.parse(JSON.stringify(value))
}

const deviceTypes = loadTs('lib/device/types.ts')
const calculations = loadTs('lib/emg/calculations.ts')
const selection = loadTs('lib/muscle-selection.ts')
const readiness = loadTs('lib/emg/readiness.ts')
const ingestion = loadTs('lib/emg/ingestion.ts')
const synthetic = loadTs('lib/emg/synthetic.ts')

test('telemetry parser accepts ch[] + labels[] and normalizes timestamp', () => {
  const parsed = deviceTypes.parseTelemetryFrame({
    ts: 1234,
    ch: [10, 20, 30, 40],
    labels: ['L', 'LB', 'R', 'RB'],
  }, 9999)
  assert.equal(parsed.ok, true)
  assert.deepEqual(parsed.frame.channels, [10, 20, 30, 40])
  assert.deepEqual(parsed.frame.labels, ['L', 'LB', 'R', 'RB'])
  assert.equal(parsed.frame.timestamp, 1234)
})

test('telemetry parser tolerates missing labels without crashing', () => {
  const parsed = deviceTypes.parseTelemetryFrame({ t: 10, ch: [1, 2, 3, 4] }, 9999)
  assert.equal(parsed.ok, true)
  assert.equal(parsed.frame.labels, undefined)
})

test('telemetry parser rejects malformed or non-finite channels', () => {
  assert.equal(deviceTypes.parseTelemetryFrame({ ch: [1, 2, 3] }).ok, false)
  assert.equal(deviceTypes.parseTelemetryFrame({ ch: [1, Number.NaN, 3, 4] }).ok, false)
  assert.equal(deviceTypes.parseTelemetryFrame({ ch: [1, Infinity, 3, 4] }).ok, false)
})

test('telemetry parser clamps out-of-range activation with warnings', () => {
  const parsed = deviceTypes.parseTelemetryFrame({ t: 1, ch: [-10, 25, 120, 50] })
  assert.equal(parsed.ok, true)
  assert.deepEqual(parsed.frame.channels, [0, 25, 100, 50])
  assert.equal(parsed.warnings.length >= 2, true)
})

test('telemetry parser preserves firmware source marker', () => {
  const ads = deviceTypes.parseTelemetryFrame({ t: 1, ch: [1, 2, 3, 4], source: 'ads' })
  const sim = deviceTypes.parseTelemetryFrame({ t: 2, ch: [5, 6, 7, 8], source: 'firmware-sim' })
  const unknown = deviceTypes.parseTelemetryFrame({ t: 3, ch: [9, 10, 11, 12], source: 'other' })
  assert.equal(ads.ok, true)
  assert.equal(ads.frame.source, 'ads')
  assert.equal(sim.ok, true)
  assert.equal(sim.frame.source, 'firmware-sim')
  assert.equal(unknown.ok, true)
  assert.equal(unknown.frame.source, undefined)
})

test('physical channel route stays left chip vs right chip', () => {
  assert.deepEqual(Array.from(selection.LEFT_CHANNEL_CANDIDATES), [2, 3])
  assert.deepEqual(Array.from(selection.RIGHT_CHANNEL_CANDIDATES), [0, 1])
  assert.deepEqual(plain(selection.routeFromPair('pairA')), { leftIndex: 2, rightIndex: 0 })
  assert.deepEqual(plain(selection.routeFromPair('pairB')), { leftIndex: 3, rightIndex: 1 })
})

test('route values use selected physical channels', () => {
  const values = selection.getRouteValues({
    leftQuad: 11,
    rightQuad: 55,
    leftHam: 88,
    rightHam: 6,
  }, { leftIndex: 1, rightIndex: 2 })
  assert.equal(values.left, 55)
  assert.equal(values.right, 88)
  assert.equal(values.symmetry, 67)
})

test('balance math matches physical-side mapping', () => {
  const balance = calculations.calculateBalance({
    leftQuad: 90,
    rightQuad: 70,
    leftHam: 20,
    rightHam: 10,
  })
  assert.equal(balance, 35)
})

test('readiness recommendation stays inside each physical side', () => {
  const samples = Array.from({ length: 24 }, (_, index) => ({
    timestamp: index * 50,
    values: [
      1,
      index < 8 ? 2 : 35 + index,
      index < 8 ? 3 : 48 + index,
      4,
    ],
  }))
  const route = readiness.recommendChannelRoute(samples, selection.routeFromPair('pairA'), 'bilateral')
  assert.deepEqual(plain(route), { leftIndex: 2, rightIndex: 1 })
})

test('ingestion freezes live EMG when monitoring is stopped but still records precheck', () => {
  const state = {
    emgData: calculations.DEFAULT_EMG_DATA,
    history: [],
    precheckSamples: [],
  }
  const stopped = ingestion.applyTelemetryIngestion(state, [10, 20, 30, 40], 100, {
    isMonitoring: false,
    isPrechecking: true,
    maxHistoryPoints: 120,
    maxPrecheckPoints: 80,
  })
  assert.equal(stopped.history.length, 0)
  assert.equal(stopped.precheckSamples.length, 1)
  assert.equal(stopped.emgData.leftQuad, calculations.DEFAULT_EMG_DATA.leftQuad)

  const running = ingestion.applyTelemetryIngestion(stopped, [10, 20, 30, 40], 150, {
    isMonitoring: true,
    isPrechecking: false,
    maxHistoryPoints: 120,
    maxPrecheckPoints: 80,
  })
  assert.equal(running.history.length, 1)
  assert.equal(running.emgData.leftQuad, 10)
})

test('synthetic generator covers bursts, malformed packets, dropouts, swaps, and low rate', () => {
  const events = synthetic.generateSyntheticEmgScenario({
    durationMs: 2500,
    streamHz: 20,
    malformedEvery: 7,
    dropoutStartMs: 1600,
    dropoutEndMs: 1900,
    leftRightSwap: true,
    lowRate: true,
    seed: 7,
  })
  assert.equal(events.some((event) => event.issue === 'malformed'), true)
  assert.equal(events.some((event) => event.issue === 'dropout'), true)
  assert.equal(events.some((event) => event.issue === 'left-right-swap' || event.issue === 'low-rate'), true)
  const validFrames = events
    .map((event) => deviceTypes.parseTelemetryFrame(event.payload, event.atMs))
    .filter((result) => result.ok)
  assert.equal(validFrames.length > 0, true)
})

console.log('EMG offline validation complete.')
