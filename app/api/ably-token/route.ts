import { NextRequest, NextResponse } from 'next/server'
import * as Ably from 'ably'
import { DEFAULT_RELAY_DEVICE_ID, normalizeRelayDeviceId, relayChannelName } from '@/lib/device/relay-config'

export const runtime = 'nodejs'

const TOKEN_TTL_MS = 60 * 60 * 1000

export async function GET(request: NextRequest) {
  const apiKey = process.env.ABLY_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ABLY_API_KEY is not configured on this deployment.' },
      { status: 500 }
    )
  }

  const rawDeviceId =
    request.nextUrl.searchParams.get('deviceId') ||
    process.env.NEXT_PUBLIC_MYOPACK_DEVICE_ID ||
    DEFAULT_RELAY_DEVICE_ID
  const deviceId = normalizeRelayDeviceId(rawDeviceId)

  const rest = new Ably.Rest({ key: apiKey })
  const tokenRequest = await rest.auth.createTokenRequest({
    clientId: `myopack-web-${deviceId}`,
    ttl: TOKEN_TTL_MS,
    capability: {
      [relayChannelName(deviceId, 'telemetry')]: ['subscribe'],
      [relayChannelName(deviceId, 'control')]: ['publish'],
    },
  })

  return NextResponse.json(tokenRequest)
}
