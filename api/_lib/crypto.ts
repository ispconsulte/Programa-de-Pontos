import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-char hex string (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

export function encrypt(plaintext: string): { enc: Buffer; iv: Buffer } {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  const enc = Buffer.concat([encrypted, authTag])
  return { enc, iv }
}

export function toByteaHex(value: Buffer): string {
  return `\\x${value.toString('hex')}`
}

export function fromBytea(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value
  if (typeof value === 'string') {
    const normalized = value.startsWith('\\x') ? value.slice(2) : value
    return Buffer.from(normalized, 'hex')
  }
  return Buffer.alloc(0)
}
