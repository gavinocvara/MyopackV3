import * as Ably from 'ably'

const apiKey = process.env.ABLY_API_KEY
const deviceId = process.env.MYOPACK_DEVICE_ID || process.env.NEXT_PUBLIC_MYOPACK_DEVICE_ID || 'demo-01'

if (!apiKey) {
  console.error('ABLY_API_KEY is required to publish a relay smoke frame.')
  process.exit(1)
}

const channelName = `myopack:${deviceId}:telemetry`
const client = new Ably.Rest({ key: apiKey })
const channel = client.channels.get(channelName)
const now = Date.now()

await channel.publish('telemetry', {
  t: now,
  seq: 1,
  streamHz: 20,
  sampleHz: 500,
  ch: [62, 58, 54, 51],
  labels: ['Left Primary', 'Left Alt', 'Right Primary', 'Right Alt'],
  bal: 92,
  qsym: 93,
  hsym: 94,
  state: 'monitoring',
})

console.log(`Published smoke telemetry to ${channelName}`)
