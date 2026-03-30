export const APP_VERSION = __APP_VERSION__

export async function fetchRemoteAppVersion(): Promise<string | null> {
  const response = await fetch('/version.json', {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  })

  if (!response.ok) {
    throw new Error(`Version check failed with status ${response.status}`)
  }

  const data = (await response.json()) as { version?: string }
  return typeof data.version === 'string' ? data.version : null
}
