import { lookup } from 'dns/promises'
import { isIPv4 } from 'net'
import { AppError } from './app-error.js'

// RFC 1918 + loopback + link-local + special-use / metadata-adjacent blocks
const PRIVATE_RANGES_V4: Array<[number, number, number]> = [
  [10, 0, 8],       // 10.0.0.0/8
  [172, 16, 12],    // 172.16.0.0/12
  [192, 168, 16],   // 192.168.0.0/16
  [127, 0, 8],      // 127.0.0.0/8
  [169, 254, 16],   // 169.254.0.0/16 link-local
  [0, 0, 8],        // 0.0.0.0/8 "this" network
  [100, 64, 10],    // 100.64.0.0/10 carrier-grade NAT
  [192, 0, 24],     // 192.0.0.0/24 IETF protocol assignments
  [192, 0, 2],      // 192.0.2.0/24 TEST-NET-1
  [198, 18, 15],    // 198.18.0.0/15 benchmarking
  [198, 51, 24],    // 198.51.100.0/24 TEST-NET-2
  [203, 0, 24],     // 203.0.113.0/24 TEST-NET-3
  [224, 0, 4],      // 224.0.0.0/4 multicast
]

function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) | parseInt(octet, 10), 0) >>> 0
}

function isPrivateV4(ip: string): boolean {
  const num = ipToNumber(ip)
  for (const [a, b, prefix] of PRIVATE_RANGES_V4) {
    const base = ipToNumber(`${a}.${b}.0.0`)
    const mask = (~0 << (32 - prefix)) >>> 0
    if ((num & mask) === (base & mask)) return true
  }
  return false
}

function isPrivateV6(ip: string): boolean {
  const lower = ip.toLowerCase()
  if (lower === '::1') return true
  if (lower === '::') return true
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true
  // fc00::/7 covers fc00:: to fdff::
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true
  return false
}

export async function assertSafeUrl(rawUrl: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new AppError(422, 'Invalid URL')
  }

  if (parsed.protocol !== 'https:') {
    throw new AppError(422, 'Invalid URL')
  }

  const hostname = parsed.hostname

  let resolvedIp: string
  try {
    const result = await lookup(hostname)
    resolvedIp = result.address
  } catch {
    throw new AppError(422, 'Invalid URL')
  }

  if (isIPv4(resolvedIp)) {
    if (isPrivateV4(resolvedIp)) {
      throw new AppError(422, 'Invalid URL')
    }
  } else {
    if (isPrivateV6(resolvedIp)) {
      throw new AppError(422, 'Invalid URL')
    }
  }
}
