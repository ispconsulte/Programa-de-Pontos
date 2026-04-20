import { watchdogFetch } from '@/utils/requestWatchdog'

export const APP_VERSION = __APP_VERSION__

export async function fetchRemoteAppVersion(signal?: AbortSignal): Promise<string | null> {
  const response = await watchdogFetch('/version.json', {
    cache: 'no-store',
    signal,
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  }, 'refresh')

  if (!response.ok) {
    throw new Error(`Version check failed with status ${response.status}`)
  }

  const data = (await response.json()) as { version?: string }
  return typeof data.version === 'string' ? data.version : null
}
